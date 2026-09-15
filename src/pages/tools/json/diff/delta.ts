import { diff_match_patch } from '@dmsnell/diff-match-patch'
import { pointerMatch, pushPointer } from './pointer'
import { serializeLines, scalarLine, sortedUnion } from './sort'
import type { SLine } from './sort'
import type {
  ChangeItem,
  ChangeKind,
  CharPiece,
  DiffOptions,
  DiffRow,
  DiffStats,
  JsonPatchOp,
  RowKind,
} from './types'

export interface BuildOutput {
  rows: DiffRow[]
  stats: DiffStats
  changes: ChangeItem[]
  ignoredCount: number
}

interface Ctx {
  rows: DiffRow[]
  stats: DiffStats
  changes: ChangeItem[]
  opts: DiffOptions
  patterns: string[]
  lno: number
  rno: number
  ignored: number
}

const dmp = new diff_match_patch()

function isContainer(v: unknown): boolean {
  return v !== null && typeof v === 'object'
}

function isIgnoredPath(patterns: string[], path: string): boolean {
  for (const p of patterns) {
    if (pointerMatch(p, path)) return true
  }
  return false
}

function diffPieces(l: string, r: string): { l: CharPiece[]; r: CharPiece[] } {
  const ops = dmp.diff_main(l, r)
  const lPieces: CharPiece[] = []
  const rPieces: CharPiece[] = []
  for (const op of ops) {
    const text = op[1]
    if (op[0] === 0) {
      lPieces.push({ t: 'e', s: text })
      rPieces.push({ t: 'e', s: text })
    } else if (op[0] === -1) {
      lPieces.push({ t: 'd', s: text })
    } else {
      rPieces.push({ t: 'a', s: text })
    }
  }
  return { l: lPieces, r: rPieces }
}

function emitHeader(ctx: Ctx, indent: number, key: string | null, open: string, path: string) {
  const pad = ' '.repeat(indent * 2)
  const prefix = key !== null ? `${JSON.stringify(key)}: ` : ''
  const text = `${pad}${prefix}${open}`
  ctx.rows.push({ kind: 'context', l: text, r: text, ln: ++ctx.lno, rn: ++ctx.rno, p: path, cpL: null, cpR: null, note: null })
}

function emitClose(ctx: Ctx, indent: number, close: string, path: string) {
  const text = ' '.repeat(indent * 2) + close
  ctx.rows.push({ kind: 'context', l: text, r: text, ln: ++ctx.lno, rn: ++ctx.rno, p: path, cpL: null, cpR: null, note: null })
}

interface SubtreeOptions {
  side: 'l' | 'r' | 'both'
  kind: RowKind
  note?: string | null
}

function pushSubtree(ctx: Ctx, lines: SLine[], opts: SubtreeOptions) {
  const { side, kind, note = null } = opts
  for (const line of lines) {
    ctx.rows.push({
      kind,
      l: side === 'l' || side === 'both' ? line.text : null,
      r: side === 'r' || side === 'both' ? line.text : null,
      ln: side === 'l' || side === 'both' ? ++ctx.lno : null,
      rn: side === 'r' || side === 'both' ? ++ctx.rno : null,
      p: line.path,
      cpL: null,
      cpR: null,
      note,
    })
  }
}

function recordChange(ctx: Ctx, kind: ChangeKind, path: string) {
  ctx.stats[kind]++
  ctx.changes.push({ kind, path, rowIndex: ctx.rows.length })
}

function walkChild(lv: unknown, rv: unknown, cd: unknown, path: string, indent: number, key: string | null, ctx: Ctx) {
  if (isIgnoredPath(ctx.patterns, path)) {
    emitIgnored(lv, rv, path, indent, key, ctx)
    return
  }
  walkNode(lv, rv, cd, path, indent, key, ctx)
}

