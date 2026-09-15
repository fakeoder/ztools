export type RowKind = 'context' | 'added' | 'removed' | 'modified' | 'moved' | 'ignored'

export interface CharPiece {
  t: 'e' | 'a' | 'd'
  s: string
}

export interface DiffRow {
  kind: RowKind
  l: string | null
  r: string | null
  ln: number | null
  rn: number | null
  p: string | null
  cpL: CharPiece[] | null
  cpR: CharPiece[] | null
  note: string | null
}

export type ChangeKind = 'added' | 'removed' | 'modified' | 'moved'

export interface ChangeItem {
  kind: ChangeKind
  path: string
  rowIndex: number
}

export interface DiffStats {
  added: number
  removed: number
  modified: number
  moved: number
}

export interface DiffOptions {
  ignorePaths: string[]
  identityOverrides: Record<string, string>
  textDiff: boolean
  contextLines: number
}

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace'
  path: string
  value?: unknown
}

export interface DiffResult {
  ok: boolean
  error?: string
  rows: DiffRow[]
  stats: DiffStats
  changes: ChangeItem[]
  patch: JsonPatchOp[]
  patchJson: string
  reportHtml: string
  ignoredCount: number
}