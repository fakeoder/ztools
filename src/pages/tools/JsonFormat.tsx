import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LineNumberedTextarea from '../../components/LineNumberedTextarea'
import JsonTree from './json/JsonTree'
import { generateSchema } from './json/schema'
import type { JsonValue } from './json/analyze'
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

type ViewMode = 'tree' | 'compact' | 'schema'

const VIEW_MODES: ViewMode[] = ['tree', 'compact', 'schema']

export default function JsonFormat() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<JsonValue | null>(null)
  const [view, setView] = useState<ViewMode>('tree')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const toolTags = useMemo(() => t('tools:json_format.tags', { returnObjects: true }) as string[], [t])

  const schema = useMemo(
    () => (data !== null && view === 'schema' ? generateSchema(data) : null),
    [data, view],
  )

  const textOutput = useMemo(() => {
    if (view !== 'compact' || data === null) return ''
    return JSON.stringify(data)
  }, [data, view])

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

  return (
    <section className="section tool-page">
      <div className="container">
        <div className="tool-page-head">
          <div className="tool-page-badges">
            {toolTags.map((tag) => (
              <span className="badge" key={tag}>{t(`tools:tags.${tag}`)}</span>
            ))}
          </div>
          <h1>{t('tools:json_format.name')}</h1>
          <p>{t('tools:json_format.desc')}</p>
        </div>

        <div className="json-toolbar">
          <LineNumberedTextarea
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
              {view === 'compact' && (
                <button
                  type="button"
                  className="jtoolbar-copy"
                  onClick={() => copyText(textOutput)}
                  aria-label={t('tools:format.copy')}
                  title={copied ? t('tools:format.copied') : t('tools:format.copy')}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              )}
            </div>

            <div className="json-view">
              {view === 'tree' && <JsonTree data={data} />}
              {view === 'compact' && <pre className="json-pre json-pre-compact">{textOutput}</pre>}
              {view === 'schema' && (
                <>
                  {schema !== null && <JsonTree data={schema as JsonValue} mode="schema" />}
                  <p className="json-note">{t('tools:format.schemaNote')}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}