function walkNode(lv: unknown, rv: unknown, delta: unknown, path: string, indent: number, key: string | null, ctx: Ctx) {
  if (delta === undefined) {
    const val = rv === undefined ? lv : rv
    if (ctx.patterns.length > 0 && isContainer(val)) {
      if (Array.isArray(val)) {
        walkArray(lv, rv, {}, path, indent, key, ctx)
      } else {
        walkObject(lv, rv, {}, path, indent, key, ctx)
      }
      return
    }
    pushSubtree(ctx, serializeLines(val, path, indent, key), { side: 'both', kind: 'context' })
    return
  }
  if (Array.isArray(delta)) {
    const len = delta.length
    if (len === 1) {
      recordChange(ctx, 'added', path)
      pushSubtree(ctx, serializeLines(rv, path, indent, key), { side: 'r', kind: 'added' })
      return
    }
    if (len === 2) {
      const lIsC = isContainer(lv)
      const rIsC = isContainer(rv)
      if (lIsC || rIsC) {
        recordChange(ctx, 'modified', path)
        pushSubtree(ctx, serializeLines(lv, path, indent, key), { side: 'l', kind: 'removed' })
        pushSubtree(ctx, serializeLines(rv, path, indent, key), { side: 'r', kind: 'added' })
        return
      }
      recordChange(ctx, 'modified', path)
      const lLine = scalarLine(lv, indent, key)
      const rLine = scalarLine(rv, indent, key)
      let cpL: CharPiece[] | null = null
      let cpR: CharPiece[] | null = null
      if (ctx.opts.textDiff && lLine.length + rLine.length <= 20000) {
        const pieces = diffPieces(lLine, rLine)
        cpL = pieces.l
        cpR = pieces.r
      }
      ctx.rows.push({ kind: 'modified', l: lLine, r: rLine, ln: ++ctx.lno, rn: ++ctx.rno, p: path, cpL, cpR, note: null })
      return
    }
    if (len === 3) {
      const code = delta[2]
      if (code === 0) {
        recordChange(ctx, 'removed', path)
        pushSubtree(ctx, serializeLines(lv, path, indent, key), { side: 'l', kind: 'removed' })
        return
      }
      if (code === 2) {
        recordChange(ctx, 'modified', path)
        const lLine = scalarLine(lv, indent, key)
        const rLine = scalarLine(rv, indent, key)
        const pieces = ctx.opts.textDiff ? diffPieces(lLine, rLine) : null
        ctx.rows.push({
          kind: 'modified',
          l: lLine,
          r: rLine,
          ln: ++ctx.lno,
          rn: ++ctx.rno,
          p: path,
          cpL: pieces ? pieces.l : null,
          cpR: pieces ? pieces.r : null,
          note: null,
        })
        return
      }
      if (code === 3) {
        recordChange(ctx, 'moved', path)
        pushSubtree(ctx, serializeLines(lv, path, indent, key), { side: 'l', kind: 'moved' })
        pushSubtree(ctx, serializeLines(rv, path, indent, key), { side: 'r', kind: 'moved' })
        return
      }
    }
    return
  }
  if (delta !== null && typeof delta === 'object') {
    const obj = delta as Record<string, unknown>
    if (obj._t === 'a') {
      walkArray(lv, rv, obj, path, indent, key, ctx)
      return
    }
    walkObject(lv, rv, obj, path, indent, key, ctx)
  }
}

function walkObject(
  lObj: unknown,
  rObj: unknown,
  delta: Record<string, unknown>,
  path: string,
  indent: number,
  key: string | null,
  ctx: Ctx,
) {
  const l = (lObj ?? {}) as Record<string, unknown>
  const r = (rObj ?? {}) as Record<string, unknown>
  emitHeader(ctx, indent, key, '{', path)
  for (const k of sortedUnion(l, r)) {
    const kp = pushPointer(path, k)
    walkChild(l[k], r[k], delta[k], kp, indent + 1, k, ctx)
  }
  emitClose(ctx, indent, '}', path)
}

interface Seg {
  type: 'same' | 'changed'
  lStart: number
  lEnd: number
  rStart: number
  rEnd: number
}

interface ArrayAlign {
  segs: Seg[]
  movedLeft: Map<number, number>
  movedRight: Map<number, number>
}

