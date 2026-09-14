import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const GITHUB_URL = 'https://github.com/fakeoder/ztools'
const MAIN_SITE_URL = 'https://zkraft.cc'
const CONTACT_EMAIL = 'contact@zkraft.cc'

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  const productLinks = [
    { href: '/#features', label: t('common:nav.features') },
    { href: '/#tools', label: t('common:nav.tools') },
    { href: '/#pricing', label: t('common:nav.pricing') },
    { href: '/#faq', label: t('common:nav.faq') },
  ]
  const legalLinks = [
    { to: '/privacy', label: t('legal:privacy.title') },
    { to: '/terms', label: t('legal:terms.title') },
  ]
  const connectLinks = [
    { href: GITHUB_URL, label: t('common:github') },
    { href: MAIN_SITE_URL, label: 'zkraft.cc' },
    { href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL },
  ]

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="navbar-brand">
              <span className="navbar-logo" aria-hidden="true">
                z
              </span>
              <span className="navbar-name">{t('common:app')}</span>
            </Link>
            <p className="footer-tagline">{t('common:tagline')}</p>
          </div>

          <FooterColumn title={t('common:footer.product')}>
            {productLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </FooterColumn>

          <FooterColumn title={t('common:footer.legal')}>
            {legalLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title={t('common:footer.connect')}>
            {connectLinks.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </FooterColumn>
        </div>

        <div className="footer-bottom">
          <span>
            © {year} ztools. {t('common:footer.rights')}
          </span>
          <span>{t('common:footer.license')}</span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn(props: { title: string; children: ReactNode }) {
  return (
    <div className="footer-col">
      <h4>{props.title}</h4>
      <nav className="footer-links">{props.children}</nav>
    </div>
  )
}