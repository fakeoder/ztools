import { useTranslation } from 'react-i18next'

const ICONS = {
  fast: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  privacy: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  free: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  lang: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  theme: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  device: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="14" height="16" rx="2" />
      <path d="M16 8h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4" />
      <path d="M6 19h6" />
    </svg>
  ),
}

const ORDER: Array<keyof typeof ICONS> = ['fast', 'privacy', 'free', 'lang', 'theme', 'device']

export default function Features() {
  const { t } = useTranslation()

  return (
    <section id="features" className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">{t('landing:features.title')}</h2>
          <p className="section-subtitle">{t('landing:features.subtitle')}</p>
        </div>
        <div className="feature-grid">
          {ORDER.map((key, index) => (
            <div className="feature-card" key={key}>
              <div className="feature-icon">{ICONS[key]}</div>
              <h3>{t(`landing:features.items.${index}.title`)}</h3>
              <p>{t(`landing:features.items.${index}.desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}