function alignArrays(l: unknown[], r: unknown[], delta: Record<string, unknown> | null): ArrayAlign {
  const removedLeft = new Set<number>()
  const movedLeft = new Map<number, number>()
  const addedRight = new Set<number>()
  if (delta) {
    for (const k of Object.keys(delta)) {
      if (k === '_t') continue
      const item = delta[k]
      if (!Array.isArray(item)) continue
      if (k[0] === '_') {
        const i = Number(k.slice(1))
        if (item.length === 3 && item[2] === 3) movedLeft.set(i, item[1] as number)
        else removedLeft.add(i)
      } else if (item.length === 1) {
        addedRight.add(Number(k))
      }
    }
  }
  const movedRight = new Map<number, number>()
  for (const [i, j] of movedLeft) movedRight.set(j, i)
  const lLen = l.length
  const rLen = r.length
  const matchedLeft: number[] = []
  for (let i = 0; i < lLen; i++) if (!removedLeft.has(i) && !movedLeft.has(i)) matchedLeft.push(i)
  const matchedRight: number[] = []
  for (let j = 0; j < rLen; j++) if (!addedRight.has(j) && !movedRight.has(j)) matchedRight.push(j)
  const rightOf = new Map<number, number>()
  for (let k = 0; k < matchedLeft.length; k++) {
    const li = matchedLeft[k]
    const ri = matchedRight[k]
    if (li === undefined || ri === undefined) continue
    rightOf.set(li, ri)
  }
  const segs: Seg[] = []
  let i = 0
  let j = 0
  while (i < lLen || j < rLen) {
    if (i < lLen && rightOf.get(i) === j) {
      const ls = i
      const rs = j
      while (i < lLen && rightOf.get(i) === j) {
        i++
        j++
      }
      segs.push({ type: 'same', lStart: ls, lEnd: i, rStart: rs, rEnd: j })
    } else {
      const ls = i
      const rs = j
      while (i < lLen && !rightOf.has(i)) i++
      while (j < rLen && !(i < lLen && rightOf.get(i) === j)) j++
      segs.push({ type: 'changed', lStart: ls, lEnd: i, rStart: rs, rEnd: j })
    }
  }
  return { segs, movedLeft, movedRight }
}

function walkArray(
  lArr: unknown,
  rArr: unknown,
  delta: Record<string, unknown>,
  path: string,
  indent: number,
  key: string | null,
  ctx: Ctx,
) {
  const l = (Array.isArray(lArr) ? lArr : []) as unknown[]
  const r = (Array.isArray(rArr) ? rArr : []) as unknown[]
  emitHeader(ctx, indent, key, '[', path)
  const { segs, movedLeft, movedRight } = alignArrays(l, r, delta)
  for (const seg of segs) {
    if (seg.type === 'same') {
      for (let k = 0; k < seg.lEnd - seg.lStart; k++) {
        const li = seg.lStart + k
        const ri = seg.rStart + k
        walkChild(l[li], r[ri], delta[String(ri)], pushPointer(path, li), indent + 1, null, ctx)
      }
    } else {
      for (let i = seg.lStart; i < seg.lEnd; i++) {
        const ip = pushPointer(path, i)
        if (isIgnoredPath(ctx.patterns, ip)) {
          emitIgnored(l[i], undefined, ip, indent + 1, null, ctx)
          continue
        }
        if (movedLeft.has(i)) {
          recordChange(ctx, 'moved', ip)
          pushSubtree(ctx, serializeLines(l[i], ip, indent + 1, null), { side: 'l', kind: 'moved', note: `\u2192 ${movedLeft.get(i)}` })
        } else {
          recordChange(ctx, 'removed', ip)
          pushSubtree(ctx, serializeLines(l[i], ip, indent + 1, null), { side: 'l', kind: 'removed' })
        }
      }
      for (let j = seg.rStart; j < seg.rEnd; j++) {
        const src = movedRight.get(j)
        if (src !== undefined) {
          const jp = pushPointer(path, src)
          if (isIgnoredPath(ctx.patterns, jp)) {
            emitIgnored(undefined, r[j], jp, indent + 1, null, ctx)
            continue
          }
          pushSubtree(ctx, serializeLines(r[j], jp, indent + 1, null), { side: 'r', kind: 'moved', note: `\u2190 ${src}` })
        } else {
          const jp = pushPointer(path, j)
          if (isIgnoredPath(ctx.patterns, jp)) {
            emitIgnored(undefined, r[j], jp, indent + 1, null, ctx)
            continue
          }
          recordChange(ctx, 'added', jp)
          pushSubtree(ctx, serializeLines(r[j], jp, indent + 1, null), { side: 'r', kind: 'added' })
        }
      }
    }
  }
  emitClose(ctx, indent, ']', path)
}

