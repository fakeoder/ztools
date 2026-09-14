import { useTranslation } from 'react-i18next'

const GITHUB_URL = 'https://github.com/fakeoder/ztools'

export default function Hero() {
  const { t } = useTranslation()
  const stats = [
    { key: 'free', icon: 'free' },
    { key: 'privacy', icon: 'privacy' },
    { key: 'open', icon: 'open' },
  ]

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-inner">
          <span className="badge">{t('landing:hero.badge')}</span>
          <h1 className="hero-title">
            {t('landing:hero.title1')}
            <br />
            <span className="gradient-text">{t('landing:hero.title2')}</span>
          </h1>
          <p className="hero-subtitle">{t('landing:hero.subtitle')}</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#tools">
              {t('landing:hero.cta')}
            </a>
            <a className="btn btn-ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
              {t('landing:hero.github')}
            </a>
          </div>
          <ul className="hero-stats">
            {stats.map((stat) => (
              <li key={stat.key}>
                <CheckIcon />
                {t(`landing:hero.stats.${stat.key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}