import type { FontWeight } from './fonts'

export type Shape = 'square' | 'rounded' | 'circle'
export type BgMode = 'solid' | 'gradient'
export type GradientType = 'linear' | 'radial'

export interface IconConfig {
  text: string
  fontFamily: string
  weight: FontWeight
  sizePercent: number
  textColor: string
  shape: Shape
  bgMode: BgMode
  bgColor: string
  gradType: GradientType
  gradAngle: number
  gradColorA: string
  gradColorB: string
}

export function borderRadius(size: number, shape: Shape): number {
  if (shape === 'circle') return size / 2
  if (shape === 'rounded') return size * 0.2
  return 0
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (r <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fillBackground(ctx: CanvasRenderingContext2D, config: IconConfig, size: number) {
  if (config.bgMode === 'gradient') {
    if (config.gradType === 'radial') {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.72)
      g.addColorStop(0, config.gradColorA)
      g.addColorStop(1, config.gradColorB)
      ctx.fillStyle = g
    } else {
      const rad = (config.gradAngle * Math.PI) / 180
      const c = size / 2
      const dx = Math.cos(rad)
      const dy = Math.sin(rad)
      const len = c * (Math.abs(dx) + Math.abs(dy))
      const g = ctx.createLinearGradient(c - dx * len, c - dy * len, c + dx * len, c + dy * len)
      g.addColorStop(0, config.gradColorA)
      g.addColorStop(1, config.gradColorB)
      ctx.fillStyle = g
    }
  } else {
    ctx.fillStyle = config.bgColor
  }
  ctx.fillRect(0, 0, size, size)
}

export async function renderIcon(canvas: HTMLCanvasElement, config: IconConfig, size: number): Promise<void> {
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  roundRect(ctx, 0, 0, size, size, borderRadius(size, config.shape))
  ctx.clip()
  fillBackground(ctx, config, size)
  ctx.restore()

  const px = Math.max(1, Math.round((size * config.sizePercent) / 100))
  const fontSpec = `${config.weight} ${px}px "${config.fontFamily}"`
  try {
    await document.fonts.load(fontSpec, config.text)
  } catch {
    // font already available or unsupported; fall back silently
  }
  ctx.font = fontSpec
  ctx.fillStyle = config.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(config.text, size / 2, size / 2 + size * 0.015)
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function svgGradient(config: IconConfig, size: number): string {
  if (config.gradType === 'radial') {
    return `<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${size / 2}" cy="${size / 2}" r="${(size * 0.72).toFixed(1)}"><stop offset="0" stop-color="${config.gradColorA}"/><stop offset="1" stop-color="${config.gradColorB}"/></radialGradient>`
  }
  const rad = (config.gradAngle * Math.PI) / 180
  const c = size / 2
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const len = c * (Math.abs(dx) + Math.abs(dy))
  const x1 = (c - dx * len).toFixed(1)
  const y1 = (c - dy * len).toFixed(1)
  const x2 = (c + dx * len).toFixed(1)
  const y2 = (c + dy * len).toFixed(1)
  return `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${config.gradColorA}"/><stop offset="1" stop-color="${config.gradColorB}"/></linearGradient>`
}

export function buildSvg(config: IconConfig, size: number, fontBase64: string | null): string {
  const radius = borderRadius(size, config.shape)
  const fill = config.bgMode === 'gradient' ? 'url(#g)' : config.bgColor
  const bgEl =
    config.shape === 'circle'
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${fill}"/>`
      : `<rect x="0" y="0" width="${size}" height="${size}" rx="${radius.toFixed(1)}" fill="${fill}"/>`
  const defs = config.bgMode === 'gradient' ? `<defs>${svgGradient(config, size)}</defs>` : ''
  const fontFace = fontBase64
    ? `<style>@font-face{font-family:'${config.fontFamily}';src:url(data:font/woff2;base64,${fontBase64}) format('woff2');font-weight:${config.weight};font-style:normal;}</style>`
    : ''
  const fontSize = ((size * config.sizePercent) / 100).toFixed(1)
  const text = escapeXml(config.text)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}${fontFace}${bgEl}<text x="${size / 2}" y="${size / 2}" font-family="'${config.fontFamily}',sans-serif" font-size="${fontSize}" font-weight="${config.weight}" fill="${config.textColor}" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`
}

export function renderPngBlob(config: IconConfig, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    renderIcon(canvas, config, size)
      .then(() => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png')
      })
      .catch(reject)
  })
}

export function blobToUint8(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf))
}

export const ICO_SIZES = [16, 32, 48, 64, 128, 256]

export async function buildIco(config: IconConfig): Promise<Blob> {
  const entries: { size: number; bytes: Uint8Array }[] = []
  for (const size of ICO_SIZES) {
    const blob = await renderPngBlob(config, size)
    entries.push({ size, bytes: await blobToUint8(blob) })
  }
  const headerSize = 6 + 16 * entries.length
  let offset = headerSize
  const total = offset + entries.reduce((sum, e) => sum + e.bytes.length, 0)
  const buf = new ArrayBuffer(total)
  const view = new DataView(buf)
  const u8 = new Uint8Array(buf)
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, entries.length, true)
  entries.forEach((e, i) => {
    const p = 6 + i * 16
    view.setUint8(p, e.size >= 256 ? 0 : e.size)
    view.setUint8(p + 1, e.size >= 256 ? 0 : e.size)
    view.setUint8(p + 2, 0)
    view.setUint8(p + 3, 0)
    view.setUint16(p + 4, 1, true)
    view.setUint16(p + 6, 32, true)
    view.setUint32(p + 8, e.bytes.length, true)
    view.setUint32(p + 12, offset, true)
    u8.set(e.bytes, offset)
    offset += e.bytes.length
  })
  return new Blob([buf], { type: 'image/x-icon' })
}
