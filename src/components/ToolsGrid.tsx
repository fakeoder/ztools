import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const TOOLS = [
  {
    id: 'json_diff',
    tag: 'data',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    id: 'json_format',
    tag: 'data',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: 'timestamp',
    tag: 'time',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
]

const ALL_TAG = '__all__'

export default function ToolsGrid() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string>(ALL_TAG)

  const tags = useMemo(() => Array.from(new Set(TOOLS.map((tool) => tool.tag))), [])

  const visibleTools = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter((tool) => {
      if (activeTag !== ALL_TAG && tool.tag !== activeTag) return false
      if (!q) return true
      const name = t(`tools:${tool.id}.name`).toLowerCase()
      const desc = t(`tools:${tool.id}.desc`).toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [query, activeTag, t])

  return (
    <section id="tools" className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">{t('landing:tools.title')}</h2>
          <p className="section-subtitle">{t('landing:tools.subtitle')}</p>
        </div>

        <div className="tools-filters">
          <input
            className="tools-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tools:search.placeholder')}
            aria-label={t('tools:search.placeholder')}
          />
          <div className="tools-tags" role="group" aria-label={t('tools:search.all')}>
            <button
              type="button"
              className={activeTag === ALL_TAG ? 'is-active' : ''}
              onClick={() => setActiveTag(ALL_TAG)}
            >
              {t('tools:search.all')}
            </button>
            {tags.map((tag) => (
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
        </div>

        {visibleTools.length > 0 ? (
          <div className="tools-grid">
            {visibleTools.map((tool) => (
              <Link to={`/${tool.id}`} className="tool-card" key={tool.id}>
                <div className="tool-card-top">
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-tag">{t(`tools:tags.${tool.tag}`)}</span>
                </div>
                <h3>{t(`tools:${tool.id}.name`)}</h3>
                <p>{t(`tools:${tool.id}.desc`)}</p>
                <span className="tool-cta">
                  {t('landing:tools.open')}
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="tools-empty">{t('tools:search.empty')}</p>
        )}
        <p className="tools-note">{t('landing:tools.comingSoon')}</p>
      </div>
    </section>
  )
}