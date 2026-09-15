import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  analyzeFields,
  analyzeValues,
  displayValue,
  getType,
  isArrayOfObjects,
  DISTINCT_DISPLAY_LIMIT,
  FIELD_ENUM_ROW_LIMIT,
  MAX_DISTINCT_TRACKED,
  type JsonValue,
} from './analyze'

const CHILDREN_PAGE = 100
const DEFAULT_EXPAND_DEPTH = 1
const VALUE_DISPLAY_LIMIT = 200

export type TreeMode = 'data' | 'schema'

interface NodeProps {
  name: string
  path: string
  value: JsonValue
  depth: number
  enumKeys?: Set<string>
  mode: TreeMode
  initialForce: boolean | null
}

function copyNodeValue(value: JsonValue): string {
  if (typeof value === 'string') return value
  if (value === null) return 'null'
  return JSON.stringify(value)
}

function truncateDisplay(text: string, limit = VALUE_DISPLAY_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

const JsonNode = memo(function JsonNode({ name, path, value, depth, enumKeys, mode, initialForce }: NodeProps) {
  const { t } = useTranslation()
  const type = getType(value)
  const isContainer = type === 'object' || type === 'array'
  const isArray = type === 'array'
  const [open, setOpen] = useState(() =>
    initialForce === null ? depth <= DEFAULT_EXPAND_DEPTH : initialForce,
  )
  const [visible, setVisible] = useState(CHILDREN_PAGE)

  const arrayAnalysis = useMemo(
    () => (mode === 'data' && isArray ? analyzeValues(value as JsonValue[]) : null),
    [mode, isArray, value],
  )
  const enumDistinct = arrayAnalysis?.distinct ?? null
  const isEnum = !!enumDistinct?.isEnum

  const childEnumKeys = useMemo(() => {
    if (mode !== 'data' || !open || !isArray) return undefined
    const arr = value as JsonValue[]
    if (arr.length > FIELD_ENUM_ROW_LIMIT || !isArrayOfObjects(arr)) return undefined
    const fields = analyzeFields(arr)
    const keys = new Set<string>()
    for (const field of fields) if (field.distinct?.isEnum) keys.add(field.key)
    return keys.size > 0 ? keys : undefined
  }, [mode, open, isArray, value])

  const children = useMemo(() => {
    if (type === 'object') {
      return Object.entries(value as Record<string, JsonValue>).map(([key, v]) => ({
        name: key,
        path: path === '$' ? `$.${key}` : `${path}.${key}`,
        value: v,
      }))
    }
    if (isArray) {
      return (value as JsonValue[]).map((v, index) => ({
        name: String(index),
        path: `${path}[${index}]`,
        value: v,
      }))
    }
    return null
  }, [type, isArray, path, value])

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
        <span className="jname" title={path}>
          {name}
        </span>
        <span className="jcolon">:</span>
        {!isContainer && (
          <span className={`jvalue is-${type}`} title={type === 'string' ? copyNodeValue(value) : undefined}>
            {truncateDisplay(displayValue(value))}
          </span>
        )}
        {isContainer && <span className="jbrace">{type === 'object' ? '{…}' : '[…]'}</span>}
        <span className={`jnode-type is-${type}`}>{type}</span>
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
        <span className="jcopy-group">
          <CopyButton
            label={t('tools:format.tree.copyValue')}
            getText={() => copyNodeValue(value)}
          />
          <CopyButton label={t('tools:format.tree.copyPath')} getText={() => path} />
        </span>
      </div>

      {showChildren && (
        <div className="jchildren">
          {showChildren.map((child) => (
            <JsonNode
              key={child.name}
              name={child.name}
              path={child.path}
              value={child.value}
              depth={depth + 1}
              enumKeys={isArray ? childEnumKeys : undefined}
              mode={mode}
              initialForce={initialForce}
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

export default function JsonTree({ data, mode = 'data' }: { data: JsonValue; mode?: TreeMode }) {
  const { t } = useTranslation()
  const [sig, setSig] = useState<{ key: number; force: boolean | null }>({ key: 0, force: null })

  const trigger = (force: boolean) => setSig((s) => ({ key: s.key + 1, force }))

  return (
    <div className="jtree">
      <div className="jtree-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => trigger(true)}>
          {t('tools:format.tree.expandAll')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => trigger(false)}>
          {t('tools:format.tree.collapseAll')}
        </button>
      </div>
      <JsonNode
        key={sig.key}
        name="$"
        path="$"
        value={data}
        depth={0}
        mode={mode}
        initialForce={sig.force}
      />
    </div>
  )
}

function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <button type="button" className={`jcopy${copied ? ' is-copied' : ''}`} onClick={handleCopy} aria-label={label} title={label}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}