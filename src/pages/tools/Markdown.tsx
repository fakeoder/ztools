import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyAction, insertImage, type MdActionId } from './markdown/actions'
import { downloadMarkdown, exportPdf } from './markdown/export'
import { loadImageSource, type ImageSource } from './markdown/image'
import ImagePicker from './markdown/ImagePicker'
import { renderPreview } from './markdown/render'

const SAMPLE = `# Markdown Editor

Write **Markdown** on the left and see the *live preview* on the right. Everything runs locally in your browser.

## Common syntax

> A blockquote for emphasis.

- Bullet list item
- Another item

1. Ordered item
2. Second item

- [x] Task done
- [ ] Task pending

### Table

| Feature | Supported |
| --- | --- |
| Tables | Yes |
| Mermaid | Yes |
| Export | PDF / MD |

### Code

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`
}
\`\`\`

### Diagram

\`\`\`mermaid
graph TD
  A[Write Markdown] --> B{Preview}
  B -->|Export| C[PDF]
  B -->|Export| D[.md]
\`\`\`

Learn more about [Markdown](https://commonmark.org).
`

const ACTION_GROUPS: MdActionId[][] = [
  ['heading1', 'heading2', 'heading3'],
  ['bold', 'italic', 'strikethrough', 'inlineCode'],
  ['link', 'image'],
  ['quote', 'bulletList', 'orderedList', 'taskList'],
  ['codeBlock', 'table', 'mermaid', 'horizontalRule'],
]

type ViewMode = 'edit' | 'split' | 'preview'

const VIEW_MODES: ViewMode[] = ['edit', 'split', 'preview']

