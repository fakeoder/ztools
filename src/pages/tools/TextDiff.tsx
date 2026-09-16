import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { decodeShare, encodeShare } from './text/share'
import type { CharPiece, RowKind, TextDiffOptions, TextDiffResult, TextDiffRow } from './text/types'

const ROW_H = 22
const DEFAULT_CONTEXT = 3

const SAMPLE_LEFT = `function greet(name) {
  const message = "Hello, " + name
  console.log(message)
  return message
}

const users = ["Alice", "Bob"]
users.forEach(greet)
`

const SAMPLE_RIGHT = `function greet(name, greeting = "Hello") {
  const message = greeting + ", " + name
  console.log("[greet]", message)
  return message
}

const users = ["Alice", "Bob", "Carol"]
users.forEach(function (user) {
  greet(user)
})
`

interface ViewRowBase {
  fullIndex: number
}

interface ExpanderRow {
  kind: 'expander'
  id: number
  hidden: number
  fullIndex: number
}

type ViewRow = (TextDiffRow & ViewRowBase) | ExpanderRow

interface UnifiedRow {
  kind: 'sign' | 'expander'
  sign: string
  cls: string
  text: string | null
  ln: number | null
  rn: number | null
  fullIndex: number | null
  cp: CharPiece[] | null
  hidden?: number
  id?: number
}

function applyCollapse(rows: TextDiffRow[], expanded: ReadonlySet<number>, contextLines: number): ViewRow[] {
  const out: ViewRow[] = []
  let i = 0
  while (i < rows.length) {
    if (rows[i].kind !== 'context') {
      out.push({ ...rows[i], fullIndex: i })
      i++
      continue
    }
    let j = i
    while (j < rows.length && rows[j].kind === 'context') j++
    const run = j - i
    const show = 2 * contextLines
    if (run > show && !expanded.has(i)) {
      for (let k = i; k < i + contextLines; k++) out.push({ ...rows[k], fullIndex: k })
      out.push({ kind: 'expander', id: i, hidden: run - show, fullIndex: i + contextLines })
      for (let k = j - contextLines; k < j; k++) out.push({ ...rows[k], fullIndex: k })
    } else {
      for (let k = i; k < j; k++) out.push({ ...rows[k], fullIndex: k })
    }
    i = j
  }
  return out
}

function toUnified(collapsed: ViewRow[]): UnifiedRow[] {
  const out: UnifiedRow[] = []
  for (const vr of collapsed) {
    if (vr.kind === 'expander') {
      out.push({ kind: 'expander', sign: '', cls: '', text: null, ln: null, rn: null, fullIndex: vr.fullIndex, cp: null, hidden: vr.hidden, id: vr.id })
      continue
    }
    const r = vr as TextDiffRow
    switch (r.kind) {
      case 'added':
        out.push({ kind: 'sign', sign: '+', cls: 'd-add', text: r.r, ln: null, rn: r.rn, fullIndex: vr.fullIndex, cp: r.cpR })
        break
      case 'removed':
        out.push({ kind: 'sign', sign: '-', cls: 'd-del', text: r.l, ln: r.ln, rn: null, fullIndex: vr.fullIndex, cp: r.cpL })
        break
      case 'modified':
        out.push({ kind: 'sign', sign: '~', cls: 'd-mod', text: r.l, ln: r.ln, rn: null, fullIndex: vr.fullIndex, cp: r.cpL })
        out.push({ kind: 'sign', sign: '~', cls: 'd-mod', text: r.r, ln: null, rn: r.rn, fullIndex: vr.fullIndex, cp: r.cpR })
        break
      default:
        out.push({ kind: 'sign', sign: ' ', cls: 'd-ctx', text: r.l, ln: r.ln, rn: r.rn, fullIndex: vr.fullIndex, cp: null })
    }
  }
  return out
}

function columnWidths(rows: ViewRow[]): number {
  let max = 0
  for (const vr of rows) {
    if (vr.kind === 'expander') continue
    const r = vr as TextDiffRow
    if (r.l !== null) max = Math.max(max, r.l.length)
    if (r.r !== null) max = Math.max(max, r.r.length)
  }
  return max
}

function parseOptions(textDiff: boolean, contextLines: number): TextDiffOptions {
  return { textDiff, contextLines: Math.max(1, contextLines) }
}

function LineContent({ text, cp }: { text: string | null; cp: CharPiece[] | null }) {
  if (text === null) return null
  if (!cp || cp.length === 0) return <>{text}</>
  return (
    <>
      {cp.map((p, i) => {
        if (p.t === 'e') return <span key={i}>{p.s}</span>
        if (p.t === 'a') return <span className="d-cp-add" key={i}>{p.s}</span>
        return <span className="d-cp-del" key={i}>{p.s}</span>
      })}
    </>
  )
}