function emitIgnored(lv: unknown, rv: unknown, path: string, indent: number, key: string | null, ctx: Ctx) {
  ctx.ignored++
  const ls = serializeLines(lv, path, indent, key)
  const rs = serializeLines(rv, path, indent, key)
  const n = Math.max(ls.length, rs.length)
  for (let i = 0; i < n; i++) {
    const ll = ls[i]
    const rr = rs[i]
    ctx.rows.push({
      kind: 'ignored',
      l: ll ? ll.text : null,
      r: rr ? rr.text : null,
      ln: ll ? ++ctx.lno : null,
      rn: rr ? ++ctx.rno : null,
      p: path,
      cpL: null,
      cpR: null,
      note: null,
    })
  }
}

export function buildRows(
  leftData: unknown,
  rightData: unknown,
  delta: unknown,
  opts: DiffOptions,
  patterns: string[],
): BuildOutput {
  const ctx: Ctx = {
    rows: [],
    stats: { added: 0, removed: 0, modified: 0, moved: 0 },
    changes: [],
    opts,
    patterns,
    lno: 0,
    rno: 0,
    ignored: 0,
  }
  if (isIgnoredPath(patterns, '')) {
    emitIgnored(leftData, rightData, '', 0, null, ctx)
  } else {
    walkNode(leftData, rightData, delta, '', 0, null, ctx)
  }
  return { rows: ctx.rows, stats: ctx.stats, changes: ctx.changes, ignoredCount: ctx.ignored }
}

export function deltaToJsonPatch(delta: unknown): JsonPatchOp[] {
  const ops: JsonPatchOp[] = []
  const stack: { path: string; delta: unknown }[] = []
  if (delta) stack.push({ path: '', delta })
  while (stack.length > 0) {
    const cur = stack.pop()
    if (!cur || !cur.delta) continue
    const d = cur.delta
    if (Array.isArray(d)) {
      if (d.length === 1) ops.push({ op: 'add', path: cur.path, value: d[0] })
      else if (d.length === 2) ops.push({ op: 'replace', path: cur.path, value: d[1] })
      else if (d.length === 3 && d[2] === 0) ops.push({ op: 'remove', path: cur.path })
      continue
    }
    if (typeof d !== 'object' || d === null) continue
    const obj = d as Record<string, unknown>
    if (obj._t === 'a') {
      const deletes: number[] = []
      const inserts: { to: number; value: unknown }[] = []
      const updates: { to: number; delta: unknown }[] = []
      for (const k of Object.keys(obj)) {
        if (k === '_t') continue
        const item = obj[k]
        const isUnderscore = k[0] === '_'
        const idx = Number(isUnderscore ? k.slice(1) : k)
        if (Array.isArray(item)) {
          if (isUnderscore) {
            if (item.length === 3 && item[2] === 0) {
              deletes.push(idx)
            } else if (item.length === 3 && item[2] === 3) {
              deletes.push(idx)
              inserts.push({ to: item[1] as number, value: item[0] })
            }
          } else if (item.length === 1) {
            inserts.push({ to: idx, value: item[0] })
          } else if (item.length === 2) {
            updates.push({ to: idx, delta: item })
          }
        } else {
          updates.push({ to: idx, delta: item })
        }
      }
      deletes.sort((a, b) => b - a)
      for (const idx of deletes) ops.push({ op: 'remove', path: pushPointer(cur.path, idx) })
      inserts.sort((a, b) => a.to - b.to)
      for (const ins of inserts) ops.push({ op: 'add', path: pushPointer(cur.path, ins.to), value: ins.value })
      const stackUpdates: { path: string; delta: unknown }[] = []
      for (const up of updates) {
        const p = pushPointer(cur.path, up.to)
        if (Array.isArray(up.delta) && up.delta.length === 2) {
          ops.push({ op: 'replace', path: p, value: up.delta[1] })
        } else {
          stackUpdates.push({ path: p, delta: up.delta })
        }
      }
      if (stackUpdates.length > 0) stack.push(...stackUpdates.reverse())
    } else {
      const childUpdates: { path: string; delta: unknown }[] = []
      for (const k of Object.keys(obj).reverse()) {
        childUpdates.push({ path: pushPointer(cur.path, k), delta: obj[k] })
      }
      stack.push(...childUpdates)
    }
  }
  return ops
}