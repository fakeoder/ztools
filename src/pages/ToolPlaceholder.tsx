import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NotFound from './NotFound'

const KNOWN_TOOLS = ['json_diff', 'text_diff', 'json_format', 'timestamp'] as const

export default function ToolPlaceholder() {
  const { toolId } = useParams()
  const { t } = useTranslation()

  if (!toolId || !KNOWN_TOOLS.includes(toolId as (typeof KNOWN_TOOLS)[number])) {
    return <NotFound />
  }

  return (
    <section className="section tool-placeholder">
      <div className="container container-narrow">
        <div className="tool-placeholder-inner">
          <span className="badge">{t(`tools:tags.${t(`tools:${toolId}.tag`)}`)}</span>
          <h1>{t(`tools:${toolId}.name`)}</h1>
          <p className="tool-placeholder-desc">{t(`tools:${toolId}.desc`)}</p>
          <span className="tool-placeholder-status">
            <span className="status-dot" />
            {t('tools:placeholder.status')}
          </span>
          <p className="tool-placeholder-message">{t('tools:placeholder.message')}</p>
          <Link className="btn btn-primary" to="/#tools">
            {t('tools:placeholder.back')}
          </Link>
        </div>
      </div>
    </section>
  )
}