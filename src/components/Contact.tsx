import { useTranslation } from 'react-i18next'

const GITHUB_URL = 'https://github.com/fakeoder/ztools'
const MAIN_SITE_URL = 'https://zkraft.cc'
const CONTACT_EMAIL = 'contact@zkraft.cc'

export default function Contact() {
  const { t } = useTranslation()

  const cards = [
    {
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      ),
      title: t('landing:contact.email'),
      desc: t('landing:contact.emailDesc'),
      href: `mailto:${CONTACT_EMAIL}`,
      label: CONTACT_EMAIL,
      external: false,
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      title: t('landing:contact.site'),
      desc: t('landing:contact.siteDesc'),
      href: MAIN_SITE_URL,
      label: 'zkraft.cc',
      external: true,
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6a11.5 11.5 0 0 0 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
        </svg>
      ),
      title: t('landing:contact.github'),
      desc: t('landing:contact.githubDesc'),
      href: GITHUB_URL,
      label: 'fakeoder/ztools',
      external: true,
    },
  ]

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">{t('landing:contact.title')}</h2>
          <p className="section-subtitle">{t('landing:contact.subtitle')}</p>
        </div>
        <div className="contact-grid">
          {cards.map((card) => (
            <a
              key={card.href}
              className="contact-card"
              href={card.href}
              {...(card.external ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              <div className="feature-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
              <span className="contact-label">{card.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}