import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FONTS, availableWeight, getFont, type FontCategory, type FontWeight } from './favicon/fonts'
import { GRADIENT_PRESETS, randomHexColor, randomPreset } from './favicon/palettes'
import {
  buildIco,
  buildSvg,
  renderIcon,
  renderPngBlob,
  type BgMode,
  type GradientType,
  type IconConfig,
  type Shape,
} from './favicon/render'

const PREVIEW_RENDER_SIZE = 512
const PREVIEW_CSS_SIZE = 256
const EXPORT_SIZES = [16, 32, 48, 64, 128, 180, 192, 512]
const FONT_CATEGORIES: FontCategory[] = ['sans', 'serif', 'display', 'script', 'mono']

const fontBase64Cache = new Map<string, string>()

async function fetchBase64(url: string): Promise<string | null> {
  const cached = fontBase64Cache.get(url)
  if (cached) return cached
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    const b64 = btoa(bin)
    fontBase64Cache.set(url, b64)
    return b64
  } catch {
    return null
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function downloadText(content: string, name: string, type: string) {
  download(new Blob([content], { type }), name)
}

export default function Favicon() {
  const { t } = useTranslation()

  const [text, setText] = useState('A')
  const [uppercase, setUppercase] = useState(true)
  const [fontId, setFontId] = useState('inter')
  const [weightState, setWeightState] = useState<FontWeight>(700)
  const [sizePercent, setSizePercent] = useState(68)
  const [textColor, setTextColor] = useState('#ffffff')
  const [shape, setShape] = useState<Shape>('rounded')
  const [bgMode, setBgMode] = useState<BgMode>('gradient')
  const [bgColor, setBgColor] = useState('#6366f1')
  const [gradType, setGradType] = useState<GradientType>('linear')
  const [gradAngle, setGradAngle] = useState(135)
  const [gradColorA, setGradColorA] = useState('#6366f1')
  const [gradColorB, setGradColorB] = useState('#22d3ee')
  const [previewDark, setPreviewDark] = useState(false)

  const [busy, setBusy] = useState(false)
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)

  const font = useMemo(() => getFont(fontId), [fontId])
  const weight = useMemo(() => availableWeight(font, weightState), [font, weightState])

  const config = useMemo<IconConfig>(
    () => ({
      text: uppercase ? text.toUpperCase() : text,
      fontFamily: font.family,
      weight,
      sizePercent,
      textColor,
      shape,
      bgMode,
      bgColor,
      gradType,
      gradAngle,
      gradColorA,
      gradColorB,
    }),
    [text, uppercase, font.family, weight, sizePercent, textColor, shape, bgMode, bgColor, gradType, gradAngle, gradColorA, gradColorB],
  )

  useEffect(() => {
    const canvas = mainCanvasRef.current
    if (!canvas) return
    renderIcon(canvas, config, PREVIEW_RENDER_SIZE).catch(() => {
      // ignore render errors
    })
  }, [config])

  const handleSvgExport = useCallback(async () => {
    const url = font.weights[weight]
    const b64 = url ? await fetchBase64(url) : null
    downloadText(buildSvg(config, 512, b64), 'favicon.svg', 'image/svg+xml')
  }, [config, font, weight])

  const handlePngExport = useCallback(async () => {
    setBusy(true)
    try {
      const blob = await renderPngBlob(config, 512)
      download(blob, 'favicon-512.png')
    } finally {
      setBusy(false)
    }
  }, [config])

  const handleIcoExport = useCallback(async () => {
    setBusy(true)
    try {
      const blob = await buildIco(config)
      download(blob, 'favicon.ico')
    } finally {
      setBusy(false)
    }
  }, [config])

  const handleSizeDownload = useCallback(
    async (size: number) => {
      const blob = await renderPngBlob(config, size)
      download(blob, `favicon-${size}.png`)
    },
    [config],
  )

  const randomizeStart = () => setGradColorA(randomHexColor())
  const randomizeEnd = () => setGradColorB(randomHexColor())
  const applyPreset = (from: string, to: string) => {
    setBgMode('gradient')
    setGradColorA(from)
    setGradColorB(to)
  }
  const randomizeCombo = () => {
    const preset = randomPreset()
    applyPreset(preset.from, preset.to)
  }

  const toolTags = useMemo(() => t('tools:favicon.tags', { returnObjects: true }) as string[], [t])

  return (
    <section className="section tool-page">
      <div className="container">
        <div className="tool-page-head">
          <div className="tool-page-badges">
            {toolTags.map((tag) => (
              <span className="badge" key={tag}>{t(`tools:tags.${tag}`)}</span>
            ))}
          </div>
          <h1>{t('tools:favicon.name')}</h1>
          <p>{t('tools:favicon.desc')}</p>
        </div>

        <div className="fav-layout">
          <div className="fav-panel fav-controls">
            <div className="fav-panel-title">{t('tools:favicon.designLabel')}</div>

            <div className="fav-control-row">
              <label className="fav-control-label" htmlFor="fav-text">{t('tools:favicon.textLabel')}</label>
              <input
                id="fav-text"
                className="fav-text-input"
                value={text}
                maxLength={3}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
              <label className="fav-check">
                <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
                <span>{t('tools:favicon.uppercase')}</span>
              </label>
            </div>

            <div className="fav-control-row">
              <label className="fav-control-label" htmlFor="fav-font">{t('tools:favicon.fontLabel')}</label>
              <select id="fav-font" className="fav-select" value={fontId} onChange={(e) => setFontId(e.target.value)}>
                {FONT_CATEGORIES.map((cat) => (
                  <optgroup key={cat} label={t(`tools:favicon.fontCategories.${cat}`)}>
                    {FONTS.filter((f) => f.category === cat).map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="fav-control-row">
              <span className="fav-control-label">{t('tools:favicon.weightLabel')}</span>
              <div className="fav-seg">
                <button type="button" className={`fav-seg-btn ${weight === 400 ? 'is-active' : ''}`} onClick={() => setWeightState(400)}>
                  {t('tools:favicon.weightRegular')}
                </button>
                <button
                  type="button"
                  className={`fav-seg-btn ${weight === 700 ? 'is-active' : ''}`}
                  disabled={!font.weights[700]}
                  onClick={() => setWeightState(700)}
                >
                  {t('tools:favicon.weightBold')}
                </button>
              </div>
            </div>

            <div className="fav-control-row">
              <label className="fav-control-label" htmlFor="fav-size">{t('tools:favicon.sizeLabel')}</label>
              <input
                id="fav-size"
                className="fav-range"
                type="range"
                min={30}
                max={95}
                value={sizePercent}
                onChange={(e) => setSizePercent(Number(e.target.value))}
              />
              <span className="fav-value">{sizePercent}%</span>
            </div>

            <div className="fav-control-row">
              <label className="fav-control-label" htmlFor="fav-color">{t('tools:favicon.textColor')}</label>
              <input id="fav-color" className="fav-color" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            </div>

            <div className="fav-control-row">
              <span className="fav-control-label">{t('tools:favicon.shapeLabel')}</span>
              <div className="fav-seg">
                {(['square', 'rounded', 'circle'] as Shape[]).map((s) => (
                  <button key={s} type="button" className={`fav-seg-btn ${shape === s ? 'is-active' : ''}`} onClick={() => setShape(s)}>
                    {t(`tools:favicon.shape${s[0].toUpperCase()}${s.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="fav-control-row">
              <span className="fav-control-label">{t('tools:favicon.backgroundLabel')}</span>
              <div className="fav-seg">
                <button type="button" className={`fav-seg-btn ${bgMode === 'solid' ? 'is-active' : ''}`} onClick={() => setBgMode('solid')}>
                  {t('tools:favicon.bgSolid')}
                </button>
                <button type="button" className={`fav-seg-btn ${bgMode === 'gradient' ? 'is-active' : ''}`} onClick={() => setBgMode('gradient')}>
                  {t('tools:favicon.bgGradient')}
                </button>
              </div>
            </div>

            {bgMode === 'solid' ? (
              <div className="fav-control-row">
                <label className="fav-control-label" htmlFor="fav-bg">{t('tools:favicon.bgColor')}</label>
                <input id="fav-bg" className="fav-color" type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </div>
            ) : (
              <>
                <div className="fav-control-row">
                  <span className="fav-control-label">{t('tools:favicon.gradientType')}</span>
                  <div className="fav-seg">
                    <button type="button" className={`fav-seg-btn ${gradType === 'linear' ? 'is-active' : ''}`} onClick={() => setGradType('linear')}>
                      {t('tools:favicon.gradLinear')}
                    </button>
                    <button type="button" className={`fav-seg-btn ${gradType === 'radial' ? 'is-active' : ''}`} onClick={() => setGradType('radial')}>
                      {t('tools:favicon.gradRadial')}
                    </button>
                  </div>
                </div>
                {gradType === 'linear' && (
                  <div className="fav-control-row">
                    <label className="fav-control-label" htmlFor="fav-angle">{t('tools:favicon.angle')}</label>
                    <input
                      id="fav-angle"
                      className="fav-range"
                      type="range"
                      min={0}
                      max={360}
                      value={gradAngle}
                      onChange={(e) => setGradAngle(Number(e.target.value))}
                    />
                    <span className="fav-value">{gradAngle}°</span>
                  </div>
                )}
                <div className="fav-control-row">
                  <label className="fav-control-label" htmlFor="fav-grad-a">{t('tools:favicon.colorStart')}</label>
                  <input id="fav-grad-a" className="fav-color" type="color" value={gradColorA} onChange={(e) => setGradColorA(e.target.value)} />
                  <button
                    type="button"
                    className="fav-icon-btn"
                    title={t('tools:favicon.randomColor')}
                    aria-label={t('tools:favicon.randomColor')}
                    onClick={randomizeStart}
                  >
                    <ShuffleIcon />
                  </button>
                </div>
                <div className="fav-control-row">
                  <label className="fav-control-label" htmlFor="fav-grad-b">{t('tools:favicon.colorEnd')}</label>
                  <input id="fav-grad-b" className="fav-color" type="color" value={gradColorB} onChange={(e) => setGradColorB(e.target.value)} />
                  <button
                    type="button"
                    className="fav-icon-btn"
                    title={t('tools:favicon.randomColor')}
                    aria-label={t('tools:favicon.randomColor')}
                    onClick={randomizeEnd}
                  >
                    <ShuffleIcon />
                  </button>
                </div>
                <div className="fav-control-row fav-presets-row">
                  <span className="fav-control-label">{t('tools:favicon.presets')}</span>
                  <div className="fav-presets">
                    {GRADIENT_PRESETS.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        className="fav-preset"
                        style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                        title={t(`tools:favicon.paletteNames.${preset.id}`)}
                        aria-label={t(`tools:favicon.paletteNames.${preset.id}`)}
                        onClick={() => applyPreset(preset.from, preset.to)}
                      />
                    ))}
                    <button
                      type="button"
                      className="fav-preset-random"
                      title={t('tools:favicon.randomCombo')}
                      aria-label={t('tools:favicon.randomCombo')}
                      onClick={randomizeCombo}
                    >
                      <ShuffleIcon />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="fav-panel fav-preview">
            <div className="fav-preview-head">
              <span className="fav-panel-title">{t('tools:favicon.previewLabel')}</span>
              <div className="fav-seg">
                <button type="button" className={`fav-seg-btn ${!previewDark ? 'is-active' : ''}`} onClick={() => setPreviewDark(false)}>
                  {t('tools:favicon.previewLight')}
                </button>
                <button type="button" className={`fav-seg-btn ${previewDark ? 'is-active' : ''}`} onClick={() => setPreviewDark(true)}>
                  {t('tools:favicon.previewDark')}
                </button>
              </div>
            </div>

            <div className={`fav-preview-main ${previewDark ? 'is-dark' : ''}`}>
              <canvas
                ref={mainCanvasRef}
                className="fav-preview-canvas"
                style={{ width: PREVIEW_CSS_SIZE, height: PREVIEW_CSS_SIZE }}
              />
            </div>

            <div className="fav-sizes">
              {EXPORT_SIZES.map((size) => (
                <button type="button" className="fav-size-item" key={size} onClick={() => handleSizeDownload(size)} title={`${size}×${size}`}>
                  <SizePreview config={config} size={size} />
                  <span className="fav-size-label">{size}×{size}</span>
                </button>
              ))}
            </div>

            <div className="fav-exports">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={handleSvgExport}>
                {t('tools:favicon.exportSvg')}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={handlePngExport}>
                {t('tools:favicon.exportPng')}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={handleIcoExport}>
                {t('tools:favicon.exportIco')}
              </button>
            </div>
            <p className="fav-export-hint">{t('tools:favicon.exportHint')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 14 4 4-4 4" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
      <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
      <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
    </svg>
  )
}

function SizePreview({ config, size }: { config: IconConfig; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    renderIcon(canvas, config, size).catch(() => {
      // ignore
    })
  }, [config, size])
  return <canvas ref={ref} className="fav-size-canvas" style={{ width: size, height: size }} />
}