export default function Markdown() {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [view, setView] = useState<ViewMode>('split')
  const [filename, setFilename] = useState('document.md')
  const [error, setError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  const tokenRef = useRef(0)
  const [imageMenu, setImageMenu] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [pendingImage, setPendingImage] = useState<{
    source: ImageSource
    alt: string
    start: number
    end: number
  } | null>(null)

  const toolTags = useMemo(() => t('tools:markdown.tags', { returnObjects: true }) as string[], [t])

  const stats = useMemo(
    () => ({ chars: value.length, lines: value.length === 0 ? 0 : value.split('\n').length }),
    [value],
  )

  const runPreview = useCallback(() => {
    const container = previewRef.current
    if (!container) return
    const token = ++tokenRef.current
    void renderPreview(container, valueRef.current, token, () => token !== tokenRef.current)
  }, [])

  useEffect(() => {
    valueRef.current = value
    const timer = window.setTimeout(runPreview, 160)
    return () => window.clearTimeout(timer)
  }, [value, runPreview])

  useEffect(() => {
    const observer = new MutationObserver(runPreview)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [runPreview])

  useEffect(() => {
    if (!imageMenu) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const wrap = document.querySelector('.md-tool-wrap')
      if (wrap && !wrap.contains(target)) setImageMenu(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [imageMenu])

  useEffect(() => {
    if (!pendingImage) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [pendingImage])

  const insert = (id: MdActionId) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const result = applyAction(id, value, start, end)
    setValue(result.text)
    window.requestAnimationFrame(() => {
      const target = textareaRef.current
      if (!target) return
      target.focus()
      target.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  const handleImageFile = (file: File) => {
    setImageMenu(false)
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const selected = value.slice(start, end)
    const alt = (selected || file.name || 'image').replace(/\.[a-z0-9]+$/i, '')
    setImageBusy(true)
    loadImageSource(file)
      .then((source) => setPendingImage({ source, alt, start, end }))
      .catch(() => setError(t('tools:markdown.imageError')))
      .finally(() => setImageBusy(false))
  }

  const confirmImage = (dataUrl: string) => {
    if (!pendingImage) return
    const { alt, start, end } = pendingImage
    const result = insertImage(valueRef.current, start, end, alt, dataUrl)
    valueRef.current = result.text
    setValue(result.text)
    setPendingImage(null)
    window.requestAnimationFrame(() => {
      const target = textareaRef.current
      if (!target) return
      target.focus()
      target.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  const insertImageUrl = () => {
    setImageMenu(false)
    insert('image')
  }

  const handleFile = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setValue(text)
      valueRef.current = text
      if (file.name) setFilename(file.name)
    }
    reader.onerror = () => setError(t('tools:markdown.readError'))
    reader.readAsText(file)
  }

  const handleExportPdf = () => {
    const container = previewRef.current
    if (!container || value.trim() === '') return
    exportPdf(container.innerHTML, filename.replace(/\.(md|markdown|txt)$/i, '') || 'markdown')
  }

  const handleClear = () => {
    setValue('')
    valueRef.current = ''
    setError(null)
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
          <h1>{t('tools:markdown.name')}</h1>
          <p>{t('tools:markdown.desc')}</p>
        </div>

        <div className="md-actions">
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            {t('tools:markdown.upload')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => downloadMarkdown(value, filename)} disabled={value.trim() === ''}>
            {t('tools:markdown.exportMd')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleExportPdf} disabled={value.trim() === ''}>
            {t('tools:markdown.exportPdf')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setValue(SAMPLE)}>
            {t('tools:markdown.sample')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleClear}>
            {t('tools:markdown.clear')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageFile(file)
              e.target.value = ''
            }}
          />
          {imageBusy && <span className="md-busy">{t('tools:markdown.imageBusy')}</span>}
        </div>

        {error && <div className="json-error" role="alert">{error}</div>}

        <div className="md-viewbar">
          <div className="json-tabs-btns" role="tablist" aria-label={t('tools:markdown.viewsLabel')}>
            {VIEW_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={view === mode}
                className={view === mode ? 'is-active' : ''}
                onClick={() => setView(mode)}
              >
                {t(`tools:markdown.views.${mode}`)}
              </button>
            ))}
          </div>
          <span className="md-stats">
            {t('tools:markdown.stats', { chars: stats.chars, lines: stats.lines })}
          </span>
        </div>

        <div className="md-workspace" data-view={view}>
          <div className="md-pane md-pane-editor">
            <div className="md-edit-toolbar" role="toolbar" aria-label={t('tools:markdown.editorLabel')}>
              {ACTION_GROUPS.map((group, groupIndex) => (
                <Fragment key={groupIndex}>
                  {groupIndex > 0 && <span className="md-tool-sep" aria-hidden="true" />}
                  {group.map((id) =>
                    id === 'image' ? (
                      <div className="md-tool-wrap" key={id}>
                        <button
                          type="button"
                          className="md-tool-btn"
                          data-action="image"
                          title={t(`tools:markdown.actions.${id}`)}
                          aria-label={t(`tools:markdown.actions.${id}`)}
                          aria-expanded={imageMenu}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setImageMenu((open) => !open)}
                        >
                          {t(`tools:markdown.actions.${id}`)}
                        </button>
                        {imageMenu && (
                          <div className="md-tool-popover" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={insertImageUrl}
                              disabled={imageBusy}
                            >
                              {t('tools:markdown.imageUrl')}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setImageMenu(false)
                                imageFileRef.current?.click()
                              }}
                              disabled={imageBusy}
                            >
                              {imageBusy ? t('tools:markdown.imageBusy') : t('tools:markdown.imagePhoto')}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        key={id}
                        type="button"
                        className="md-tool-btn"
                        data-action={id}
                        title={t(`tools:markdown.actions.${id}`)}
                        aria-label={t(`tools:markdown.actions.${id}`)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insert(id)}
                      >
                        {t(`tools:markdown.actions.${id}`)}
                      </button>
                    ),
                  )}
                </Fragment>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="md-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('tools:markdown.placeholder')}
              spellCheck={false}
            />
          </div>

          <div className="md-pane md-pane-preview">
            <div className="md-preview" ref={previewRef} />
            {value.trim() === '' && <p className="md-empty">{t('tools:markdown.emptyState')}</p>}
          </div>
        </div>
      </div>

      {pendingImage && (
        <ImagePicker
          source={pendingImage.source}
          onConfirm={confirmImage}
          onCancel={() => setPendingImage(null)}
        />
      )}
    </section>
  )
}
