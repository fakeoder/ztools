import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ALL_TAG, TOOLS, TOOL_TAGS } from './toolData'

export default function ToolsGrid() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string>(ALL_TAG)

  const visibleTools = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter((tool) => {
      if (activeTag !== ALL_TAG && !tool.tags.includes(activeTag)) return false
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
        </div>

        {visibleTools.length > 0 ? (
          <div className="tools-grid">
            {visibleTools.map((tool) => (
              <Link to={`/${tool.id}`} className="tool-card" key={tool.id}>
                <div className="tool-card-top">
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-card-tags">
                    {tool.tags.map((tag) => (
                      <span className="tool-tag" key={tag}>
                        {t(`tools:tags.${tag}`)}
                      </span>
                    ))}
                  </span>
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