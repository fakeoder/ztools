export interface GradientPreset {
  id: string
  from: string
  to: string
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'indigoCyan', from: '#6366f1', to: '#22d3ee' },
  { id: 'violetPink', from: '#8b5cf6', to: '#ec4899' },
  { id: 'blueViolet', from: '#3b82f6', to: '#8b5cf6' },
  { id: 'emeraldTeal', from: '#10b981', to: '#14b8a6' },
  { id: 'ocean', from: '#0ea5e9', to: '#2563eb' },
  { id: 'sunset', from: '#f59e0b', to: '#ef4444' },
  { id: 'flamingo', from: '#f97316', to: '#ec4899' },
  { id: 'candy', from: '#a78bfa', to: '#f472b6' },
  { id: 'aurora', from: '#22d3ee', to: '#a78bfa' },
  { id: 'lime', from: '#84cc16', to: '#059669' },
  { id: 'magenta', from: '#d946ef', to: '#6366f1' },
  { id: 'midnight', from: '#1e293b', to: '#4f46e5' },
]

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => {
    const color = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function randomHexColor(): string {
  const hue = Math.floor(Math.random() * 360)
  const saturation = 55 + Math.floor(Math.random() * 31)
  const lightness = 45 + Math.floor(Math.random() * 21)
  return hslToHex(hue, saturation, lightness)
}

export function randomPreset(): GradientPreset {
  return GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)]
}
