import type { JsonValue } from './analyze'

export const MAX_INPUT_SIZE = 10 * 1024 * 1024

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${+(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function parseJson(text: string): { data: JsonValue } | { error: string } {
  try {
    const data: unknown = JSON.parse(text)
    return { data: data as JsonValue }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const match = raw.match(/position (\d+)/)
    if (match) {
      const pos = Number(match[1])
      const before = text.slice(0, pos)
      const lines = before.split('\n')
      const line = lines.length
      const col = lines[lines.length - 1].length + 1
      return { error: `line ${line}, column ${col}: ${raw}` }
    }
    return { error: raw }
  }
}