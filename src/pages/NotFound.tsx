import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <section className="section tool-placeholder">
      <div className="container container-narrow">
        <div className="tool-placeholder-inner">
          <span className="badge">404</span>
          <h1>{t('common:notFound.title')}</h1>
          <p className="tool-placeholder-message">{t('common:notFound.message')}</p>
          <Link className="btn btn-primary" to="/">
            {t('common:backHome')}
          </Link>
        </div>
      </div>
    </section>
  )
}