export const MAX_DIMENSION = 1920
export const DEFAULT_QUALITY = 0.8

const KEEP_AS_IS = new Set(['image/gif', 'image/svg+xml'])

export interface ImageSource {
  name: string
  mime: string
  originalDataUrl: string
  originalSize: number
  width: number
  height: number
  keepAsIs: boolean
  transparent: boolean
  element: HTMLImageElement
}

export interface CompressResult {
  dataUrl: string
  size: number
  width: number
  height: number
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load failed'))
    }
    img.src = url
  })
}

function hasTransparency(img: HTMLImageElement): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.drawImage(img, 0, 0)
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] < 255) return true
    }
  } catch {
    return false
  }
  return false
}

export async function loadImageSource(file: File): Promise<ImageSource> {
  if (!file.type.startsWith('image/')) throw new Error('unsupported file type')
  const originalDataUrl = await readFileAsDataURL(file)
  const element = await loadImage(file)
  return {
    name: file.name,
    mime: file.type,
    originalDataUrl,
    originalSize: file.size,
    width: element.naturalWidth,
    height: element.naturalHeight,
    keepAsIs: KEEP_AS_IS.has(file.type),
    transparent: file.type === 'image/png' || file.type === 'image/webp' ? hasTransparency(element) : false,
    element,
  }
}

function dataUrlSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  return Math.round((dataUrl.length - comma - 1) * 0.75)
}

export function compressSource(
  source: ImageSource,
  quality: number,
  maxDimension = MAX_DIMENSION,
): CompressResult {
  if (source.keepAsIs) {
    return {
      dataUrl: source.originalDataUrl,
      size: source.originalSize,
      width: source.width,
      height: source.height,
    }
  }

  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  if (source.mime === 'image/jpeg' || !source.transparent) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(source.element, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', Math.min(1, Math.max(0.1, quality)))
    return { dataUrl, size: dataUrlSize(dataUrl), width, height }
  }

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(source.element, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/png')
  return { dataUrl, size: dataUrlSize(dataUrl), width, height }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}