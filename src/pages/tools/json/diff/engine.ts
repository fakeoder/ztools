import { create } from 'jsondiffpatch'
import { createPathAwareArrayFilter } from './arrayfilter'
import { decodeBigInt, isBigIntTagged, preserveBigIntegers } from './bigint'
import { buildRows, deltaToJsonPatch } from './delta'
import { isPointerPatternValid, pushPointer, pointerMatch } from './pointer'
import { buildReportHtml } from './report'
import type { DiffOptions, DiffResult } from './types'

const SENTINEL = '\u0001ztools:ignored\u0001'

const IDENTITY_FIELDS = ['id', '_id', 'uuid', 'key', 'name', 'slug', 'code']

export function autoObjectHash(item: object): string | undefined {
  const rec = item as Record<string, unknown>
  for (const f of IDENTITY_FIELDS) {
    const v = rec[f]
    if (v !== undefined && v !== null) {
      const t = typeof v
      if (t === 'string' || t === 'number') return `${f}:${String(v)}`
    }
  }
  return undefined
}

function compilePatterns(list: string[]): string[] {
  const out: string[] = []
  for (const raw of list) {
    const p = raw.trim()
    if (p !== '' && isPointerPatternValid(p)) out.push(p)
  }
  return out
}

function isIgnoredPath(patterns: string[], path: string): boolean {
  for (const p of patterns) {
    if (pointerMatch(p, path)) return true
  }
  return false
}

function stripIgnored(value: unknown, path: string, patterns: string[]): unknown {
  if (isIgnoredPath(patterns, path)) return SENTINEL
  if (Array.isArray(value)) {
    const out = new Array(value.length)
    for (let i = 0; i < value.length; i++) {
      out[i] = stripIgnored(value[i], pushPointer(path, i), patterns)
    }
    return out
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj)) {
      const kp = pushPointer(path, k)
      if (isIgnoredPath(patterns, kp)) continue
      out[k] = stripIgnored(obj[k], kp, patterns)
    }
    return out
  }
  return value
}

function createPatcher(overrides: Record<string, string>) {
  const dp = create({
    objectHash: autoObjectHash,
    arrays: { detectMove: true, includeValueOnMove: true },
  })
  dp.processor.pipes.diff.replace(
    'arrays',
    createPathAwareArrayFilter(autoObjectHash, (path) => overrides[path]),
  )
  return dp
}

function formatParseError(side: string, err: unknown, text: string): string {
  const raw = err instanceof Error ? err.message : String(err)
  const match = raw.match(/position (\d+)/)
  if (match) {
    const pos = Number(match[1])
    const before = text.slice(0, pos)
    const lines = before.split('\n')
    const line = lines.length
    const col = lines[lines.length - 1].length + 1
    return `${side}: line ${line}, column ${col}: ${raw}`
  }
  return `${side}: ${raw}`
}

function parseText(side: string, text: string): { data: unknown } | { error: string } {
  try {
    return { data: JSON.parse(preserveBigIntegers(text)) }
  } catch (err) {
    return { error: formatParseError(side, err, text) }
  }
}

export function stringifyJson(v: unknown): string {
  if (v === null) return 'null'
  const t = typeof v
  if (t === 'number' || t === 'boolean') return String(v)
  if (t === 'string') return isBigIntTagged(v) ? decodeBigInt(v) : JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map((x) => stringifyJson(x)).join(',')}]`
  if (typeof v === 'object') {
    const parts: string[] = []
    for (const k of Object.keys(v as Record<string, unknown>)) {
      parts.push(`${JSON.stringify(k)}:${stringifyJson((v as Record<string, unknown>)[k])}`)
    }
    return `{${parts.join(',')}}`
  }
  return 'null'
}

const EMPTY_RESULT: DiffResult = {
  ok: false,
  rows: [],
  stats: { added: 0, removed: 0, modified: 0, moved: 0 },
  changes: [],
  patch: [],
  patchJson: '[]',
  reportHtml: '',
  ignoredCount: 0,
}

export function computeDiff(leftText: string, rightText: string, opts: DiffOptions): DiffResult {
  const patterns = compilePatterns(opts.ignorePaths)
  const leftRes = parseText('left', leftText)
  if ('error' in leftRes) return { ...EMPTY_RESULT, error: leftRes.error }
  const rightRes = parseText('right', rightText)
  if ('error' in rightRes) return { ...EMPTY_RESULT, error: rightRes.error }
  const leftData = leftRes.data
  const rightData = rightRes.data

  const leftStripped = stripIgnored(leftData, '', patterns)
  const rightStripped = stripIgnored(rightData, '', patterns)

  const dp = createPatcher(opts.identityOverrides)
  const delta = dp.diff(leftStripped, rightStripped)

  const { rows, stats, changes, ignoredCount } = buildRows(leftData, rightData, delta, opts, patterns)
  const patch = deltaToJsonPatch(delta)
  const patchJson = stringifyJson(patch)
  const reportHtml = buildReportHtml(rows, stats, ignoredCount)

  return { ...EMPTY_RESULT, ok: true, rows, stats, changes, patch, patchJson, reportHtml, ignoredCount }
}