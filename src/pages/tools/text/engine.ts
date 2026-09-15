import { diff_match_patch } from '@dmsnell/diff-match-patch'
import { buildReportHtml } from './report'
import type {
  ChangeItem,
  ChangeKind,
  CharPiece,
  TextDiffOptions,
  TextDiffResult,
  TextDiffRow,
  TextDiffStats,
} from './types'

const dmp = new diff_match_patch()

const MAX_CHARS_PER_LINE_DIFF = 20000
const MAX_LINES_FIRST = 40000
const MAX_LINES_SECOND = 65535

const EMPTY_RESULT: TextDiffResult = {
  ok: false,
  rows: [],
  stats: { added: 0, removed: 0, modified: 0 },
  changes: [],
  reportHtml: '',
}

interface LineTokenMap {
  chars1: string
  chars2: string
  lineArray: string[]
}

function splitText(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endsWith('\r')) lines[i] = lines[i].slice(0, -1)
  }
  return lines
}

function linesToChars(a: string[], b: string[]): LineTokenMap {
  const lineArray: string[] = ['']
  const lineHash = new Map<string, number>()
  let maxLines = MAX_LINES_FIRST

  const munge = (lines: string[]): string => {
    let chars = ''
    let lineArrayLength = lineArray.length
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const existing = lineHash.get(line)
      if (existing !== undefined) {
        chars += String.fromCharCode(existing)
      } else if (lineArrayLength < maxLines) {
        chars += String.fromCharCode(lineArrayLength)
        lineHash.set(line, lineArrayLength)
        lineArray[lineArrayLength++] = line
      } else {
        chars += String.fromCharCode(lineArrayLength)
        lineArray[lineArrayLength++] = lines.slice(i).join('\n')
        break
      }
    }
    return chars
  }

  const chars1 = munge(a)
  maxLines = MAX_LINES_SECOND
  const chars2 = munge(b)
  return { chars1, chars2, lineArray }
}

interface LineOp {
  op: number
  lines: string[]
}

function diffLineOps(text1: string, text2: string): LineOp[] {
  const { chars1, chars2, lineArray } = linesToChars(splitText(text1), splitText(text2))
  const diffs = dmp.diff_main(chars1, chars2, false)
  const ops: LineOp[] = []
  for (const d of diffs) {
    const text = d[1]
    const lines: string[] = new Array(text.length)
    for (let i = 0; i < text.length; i++) lines[i] = lineArray[text.charCodeAt(i)]
    ops.push({ op: d[0], lines })
  }
  return ops
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

export function computeTextDiff(leftText: string, rightText: string, opts: TextDiffOptions): TextDiffResult {
  const ops = diffLineOps(leftText, rightText)
  const rows: TextDiffRow[] = []
  const changes: ChangeItem[] = []
  const stats: TextDiffStats = { added: 0, removed: 0, modified: 0 }
  let ln = 0
  let rn = 0

  const pushBlock = (delTokens: string[], insTokens: string[]) => {
    const startRow = rows.length
    const n = Math.max(delTokens.length, insTokens.length)
    let firstLineNo = 0
    let firstText = ''
    let modCount = 0
    let addCount = 0
    let delCount = 0

    for (let k = 0; k < n; k++) {
      const dl = delTokens[k]
      const il = insTokens[k]
      if (dl !== undefined && il !== undefined) {
        const l = dl
        const r = il
        let cpL: CharPiece[] | null = null
        let cpR: CharPiece[] | null = null
        if (opts.textDiff && l.length + r.length <= MAX_CHARS_PER_LINE_DIFF) {
          const pieces = diffPieces(l, r)
          cpL = pieces.l
          cpR = pieces.r
        }
        rows.push({ kind: 'modified', l, r, ln: ++ln, rn: ++rn, cpL, cpR })
        modCount++
        if (!firstText) {
          firstLineNo = ln
          firstText = l
        }
      } else if (dl !== undefined) {
        const l = dl
        rows.push({ kind: 'removed', l, r: null, ln: ++ln, rn: null, cpL: null, cpR: null })
        delCount++
        if (!firstText) {
          firstLineNo = ln
          firstText = l
        }
      } else if (il !== undefined) {
        const r = il
        rows.push({ kind: 'added', l: null, r, ln: null, rn: ++rn, cpL: null, cpR: null })
        addCount++
        if (!firstText) {
          firstLineNo = rn
          firstText = r
        }
      }
    }

    stats.modified += modCount
    stats.added += addCount
    stats.removed += delCount
    if (n > 0) {
      const kind: ChangeKind = modCount > 0 ? 'modified' : addCount > 0 ? 'added' : 'removed'
      changes.push({ kind, rowIndex: startRow, lineNo: firstLineNo, text: firstText })
    }
  }

  for (let i = 0; i < ops.length; i++) {
    const cur = ops[i]
    if (cur.op === 0) {
      for (const token of cur.lines) {
        const text = token
        rows.push({ kind: 'context', l: text, r: text, ln: ++ln, rn: ++rn, cpL: null, cpR: null })
      }
    } else if (cur.op === -1) {
      let ins: string[] = []
      if (i + 1 < ops.length && ops[i + 1].op === 1) {
        ins = ops[i + 1].lines
        i++
      }
      pushBlock(cur.lines, ins)
    } else {
      let del: string[] = []
      if (i + 1 < ops.length && ops[i + 1].op === -1) {
        del = ops[i + 1].lines
        i++
      }
      pushBlock(del, cur.lines)
    }
  }

  const reportHtml = buildReportHtml(rows, stats)
  return { ...EMPTY_RESULT, ok: true, rows, stats, changes, reportHtml }
}
