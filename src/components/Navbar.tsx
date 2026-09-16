import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getInitialTheme, setTheme, type Theme } from '../theme'
import ToolSearch from './ToolSearch'

const GITHUB_URL = 'https://github.com/fakeoder/ztools'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const [theme, setCurrentTheme] = useState<Theme>(getInitialTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    setCurrentTheme(next)
  }

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng)
  }

  const closeMenu = () => setMenuOpen(false)

  const goToSection = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault()
    closeMenu()
    const hash = href.split('#')[1]
    const path = href.split('#')[0] || '/'
    if (location.pathname === path) {
      if (hash) {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } else {
      navigate(href)
    }
  }

  const navLinks = [
    { href: '/#features', label: t('common:nav.features') },
    { href: '/#tools', label: t('common:nav.tools') },
    { href: '/#pricing', label: t('common:nav.pricing') },
    { href: '/#faq', label: t('common:nav.faq') },
  ]

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <span className="navbar-logo" aria-hidden="true">
            z
          </span>
          <span className="navbar-name">{t('common:app')}</span>
        </Link>

        <nav className={`navbar-menu${menuOpen ? ' is-open' : ''}`}>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={(event) => goToSection(event, link.href)}>
              {link.label}
            </a>
          ))}
          <div className="navbar-mobile-search">
            <ToolSearch />
          </div>
          <div className="navbar-mobile-actions">
            <NavActions theme={theme} onToggleTheme={toggleTheme} i18n={i18n} onLang={changeLanguage} />
          </div>
        </nav>

        <div className="navbar-actions">
          <ToolSearch />
          <NavActions theme={theme} onToggleTheme={toggleTheme} i18n={i18n} onLang={changeLanguage} />
          <a
            className="btn btn-primary btn-sm"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t('common:github')}
          </a>
        </div>

        <button
          type="button"
          className="navbar-burger"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  )
}

function NavActions(props: {
  theme: Theme
  onToggleTheme: () => void
  i18n: { language: string }
  onLang: (lng: string) => void
}) {
  const { t } = useTranslation()
  const current = props.i18n.language
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label={props.theme === 'light' ? t('common:theme.dark') : t('common:theme.light')}
        title={props.theme === 'light' ? t('common:theme.dark') : t('common:theme.light')}
        onClick={props.onToggleTheme}
      >
        {props.theme === 'light' ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </button>

      <div className="lang-switch" role="group" aria-label={t('common:language')}>
        <button
          type="button"
          className={current.startsWith('en') ? 'is-active' : ''}
          onClick={() => props.onLang('en')}
        >
          EN
        </button>
        <button
          type="button"
          className={current.startsWith('zh') ? 'is-active' : ''}
          onClick={() => props.onLang('zh-CN')}
        >
          中
        </button>
      </div>
    </>
  )
}