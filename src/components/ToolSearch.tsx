import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ALL_TAG, TOOLS, TOOL_TAGS } from './toolData'

export default function ToolSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string>(ALL_TAG)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter((tool) => {
      if (activeTag !== ALL_TAG && !tool.tags.includes(activeTag)) return false
      if (!q) return true
      const name = t(`tools:${tool.id}.name`).toLowerCase()
      const desc = t(`tools:${tool.id}.desc`).toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [query, activeTag, t])

  const select = (id: string) => {
    setOpen(false)
    navigate(`/${id}`)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      event.currentTarget.blur()
    } else if (event.key === 'Enter' && results.length > 0) {
      select(results[0].id)
    }
  }

  return (
    <div className="tool-search" ref={rootRef}>
      <svg className="tool-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        className="tool-search-input"
        type="search"
        value={query}
        placeholder={t('tools:search.placeholder')}
        aria-label={t('tools:search.placeholder')}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div className="tool-search-panel">
          <div className="tool-search-tags" role="group" aria-label={t('tools:search.all')}>
            <button
              type="button"
              className={activeTag === ALL_TAG ? 'is-active' : ''}
              onClick={() => setActiveTag(ALL_TAG)}
            >
              {t('tools:search.all')}
            </button>
            {TOOL_TAGS.map((tag) => (
              <button
                type="button"
                key={tag}
                className={activeTag === tag ? 'is-active' : ''}
                onClick={() => setActiveTag(tag)}
              >
                {t(`tools:tags.${tag}`)}
              </button>
            ))}
          </div>

          {results.length > 0 ? (
            <ul className="tool-search-results">
              {results.map((tool) => (
                <li key={tool.id}>
                  <button type="button" onClick={() => select(tool.id)}>
                    <span className="tool-search-result-icon">{tool.icon}</span>
                    <span className="tool-search-result-text">
                      <span className="tool-search-result-name">{t(`tools:${tool.id}.name`)}</span>
                      <span className="tool-search-result-desc">{t(`tools:${tool.id}.desc`)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tool-search-empty">{t('tools:search.empty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
