import { decodeBigInt, isBigIntTagged } from './bigint'
import { pushPointer } from './pointer'

export function naturalCompare(a: string, b: string): number {
  const chunksA = a.match(/(\d+)|(\D+)/g) ?? [a]
  const chunksB = b.match(/(\d+)|(\D+)/g) ?? [b]
  const len = Math.max(chunksA.length, chunksB.length)
  for (let i = 0; i < len; i++) {
    const ca = chunksA[i]
    const cb = chunksB[i]
    if (ca === undefined) return -1
    if (cb === undefined) return 1
    if (ca === cb) continue
    const na = /^\d+$/.test(ca)
    const nb = /^\d+$/.test(cb)
    if (na && nb) {
      const d = ca.length - cb.length
      if (d !== 0) return d
      return ca < cb ? -1 : 1
    }
    if (na) return -1
    if (nb) return 1
    if (ca < cb) return -1
    return 1
  }
  return 0
}

export function sortedUnion(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const set = new Set<string>()
  for (const k of Object.keys(a)) set.add(k)
  for (const k of Object.keys(b)) set.add(k)
  return Array.from(set).sort(naturalCompare)
}

export interface SLine {
  text: string
  path: string
}

export function scalarText(value: unknown): string {
  if (typeof value === 'string') {
    return isBigIntTagged(value) ? decodeBigInt(value) : JSON.stringify(value)
  }
  return String(value)
}

export function scalarLine(value: unknown, indent: number, key: string | null): string {
  const pad = ' '.repeat(indent * 2)
  const prefix = key !== null ? `${JSON.stringify(key)}: ` : ''
  return `${pad}${prefix}${scalarText(value)}`
}

/**
 * Canonical pretty-printer used by both sides so identical subtrees produce
 * byte-identical line sequences. Object keys are natural-sorted.
 */
export function serializeLines(
  value: unknown,
  path: string,
  indent: number,
  key: string | null = null,
): SLine[] {
  const pad = ' '.repeat(indent * 2)
  const prefix = key !== null ? `${JSON.stringify(key)}: ` : ''
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return [{ text: `${pad}${prefix}${String(value)}`, path }]
  }
  if (typeof value === 'string') {
    return [{ text: `${pad}${prefix}${scalarText(value)}`, path }]
  }
  if (Array.isArray(value)) {
    const lines: SLine[] = [{ text: `${pad}${prefix}[`, path }]
    for (let i = 0; i < value.length; i++) {
      lines.push(...serializeLines(value[i], pushPointer(path, i), indent + 1, null))
    }
    lines.push({ text: `${pad}]`, path })
    return lines
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const lines: SLine[] = [{ text: `${pad}${prefix}{`, path }]
    for (const k of Object.keys(obj).sort(naturalCompare)) {
      lines.push(...serializeLines(obj[k], pushPointer(path, k), indent + 1, k))
    }
    lines.push({ text: `${pad}}`, path })
    return lines
  }
  return []
}