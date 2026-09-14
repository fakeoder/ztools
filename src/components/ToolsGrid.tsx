import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const TOOLS = [
  {
    id: 'json_diff',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    id: 'json_format',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: 'timestamp',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
]

export default function ToolsGrid() {
  const { t } = useTranslation()

  return (
    <section id="tools" className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">{t('landing:tools.title')}</h2>
          <p className="section-subtitle">{t('landing:tools.subtitle')}</p>
        </div>
        <div className="tools-grid">
          {TOOLS.map((tool) => (
            <Link to={`/${tool.id}`} className="tool-card" key={tool.id}>
              <div className="tool-card-top">
                <span className="tool-icon">{tool.icon}</span>
                <span className="tool-tag">{t(`tools:${tool.id}.tag`)}</span>
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
        <p className="tools-note">{t('landing:tools.comingSoon')}</p>
      </div>
    </section>
  )
}