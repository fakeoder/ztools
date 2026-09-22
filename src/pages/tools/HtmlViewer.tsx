import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_SIZE = 10 * 1024 * 1024

const VIEWPORTS = ['phone', 'tablet', 'desktop'] as const

type ViewportId = (typeof VIEWPORTS)[number]

const SAMPLE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sample page</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 1.5rem;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    background: #f8fafc;
    color: #0f172a;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    .card { background: #1e293b; }
  }
  h1 { margin: 0 0 0.5rem; font-size: 1.6rem; }
  p { margin: 0 0 1rem; color: #475569; }
  @media (prefers-color-scheme: dark) { p { color: #94a3b8; } }
  .card {
    display: block;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
  .card strong { display: block; margin-bottom: 0.25rem; }
  button {
    padding: 0.6rem 1.1rem;
    border: none;
    border-radius: 8px;
    background: #2563eb;
    color: #fff;
    font: inherit;
    font-weight: 600;
  }
  button:active { transform: scale(0.97); }
  output { display: block; margin-top: 0.75rem; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <h1>Hello from your HTML file</h1>
  <p>This page is rendered locally inside a sandboxed iframe — nothing was uploaded.</p>
  <div class="card">
    <strong>Interactive</strong>
    Scripts are allowed in the preview.
  </div>
  <div class="card">
    <strong>Mobile friendly</strong>
    Try the viewport presets above, or open this page in a new tab.
  </div>
  <button type="button" id="btn">Tap me</button>
  <output id="out">Taps: 0</output>
  <script>
    var n = 0
    document.getElementById('btn').addEventListener('click', function () {
      n += 1
      document.getElementById('out').textContent = 'Taps: ' + n
    })
  </script>
</body>
</html>
`

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${+(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function ensureViewport(html: string): string {
  if (/<meta\s+[^>]*name\s*=\s*["']viewport["']/i.test(html)) return html
  const meta = '<meta name="viewport" content="width=device-width, initial-scale=1">'
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${meta}`)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${meta}</head>`)
  return `${meta}\n${html}`
}

export default function HtmlViewer() {
  const { t } = useTranslation()
  const [html, setHtml] = useState('')
  const [filename, setFilename] = useState('')
  const [size, setSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<ViewportId>('phone')
  const [autoViewport, setAutoViewport] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const toolTags = useMemo(() => t('tools:html_viewer.tags', { returnObjects: true }) as string[], [t])

  const doc = useMemo(() => {
    if (!html) return ''
    return autoViewport ? ensureViewport(html) : html
  }, [html, autoViewport])

  const loadFile = useCallback(
    (file: File) => {
      setError(null)
      if (file.size > MAX_SIZE) {
        setError(t('tools:html_viewer.tooLarge', { size: formatSize(MAX_SIZE) }))
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setHtml(String(reader.result ?? ''))
        setFilename(file.name || 'index.html')
        setSize(file.size)
        setReloadKey((k) => k + 1)
        setFullscreen(false)
      }
      reader.onerror = () => setError(t('tools:html_viewer.readError'))
      reader.readAsText(file)
    },
    [t],
  )

  const loadSample = () => {
    setError(null)
    setHtml(SAMPLE)
    setFilename('sample.html')
    setSize(new Blob([SAMPLE]).size)
    setReloadKey((k) => k + 1)
    setFullscreen(false)
  }

  const handleClear = () => {
    setHtml('')
    setFilename('')
    setSize(0)
    setError(null)
    setFullscreen(false)
  }

  const openInTab = () => {
    if (!doc) return
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }))
    window.open(url, '_blank', 'noopener')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const downloadFile = () => {
    if (!doc) return
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'index.html'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  useEffect(() => {
    if (!fullscreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen])

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragging(false)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) loadFile(file)
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
          <h1>{t('tools:html_viewer.name')}</h1>
          <p>{t('tools:html_viewer.desc')}</p>
        </div>

        <div className="hv-body" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <div className="hv-toolbar">
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
              {t('tools:html_viewer.upload')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={loadSample}>
              {t('tools:html_viewer.sample')}
            </button>
            {html && (
              <>
                <button type="button" className="btn btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
                  {t('tools:html_viewer.reload')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={openInTab}>
                  {t('tools:html_viewer.openTab')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={downloadFile}>
                  {t('tools:html_viewer.download')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setFullscreen(true)}>
                  {t('tools:html_viewer.fullscreen')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleClear}>
                  {t('tools:html_viewer.clear')}
                </button>
                <span className="hv-meta" title={filename}>
                  {t('tools:html_viewer.stats', { name: filename, size: formatSize(size) })}
                </span>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,text/html"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) loadFile(file)
              e.target.value = ''
            }}
          />

          {error && <div className="json-error" role="alert">{error}</div>}

          {!html ? (
            <div className={`hv-drop${dragging ? ' is-drag' : ''}`}>
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18" />
                <path d="M10 13l-2 2 2 2" />
                <path d="M14 13l2 2-2 2" />
              </svg>
              <p className="hv-drop-title">{t('tools:html_viewer.dropTitle')}</p>
              <p className="hv-drop-hint">{t('tools:html_viewer.dropHint')}</p>
              <div className="hv-drop-actions">
                <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                  {t('tools:html_viewer.upload')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={loadSample}>
                  {t('tools:html_viewer.sample')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="hv-viewbar">
                <div className="json-tabs-btns" role="tablist" aria-label={t('tools:html_viewer.viewportsLabel')}>
                  {VIEWPORTS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={viewport === id}
                      className={viewport === id ? 'is-active' : ''}
                      onClick={() => setViewport(id)}
                    >
                      {t(`tools:html_viewer.viewports.${id}`)}
                    </button>
                  ))}
                </div>
                <label className="hv-check" title={t('tools:html_viewer.autoViewportHint')}>
                  <input
                    type="checkbox"
                    checked={autoViewport}
                    onChange={(e) => setAutoViewport(e.target.checked)}
                  />
                  {t('tools:html_viewer.autoViewport')}
                </label>
                <span className="hv-sandbox">{t('tools:html_viewer.sandboxNote')}</span>
              </div>

              {autoViewport && <p className="hv-hint">{t('tools:html_viewer.autoViewportHint')}</p>}

              <div className={`hv-stage${fullscreen ? ' is-fullscreen' : ''}`}>
                {fullscreen && (
                  <button type="button" className="btn btn-ghost hv-fs-exit" onClick={() => setFullscreen(false)}>
                    {t('tools:html_viewer.exitFullscreen')}
                  </button>
                )}
                <div className="hv-frame-wrap" data-viewport={fullscreen ? 'full' : viewport}>
                  <iframe
                    key={reloadKey}
                    className="hv-frame"
                    title={t('tools:html_viewer.previewLabel')}
                    srcDoc={doc}
                    sandbox="allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
