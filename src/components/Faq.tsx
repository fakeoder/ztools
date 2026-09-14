import { useTranslation } from 'react-i18next'

export default function Faq() {
  const { t } = useTranslation()
  const items = t('landing:faq.items', { returnObjects: true }) as Array<{
    q: string
    a: string
  }>

  return (
    <section id="faq" className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">{t('landing:faq.title')}</h2>
          <p className="section-subtitle">{t('landing:faq.subtitle')}</p>
        </div>
        <div className="faq-list">
          {items.map((item, index) => (
            <details className="faq-item" key={index}>
              <summary>
                {item.q}
                <span className="faq-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}