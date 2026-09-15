export function escapePointerSeg(s: string): string {
  return s.replace(/~/g, '~0').replace(/\//g, '~1')
}

export function pushPointer(base: string, seg: string | number): string {
  return base === '' ? `/${seg}` : `${base}/${escapePointerSeg(String(seg))}`
}

export function parsePointer(ptr: string): string[] | null {
  if (ptr === '') return []
  if (!ptr.startsWith('/')) return null
  const segs = ptr.slice(1).split('/')
  const out: string[] = []
  for (const s of segs) {
    const unescaped = s.replace(/~1/g, '/').replace(/~0/g, '~')
    if (unescaped === undefined) return null
    out.push(unescaped)
  }
  return out
}

/**
 * Matches a JSON Pointer (with `*` as a single-segment wildcard) against a
 * concrete path. Both are expressed as strings like `/a/b/0` or `` for root.
 */
export function pointerMatch(pattern: string, path: string): boolean {
  const a = parsePointer(pattern)
  const b = parsePointer(path)
  if (a === null || b === null) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '*') continue
    if (a[i] !== b[i]) return false
  }
  return true
}

export function isPointerPatternValid(ptr: string): boolean {
  return ptr === '' || (ptr.startsWith('/') && parsePointer(ptr) !== null)
}