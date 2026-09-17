import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { compressSource, DEFAULT_QUALITY, formatBytes, type ImageSource } from './image'

interface Props {
  source: ImageSource
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

export default function ImagePicker({ source, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [result, setResult] = useState(() => compressSource(source, DEFAULT_QUALITY))

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResult(compressSource(source, quality))
    }, 120)
    return () => window.clearTimeout(timer)
  }, [source, quality])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const savings = useMemo(() => {
    if (source.originalSize === 0) return 0
    return Math.max(0, Math.round((1 - result.size / source.originalSize) * 100))
  }, [source.originalSize, result.size])

  const percent = Math.round(quality * 100)

  return (
    <div className="md-modal-overlay" role="dialog" aria-modal="true" aria-label={t('tools:markdown.imagePicker.title')}>
      <div className="md-modal">
        <div className="md-modal-head">
          <h3>{t('tools:markdown.imagePicker.title')}</h3>
          <button
            type="button"
            className="md-modal-close"
            onClick={onCancel}
            aria-label={t('tools:markdown.imagePicker.cancel')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="md-modal-body">
          <div className="md-img-preview">
            <img src={result.dataUrl} alt={t('tools:markdown.imagePicker.preview')} />
          </div>

          <div className="md-img-controls">
            <div className="md-img-row">
              <span>{t('tools:markdown.imagePicker.quality')}</span>
              <output>{percent}%</output>
            </div>
            <input
              className="md-range"
              type="range"
              min={10}
              max={100}
              value={percent}
              disabled={source.keepAsIs}
              onChange={(e) => setQuality(Number(e.target.value) / 100)}
              aria-label={t('tools:markdown.imagePicker.quality')}
            />

            <div className="md-img-row">
              <span>{t('tools:markdown.imagePicker.dimensions')}</span>
              <output>
                {result.width} × {result.height}
              </output>
            </div>
            <div className="md-img-row">
              <span>{t('tools:markdown.imagePicker.original')}</span>
              <output>{formatBytes(source.originalSize)}</output>
            </div>
            <div className="md-img-row">
              <span>{t('tools:markdown.imagePicker.compressed')}</span>
              <output>{formatBytes(result.size)}</output>
            </div>
            <div className="md-img-row">
              <span>{t('tools:markdown.imagePicker.saved')}</span>
              <output>{savings}%</output>
            </div>

            <p className="md-img-note">
              {source.keepAsIs
                ? t('tools:markdown.imagePicker.keepAsIs')
                : t('tools:markdown.imagePicker.embedNote')}
            </p>
          </div>
        </div>

        <div className="md-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('tools:markdown.imagePicker.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm(result.dataUrl)}>
            {t('tools:markdown.imagePicker.insert')}
          </button>
        </div>
      </div>
    </div>
  )
}