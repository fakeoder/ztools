import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import JsonTree from './json/JsonTree'
import { generateSchema } from './json/schema'
import {
  analyzeRoot,
  DISTINCT_DISPLAY_LIMIT,
  MAX_DISTINCT_TRACKED,
  type DistinctResult,
  type JsonValue,
  type RootStats,
} from './json/analyze'
import { formatSize, MAX_INPUT_SIZE, parseJson } from './json/util'

const SAMPLE = `{
  "users": [
    { "name": "Alice", "role": "admin", "active": true, "scores": [10, 20, 30] },
    { "name": "Bob", "role": "admin", "active": false, "scores": [5, 15] },
    { "name": "Carol", "role": "viewer", "active": true, "scores": [] }
  ],
  "tags": ["dev", "tool", "json", "dev"],
  "meta": { "version": "1.0.0", "count": 3 }
}`

type ViewMode = 'tree' | 'pretty' | 'compact' | 'schema' | 'stats'
type IndentOption = 2 | 4

const VIEW_MODES: ViewMode[] = ['tree', 'pretty', 'compact', 'schema', 'stats']

export default function JsonFormat() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<JsonValue | null>(null)
  const [view, setView] = useState<ViewMode>('tree')
  const [indent, setIndent] = useState<IndentOption>(2)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const rootStats = useMemo(() => (data !== null ? analyzeRoot(data) : null), [data])
  const schema = useMemo(
    () => (data !== null && view === 'schema' ? JSON.stringify(generateSchema(data), null, 2) : null),
    [data, view],
  )

  const textOutput = useMemo(() => {
    if (data === null) return ''
    if (view === 'pretty') return JSON.stringify(data, null, indent)
    if (view === 'compact') return JSON.stringify(data)
    if (view === 'schema') return schema ?? ''
    return ''
  }, [data, view, indent, schema])

  const showError = (message: string) => {
    setData(null)
    setError(message)
  }

  const runParse = (text: string) => {
    setError(null)
    const bytes = new Blob([text]).size
    if (bytes > MAX_INPUT_SIZE) {
      showError(t('tools:format.sizeError', { size: formatSize(MAX_INPUT_SIZE) }))
      return
    }
    const result = parseJson(text)
    if ('error' in result) {
      showError(`${t('tools:format.invalidJson')}: ${result.error}`)
      return
    }
    setData(result.data)
  }

  const handleFormat = () => {
    if (input.trim() === '') return
    runParse(input)
  }

  const handleFile = (file: File) => {
    setError(null)
    if (file.size > MAX_INPUT_SIZE) {
      showError(t('tools:format.fileTooLarge', { size: formatSize(MAX_INPUT_SIZE) }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setInput(text)
      runParse(text)
    }
    reader.onerror = () => {
      setData(null)
      setError(t('tools:format.readError'))
    }
    reader.readAsText(file)
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const hasTextOutput = view === 'pretty' || view === 'compact' || view === 'schema'

  return (
    <section className="section tool-page">
      <div className="container">
        <div className="tool-page-head">
          <span className="badge">{t(`tools:tags.${t('tools:json_format.tag')}`)}</span>
          <h1>{t('tools:json_format.name')}</h1>
          <p>{t('tools:json_format.desc')}</p>
        </div>

        <div className="json-toolbar">
          <textarea
            className="json-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleFormat()
            }}
            placeholder={t('tools:format.placeholder')}
            rows={8}
            spellCheck={false}
          />
          <div className="json-actions">
            <button type="button" className="btn btn-primary" onClick={handleFormat}>
              {t('tools:format.format')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setInput(SAMPLE)}>
              {t('tools:format.sample')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              {t('tools:format.upload')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setInput('')
                setData(null)
                setError(null)
              }}
            >
              {t('tools:format.clear')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json,text/plain"
              className="visually-hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
            <span className="json-size-hint">{t('tools:format.maxSizeHint', { size: formatSize(MAX_INPUT_SIZE) })}</span>
          </div>
        </div>

        {error && <div className="json-error" role="alert">{error}</div>}

        {data === null && !error && (
          <p className="json-empty">{t('tools:format.emptyState')}</p>
        )}

        {data !== null && (
          <div className="json-output">
            <div className="json-tabs">
              <div className="json-tabs-btns" role="tablist" aria-label={t('tools:format.viewsLabel')}>
                {VIEW_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={view === mode}
                    className={view === mode ? 'is-active' : ''}
                    onClick={() => setView(mode)}
                  >
                    {t(`tools:format.views.${mode}`)}
                  </button>
                ))}
              </div>
              {view === 'pretty' && (
                <label className="json-indent">
                  {t('tools:format.indent')}
                  <select value={indent} onChange={(e) => setIndent(Number(e.target.value) as IndentOption)}>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                  </select>
                </label>
              )}
              {hasTextOutput && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(textOutput)}>
                  {copied ? t('tools:format.copied') : t('tools:format.copy')}
                </button>
              )}
            </div>

            <div className="json-view">
              {view === 'tree' && <JsonTree data={data} />}
              {view === 'pretty' && <pre className="json-pre">{textOutput}</pre>}
              {view === 'compact' && <pre className="json-pre json-pre-compact">{textOutput}</pre>}
              {view === 'schema' && (
                <>
                  {schema !== null && <pre className="json-pre">{schema}</pre>}
                  <p className="json-note">{t('tools:format.schemaNote')}</p>
                </>
              )}
              {view === 'stats' && rootStats !== null && <StatsView stats={rootStats} />}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function StatsView({ stats }: { stats: RootStats }) {
  const { t } = useTranslation()
  return (
    <div className="jstats">
      <div className="jstats-grid">
        <StatCard label={t('tools:format.stats.rootType')} value={stats.rootType} />
        <StatCard label={t('tools:format.stats.totalNodes')} value={String(stats.totalNodes)} />
        <StatCard label={t('tools:format.stats.maxDepth')} value={String(stats.maxDepth)} />
        <StatCard label={t('tools:format.stats.objects')} value={String(stats.objectCount)} />
        <StatCard label={t('tools:format.stats.arrays')} value={String(stats.arrayCount)} />
        <StatCard label={t('tools:format.stats.primitives')} value={String(stats.primitiveCount)} />
      </div>

      {stats.elementAnalysis && (
        <div className="jstats-block">
          <h4>{t('tools:format.stats.elementTypes')}</h4>
          <div className="jtype-row">
            {stats.elementAnalysis.typeCounts.map((tc) => (
              <span className="jelem" key={tc.type}>
                <span className={`jtype is-${tc.type}`}>{tc.type}</span>
                <span className="jtimes">×{tc.count}</span>
              </span>
            ))}
          </div>
          {stats.elementAnalysis.distinct && <DistinctBlock distinct={stats.elementAnalysis.distinct} />}
        </div>
      )}

      {stats.fieldStats && (
        <div className="jstats-block">
          <h4>{t('tools:format.stats.fields')}</h4>
          <div className="jtable-wrap">
            <table className="jtable">
              <thead>
                <tr>
                  <th>{t('tools:format.stats.field')}</th>
                  <th>{t('tools:format.stats.types')}</th>
                  <th>{t('tools:format.stats.present')}</th>
                  <th>{t('tools:format.stats.distinct')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.fieldStats.map((field) => (
                  <tr key={field.key}>
                    <td className="jtable-key">{field.key}</td>
                    <td>
                      <div className="jtype-row">
                        {field.typeCounts.map((tc) => (
                          <span className="jelem" key={tc.type}>
                            <span className={`jtype is-${tc.type}`}>{tc.type}</span>
                            <span className="jtimes">×{tc.count}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {field.present}/{stats.length ?? 1}
                    </td>
                    <td>{field.distinct ? <DistinctBlock distinct={field.distinct} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="jstat-card">
      <span className="jstat-value">{value}</span>
      <span className="jstat-label">{label}</span>
    </div>
  )
}

function DistinctBlock({ distinct }: { distinct: DistinctResult }) {
  const { t } = useTranslation()
  return (
    <div className="jdistinct">
      <div className="jdistinct-head">
        <span className={distinct.isEnum ? 'jdistinct-num is-enum' : 'jdistinct-num'}>
          {distinct.totalDistinct}
          {distinct.truncated ? '+' : ''}
        </span>
        {distinct.isEnum && <span className="jenum-badge">{t('tools:format.enumLabel')}</span>}
      </div>
      {distinct.values.length > 0 && (
        <div className="jenum-chips">
          {distinct.values.slice(0, DISTINCT_DISPLAY_LIMIT).map((dv) => (
            <span className="jchip" key={dv.display}>
              <span className="jchip-value">{dv.display}</span>
              <span className="jchip-count">×{dv.count}</span>
            </span>
          ))}
          {distinct.values.length > DISTINCT_DISPLAY_LIMIT && (
            <span className="jmore-note">
              {t('tools:format.tree.more', { count: distinct.values.length - DISTINCT_DISPLAY_LIMIT })}
            </span>
          )}
          {distinct.truncated && (
            <span className="jmore-note">{t('tools:format.truncatedNote', { count: MAX_DISTINCT_TRACKED })}</span>
          )}
        </div>
      )}
    </div>
  )
}