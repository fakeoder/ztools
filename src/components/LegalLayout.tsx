import { useTranslation } from 'react-i18next'

type Section = {
  heading: string
  paragraphs: string[]
}

export default function LegalLayout(props: {
  titleKey: string
  introKey: string
  sectionsKey: string
}) {
  const { t } = useTranslation('legal')
  const sections = t(props.sectionsKey, { returnObjects: true }) as Section[]

  return (
    <section className="section legal">
      <div className="container container-narrow">
        <div className="section-head">
          <h1 className="section-title">{t(props.titleKey)}</h1>
          <p className="section-subtitle">
            {t('legal:updated')}: {new Date().toLocaleDateString()}
          </p>
        </div>
        <p className="legal-intro">{t(props.introKey)}</p>
        {sections.map((section) => (
          <div className="legal-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}