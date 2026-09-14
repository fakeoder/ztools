import { useTranslation } from 'react-i18next'

export default function Pricing() {
  const { t } = useTranslation()
  const features = t('landing:pricing.features', { returnObjects: true }) as string[]

  return (
    <section id="pricing" className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">{t('landing:pricing.title')}</h2>
          <p className="section-subtitle">{t('landing:pricing.subtitle')}</p>
        </div>

        <div className="pricing-plan">
          <div className="pricing-plan-head">
            <h3>{t('landing:pricing.planName')}</h3>
            <div className="pricing-price">
              <span className="pricing-amount">{t('landing:pricing.price')}</span>
              <span className="pricing-period">{t('landing:pricing.period')}</span>
            </div>
          </div>
          <ul className="pricing-features">
            {features.map((feature) => (
              <li key={feature}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
          <a className="btn btn-primary btn-block" href="#tools">
            {t('landing:pricing.cta')}
          </a>
          <p className="pricing-note">{t('landing:pricing.note')}</p>
        </div>
      </div>
    </section>
  )
}