export default function TextDiff() {
  const { t } = useTranslation()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [textDiff, setTextDiff] = useState(true)
  const [contextLines, setContextLines] = useState(DEFAULT_CONTEXT)
  const [view, setView] = useState<'split' | 'unified'>('split')
  const [result, setResult] = useState<TextDiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const leftFileRef = useRef<HTMLInputElement>(null)
  const rightFileRef = useRef<HTMLInputElement>(null)

  const toolTags = useMemo(() => t('tools:text_diff.tags', { returnObjects: true }) as string[], [t])

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL('./text/worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<{ id: number; result: TextDiffResult }>) => {
        const { id, result: res } = e.data
        if (id !== reqIdRef.current) return
        setRunning(false)
        setError(res.ok ? null : res.error ?? null)
        setResult(res)
        setActiveIndex(null)
      }
      w.onerror = () => {
        setRunning(false)
        setError(t('tools:textdiff.workerError'))
      }
      workerRef.current = w
    }
    return workerRef.current
  }, [t])

  const run = useCallback(
    (left: string, right: string, opts: TextDiffOptions) => {
      if (!left.trim() || !right.trim()) return
      const id = ++reqIdRef.current
      setRunning(true)
      setError(null)
      getWorker().postMessage({ id, left, right, options: opts })
    },
    [getWorker],
  )

  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    if (!leftText.trim() || !rightText.trim()) return
    const opts = parseOptions(textDiff, contextLines)
    timerRef.current = window.setTimeout(() => {
      run(leftText, rightText, opts)
    }, 350)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [leftText, rightText, textDiff, contextLines, run])

  useEffect(() => {
    const m = window.location.hash.match(/[?&]d=([^&]+)/)
    if (!m) {
      setLoaded(true)
      return
    }
    decodeShare(m[1])
      .then((payload) => {
        if (payload) {
          setLeftText(payload.a)
          setRightText(payload.b)
          setTextDiff(payload.o.textDiff)
          setContextLines(Math.max(1, payload.o.contextLines ?? DEFAULT_CONTEXT))
        }
      })
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate()
    }
  }, [])

  const currentOpts = useMemo(() => parseOptions(textDiff, contextLines), [textDiff, contextLines])

  const collapsedRows = useMemo<ViewRow[]>(() => {
    if (!result) return []
    return applyCollapse(result.rows, expanded, contextLines)
  }, [result, expanded, contextLines])

  const unifiedRows = useMemo(() => toUnified(collapsedRows), [collapsedRows])

  const cols = useMemo(() => columnWidths(collapsedRows), [collapsedRows])

  const viewRows = view === 'split' ? collapsedRows : unifiedRows
  const viewRowCount = viewRows.length

  const virtualizer = useVirtualizer({
    count: viewRowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 16,
  })

  const jumpTo = useCallback(
    (rowIndex: number) => {
      let vi = -1
      if (view === 'split') {
        vi = collapsedRows.findIndex((r) => r.kind !== 'expander' && r.fullIndex === rowIndex)
      } else {
        vi = unifiedRows.findIndex((u) => u.kind === 'sign' && u.fullIndex === rowIndex)
      }
      if (vi >= 0) {
        virtualizer.scrollToIndex(vi, { align: 'center' })
        setActiveIndex(rowIndex)
      }
    },
    [view, collapsedRows, unifiedRows, virtualizer],
  )

  const handleFile = (side: 'l' | 'r') => (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setSide(side, String(reader.result ?? ''))
    reader.onerror = () => setError(t('tools:textdiff.readError'))
    reader.readAsText(file)
  }

  const setSide = (side: 'l' | 'r', text: string) => {
    if (side === 'l') setLeftText(text)
    else setRightText(text)
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard unavailable
    }
  }

  const download = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    setShareMsg(null)
    const { hash, tooLarge } = await encodeShare({ a: leftText, b: rightText, o: currentOpts })
    if (tooLarge) {
      setShareMsg(t('tools:textdiff.shareTooLarge'))
      return
    }
    window.location.hash = `d=${hash}`
    await copyText(window.location.href)
    setShareMsg(t('tools:textdiff.shareCopied'))
  }

  const totalChanged = result ? result.stats.added + result.stats.removed + result.stats.modified : 0
  const isIdentical = result !== null && result.ok && totalChanged === 0

  const formatHidden = useCallback((n: number) => t('tools:textdiff.hiddenLines', { count: n }), [t])

  return (
    <section className="section tool-page">
      <div className="container">
        <div className="tool-page-head">
          <div className="tool-page-badges">
            {toolTags.map((tag) => (
              <span className="badge" key={tag}>{t(`tools:tags.${tag}`)}</span>
            ))}
          </div>
          <h1>{t('tools:text_diff.name')}</h1>
          <p>{t('tools:text_diff.desc')}</p>
        </div>

        <div className="diff-inputs">
          <div className="diff-input-card">
            <div className="diff-input-head">
              <span className="diff-input-title">{t('tools:textdiff.testLabel')}</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => leftFileRef.current?.click()}>
                {t('tools:textdiff.upload')}
              </button>
            </div>
            <textarea
              className="json-input diff-input"
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              placeholder={t('tools:textdiff.pastePlaceholder')}
              spellCheck={false}
            />
            <input
              ref={leftFileRef}
              type="file"
              accept="text/*,.txt,.md,.log,.csv,.json,.xml,.yml,.yaml"
              className="visually-hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile('l')(f)
                e.target.value = ''
              }}
            />
          </div>
          <div className="diff-input-card">
            <div className="diff-input-head">
              <span className="diff-input-title">{t('tools:textdiff.refLabel')}</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => rightFileRef.current?.click()}>
                {t('tools:textdiff.upload')}
              </button>
            </div>
            <textarea
              className="json-input diff-input"
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              placeholder={t('tools:textdiff.pastePlaceholder')}
              spellCheck={false}
            />
            <input
              ref={rightFileRef}
              type="file"
              accept="text/*,.txt,.md,.log,.csv,.json,.xml,.yml,.yaml"
              className="visually-hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile('r')(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="diff-options">
          <div className="diff-opt-inline">
            <label className="diff-check">
              <input type="checkbox" checked={textDiff} onChange={(e) => setTextDiff(e.target.checked)} />
              <span>{t('tools:textdiff.textDiff')}</span>
            </label>
            <label className="diff-check">
              <span>{t('tools:textdiff.context')}</span>
              <input
                type="number"
                min={1}
                max={50}
                value={contextLines}
                onChange={(e) => setContextLines(Number(e.target.value) || DEFAULT_CONTEXT)}
                className="diff-num"
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setLeftText(SAMPLE_LEFT)
                setRightText(SAMPLE_RIGHT)
              }}
            >
              {t('tools:textdiff.sample')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setLeftText('')
                setRightText('')
                setResult(null)
                setError(null)
              }}
            >
              {t('tools:textdiff.clear')}
            </button>
          </div>
        </div>

        {error && <div className="json-error" role="alert">{error}</div>}
        {running && <p className="json-empty">{t('tools:textdiff.running')}</p>}
        {loaded && !running && !error && !result && <p className="json-empty">{t('tools:textdiff.emptyState')}</p>}
        {isIdentical && <div className="diff-identical">{t('tools:textdiff.identical')}</div>}

        {result && result.ok && !isIdentical && (
          <div className="diff-output">
            <div className="diff-toolbar">
              <div className="diff-stats">
                <span className="d-stat d-stat-add">+{result.stats.added}</span>
                <span className="d-stat d-stat-del">-{result.stats.removed}</span>
                <span className="d-stat d-stat-mod">~{result.stats.modified}</span>
              </div>
              <div className="diff-tabs-btns" role="tablist" aria-label={t('tools:textdiff.viewsLabel')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'split'}
                  className={view === 'split' ? 'is-active' : ''}
                  onClick={() => setView('split')}
                >
                  {t('tools:textdiff.viewSplit')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'unified'}
                  className={view === 'unified' ? 'is-active' : ''}
                  onClick={() => setView('unified')}
                >
                  {t('tools:textdiff.viewUnified')}
                </button>
              </div>
              <div className="diff-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => download(result.reportHtml, 'text-diff-report.html', 'text/html')}>
                  {t('tools:textdiff.downloadReport')}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={handleShare}>
                  {t('tools:textdiff.share')}
                </button>
              </div>
            </div>
            {shareMsg && <div className="diff-share-msg">{shareMsg}</div>}
            <p className="diff-baseline-hint">{t('tools:textdiff.baselineHint')}</p>

            <div className="diff-layout">
              <aside className="diff-list" aria-label={t('tools:textdiff.changesLabel')}>
                <div className="diff-list-head">{t('tools:textdiff.changesLabel')}</div>
                {result.changes.length === 0 && <div className="diff-list-empty">{t('tools:textdiff.noChanges')}</div>}
                <div className="diff-list-body">
                  {result.changes.map((c, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`diff-list-item ${activeIndex === c.rowIndex ? 'is-active' : ''}`}
                      onClick={() => jumpTo(c.rowIndex)}
                    >
                      <span className={`d-badge ${badgeClass(c.kind)}`}>{kindSign(c.kind)}</span>
                      <span className="d-path">{t('tools:textdiff.line', { line: c.lineNo })} · {c.text || t('tools:textdiff.blank')}</span>
                    </button>
                  ))}
                </div>
              </aside>
              <div className="diff-view">
                <div className="diff-scroll" ref={scrollRef}>
                  <div
                    style={{
                      height: virtualizer.getTotalSize(),
                      position: 'relative',
                      width: 'max-content',
                      minWidth: '100%',
                      '--d-col': `${cols + 7}ch`,
                    } as CSSProperties}
                  >
                    {virtualizer.getVirtualItems().map((item) => {
                      const row = viewRows[item.index]
                      if (view === 'split') {
                        return (
                          <SplitRow
                            key={item.key}
                            row={row as ViewRow}
                            top={item.start}
                            active={activeIndex}
                            onExpand={() => expandRun(row)}
                            formatHidden={formatHidden}
                          />
                        )
                      }
                      return (
                        <UnifiedRowItem
                          key={item.key}
                          row={row as UnifiedRow}
                          top={item.start}
                          active={activeIndex}
                          onExpand={() => expandRun(row)}
                          formatHidden={formatHidden}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )

  function expandRun(row: ViewRow | UnifiedRow) {
    const id = (row as ExpanderRow).id
    if (id !== undefined) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }
  }
}

function kindSign(kind: string): string {
  switch (kind) {
    case 'added':
      return '+'
    case 'removed':
      return '-'
    case 'modified':
      return '~'
    default:
      return ''
  }
}

function badgeClass(kind: string): string {
  switch (kind) {
    case 'added':
      return 'd-badge-add'
    case 'removed':
      return 'd-badge-del'
    case 'modified':
      return 'd-badge-modified'
    default:
      return ''
  }
}

function cellClass(kind: RowKind, side: 'l' | 'r'): string {
  switch (kind) {
    case 'added':
      return side === 'r' ? 'd-add' : 'd-ctx'
    case 'removed':
      return side === 'l' ? 'd-del' : 'd-ctx'
    case 'modified':
      return 'd-mod'
    default:
      return 'd-ctx'
  }
}

function cellSign(kind: RowKind, side: 'l' | 'r'): string {
  switch (kind) {
    case 'added':
      return side === 'r' ? '+' : ''
    case 'removed':
      return side === 'l' ? '-' : ''
    case 'modified':
      return '~'
    default:
      return ''
  }
}

function SplitRow({
  row,
  top,
  active,
  onExpand,
  formatHidden,
}: {
  row: ViewRow
  top: number
  active: number | null
  onExpand: () => void
  formatHidden: (n: number) => string
}) {
  if (row.kind === 'expander') {
    return (
      <div className="d-row d-row-expander" style={{ top, height: ROW_H }}>
        <button type="button" className="d-expander" onClick={onExpand}>
          {formatHidden(row.hidden)}
        </button>
      </div>
    )
  }
  const r = row as TextDiffRow
  const fullIndex = row.fullIndex
  const isActive = active !== null && fullIndex === active
  const lSign = cellSign(r.kind, 'l')
  const rSign = cellSign(r.kind, 'r')
  return (
    <div className={`d-row d-row-split ${isActive ? 'd-row-active' : ''}`} style={{ top, height: ROW_H }}>
      <div className={`d-cell ${cellClass(r.kind, 'l')}`}>
        <span className="d-ln">{r.ln ?? ''}</span>
        {lSign && <span className="d-cell-sign">{lSign}</span>}
        {r.l !== null && <span className="d-code"><LineContent text={r.l} cp={r.cpL} /></span>}
      </div>
      <div className={`d-cell ${cellClass(r.kind, 'r')}`}>
        <span className="d-ln">{r.rn ?? ''}</span>
        {rSign && <span className="d-cell-sign">{rSign}</span>}
        {r.r !== null && <span className="d-code"><LineContent text={r.r} cp={r.cpR} /></span>}
      </div>
    </div>
  )
}

function UnifiedRowItem({
  row,
  top,
  active,
  onExpand,
  formatHidden,
}: {
  row: UnifiedRow
  top: number
  active: number | null
  onExpand: () => void
  formatHidden: (n: number) => string
}) {
  if (row.kind === 'expander') {
    return (
      <div className="d-row d-row-expander" style={{ top, height: ROW_H }}>
        <button type="button" className="d-expander" onClick={onExpand}>
          {formatHidden(row.hidden ?? 0)}
        </button>
      </div>
    )
  }
  const cls = row.cls || 'd-ctx'
  const isActive = active !== null && row.fullIndex !== null && row.fullIndex === active
  return (
    <div className={`d-row d-row-unified ${cls} ${isActive ? 'd-row-active' : ''}`} style={{ top, height: ROW_H }}>
      <span className="d-ln">{row.ln ?? ''}</span>
      <span className="d-ln">{row.rn ?? ''}</span>
      <span className="d-sign">{row.sign}</span>
      <span className="d-code"><LineContent text={row.text} cp={row.cp} /></span>
    </div>
  )
}
