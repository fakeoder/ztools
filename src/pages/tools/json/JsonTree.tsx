import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  analyzeFields,
  analyzeValues,
  getType,
  isArrayOfObjects,
  DISTINCT_DISPLAY_LIMIT,
  FIELD_ENUM_ROW_LIMIT,
  MAX_DISTINCT_TRACKED,
  type JsonValue,
} from './analyze'

const CHILDREN_PAGE = 100
const DEFAULT_EXPAND_DEPTH = 1

interface NodeProps {
  name: string
  value: JsonValue
  depth: number
  enumKeys?: Set<string>
}

const JsonNode = memo(function JsonNode({ name, value, depth, enumKeys }: NodeProps) {
  const { t } = useTranslation()
  const type = getType(value)
  const isContainer = type === 'object' || type === 'array'
  const isArray = type === 'array'
  const [open, setOpen] = useState(depth <= DEFAULT_EXPAND_DEPTH)
  const [visible, setVisible] = useState(CHILDREN_PAGE)

  const arrayAnalysis = useMemo(
    () => (isArray ? analyzeValues(value as JsonValue[]) : null),
    [isArray, value],
  )
  const enumDistinct = arrayAnalysis?.distinct ?? null
  const isEnum = !!enumDistinct?.isEnum

  const childEnumKeys = useMemo(() => {
    if (!open || !isArray) return undefined
    const arr = value as JsonValue[]
    if (arr.length > FIELD_ENUM_ROW_LIMIT || !isArrayOfObjects(arr)) return undefined
    const fields = analyzeFields(arr)
    const keys = new Set<string>()
    for (const field of fields) if (field.distinct?.isEnum) keys.add(field.key)
    return keys.size > 0 ? keys : undefined
  }, [open, isArray, value])

  const children = useMemo(() => {
    if (type === 'object') {
      return Object.entries(value as Record<string, JsonValue>).map(([key, v]) => ({ name: key, value: v }))
    }
    if (isArray) {
      return (value as JsonValue[]).map((v, index) => ({ name: String(index), value: v }))
    }
    return null
  }, [type, isArray, value])

  const childrenCount = children?.length ?? 0
  const showChildren = isContainer && open && !isEnum && children ? children.slice(0, visible) : null

  return (
    <div className="jnode">
      <div className={`jrow${isContainer ? ' is-container' : ''}`}>
        {isContainer ? (
          <button
            type="button"
            className="jtoggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t('tools:format.tree.collapse') : t('tools:format.tree.expand')}
          >
            <ChevronIcon />
          </button>
        ) : (
          <span className="jtoggle-spacer" />
        )}
        <span className="jname">{name}</span>
        <span className="jcolon">:</span>
        <span className={`jtype is-${type}`}>{type}</span>
        {isContainer && (
          <span className="jcount">
            {type === 'object'
              ? t('tools:format.tree.keys', { count: childrenCount })
              : t('tools:format.tree.items', { count: childrenCount })}
          </span>
        )}
        {arrayAnalysis && arrayAnalysis.typeCounts.length > 0 && (
          <span className="jelems">
            {arrayAnalysis.typeCounts.map((tc) => (
              <span className="jelem" key={tc.type}>
                <span className={`jtype is-${tc.type}`}>{tc.type}</span>
                <span className="jtimes">×{tc.count}</span>
              </span>
            ))}
          </span>
        )}
        {isEnum && <span className="jenum-badge">{t('tools:format.enumLabel')}</span>}
        {type === 'object' && enumKeys?.has(name) && (
          <span className="jenum-badge">{t('tools:format.enumLabel')}</span>
        )}
      </div>

      {showChildren && (
        <div className="jchildren">
          {showChildren.map((child) => (
            <JsonNode
              key={child.name}
              name={child.name}
              value={child.value}
              depth={depth + 1}
              enumKeys={isArray ? childEnumKeys : undefined}
            />
          ))}
          {childrenCount > visible && (
            <button type="button" className="jmore" onClick={() => setVisible((c) => c + CHILDREN_PAGE)}>
              {t('tools:format.tree.showMoreOf', {
                shown: Math.min(CHILDREN_PAGE, childrenCount - visible),
                total: childrenCount,
              })}
            </button>
          )}
        </div>
      )}

      {isContainer && open && isEnum && enumDistinct && (
        <div className="jchildren">
          <div className="jenum-chips">
            {enumDistinct.values.slice(0, DISTINCT_DISPLAY_LIMIT).map((dv) => (
              <span className="jchip" key={dv.display}>
                <span className="jchip-value">{dv.display}</span>
                <span className="jchip-count">×{dv.count}</span>
              </span>
            ))}
            {enumDistinct.values.length > DISTINCT_DISPLAY_LIMIT && (
              <span className="jmore-note">
                {t('tools:format.tree.more', { count: enumDistinct.values.length - DISTINCT_DISPLAY_LIMIT })}
              </span>
            )}
            {enumDistinct.truncated && (
              <span className="jmore-note">{t('tools:format.truncatedNote', { count: MAX_DISTINCT_TRACKED })}</span>
            )}
          </div>
        </div>
      )}

      {isContainer && type === 'array' && enumDistinct?.truncated && !open && (
        <span className="jmore-note-inline">{t('tools:format.truncatedNote', { count: MAX_DISTINCT_TRACKED })}</span>
      )}
    </div>
  )
})

export default function JsonTree({ data }: { data: JsonValue }) {
  return (
    <div className="jtree">
      <JsonNode name="$" value={data} depth={0} />
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}