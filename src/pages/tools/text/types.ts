export type RowKind = 'context' | 'added' | 'removed' | 'modified'

export interface CharPiece {
  t: 'e' | 'a' | 'd'
  s: string
}

export interface TextDiffRow {
  kind: RowKind
  l: string | null
  r: string | null
  ln: number | null
  rn: number | null
  cpL: CharPiece[] | null
  cpR: CharPiece[] | null
}

export type ChangeKind = 'added' | 'removed' | 'modified'

export interface ChangeItem {
  kind: ChangeKind
  rowIndex: number
  lineNo: number
  text: string
}

export interface TextDiffStats {
  added: number
  removed: number
  modified: number
}

export interface TextDiffOptions {
  textDiff: boolean
  contextLines: number
}

export interface TextDiffResult {
  ok: boolean
  error?: string
  rows: TextDiffRow[]
  stats: TextDiffStats
  changes: ChangeItem[]
  reportHtml: string
}
