import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { decodeShare, encodeShare } from './json/diff/share'
import type { CharPiece, DiffOptions, DiffResult, DiffRow, RowKind } from './json/diff/types'

const ROW_H = 22

const SAMPLE_LEFT = `{
  "users": [
    { "id": 1, "name": "Alice", "role": "admin", "active": true, "scores": [10, 20, 30] },
    { "id": 2, "name": "Bob", "role": "admin", "active": false, "scores": [5, 15] },
    { "id": 3, "name": "Carol", "role": "viewer", "active": true, "scores": [1, 2] }
  ],
  "tags": ["dev", "tool", "json"],
  "meta": { "version": "1.0.0", "count": 3, "generatedAt": 1710000000000 }
}`

const SAMPLE_RIGHT = `{
  "users": [
    { "id": 1, "name": "Alice", "role": "admin", "active": true, "scores": [10, 20, 30] },
    { "id": 3, "name": "Carol", "role": "viewer", "active": true, "scores": [1, 2, 3] },
    { "id": 4, "name": "Dave", "role": "admin", "active": false, "scores": [] }
  ],
  "tags": ["dev", "tool", "json", "diff"],
  "meta": { "version": "1.1.0", "count": 3, "generatedAt": 1710000000000 }
}`

const DEFAULT_CONTEXT = 3

interface ViewRowBase {
  fullIndex: number
}

interface ExpanderRow {
  kind: 'expander'
  id: number
  hidden: number
  fullIndex: number
}

type ViewRow = (DiffRow & ViewRowBase) | ExpanderRow

interface UnifiedRow {
  kind: 'sign' | 'expander'
  sign: string
  text: string | null
  ln: number | null
  rn: number | null
  fullIndex: number | null
  cp: CharPiece[] | null
  note: string | null
  hidden?: number
  id?: number
}

function applyCollapse(rows: DiffRow[], expanded: ReadonlySet<number>, contextLines: number): ViewRow[] {
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
      out.push({ kind: 'expander', sign: '', text: null, ln: null, rn: null, fullIndex: vr.fullIndex, cp: null, note: null, hidden: vr.hidden, id: vr.id })
      continue
    }
    const r = vr as DiffRow
    switch (r.kind) {
      case 'added':
        out.push({ kind: 'sign', sign: '+', text: r.r, ln: null, rn: r.rn, fullIndex: vr.fullIndex, cp: r.cpR, note: r.note })
        break
      case 'removed':
        out.push({ kind: 'sign', sign: '-', text: r.l, ln: r.ln, rn: null, fullIndex: vr.fullIndex, cp: r.cpL, note: r.note })
        break
      case 'modified':
        out.push({ kind: 'sign', sign: '-', text: r.l, ln: r.ln, rn: null, fullIndex: vr.fullIndex, cp: r.cpL, note: null })
        out.push({ kind: 'sign', sign: '+', text: r.r, ln: null, rn: r.rn, fullIndex: vr.fullIndex, cp: r.cpR, note: null })
        break
      case 'moved':
        if (r.l !== null) out.push({ kind: 'sign', sign: '-', text: r.l, ln: r.ln, rn: null, fullIndex: vr.fullIndex, cp: r.cpL, note: r.note })
        if (r.r !== null) out.push({ kind: 'sign', sign: '+', text: r.r, ln: null, rn: r.rn, fullIndex: vr.fullIndex, cp: r.cpR, note: r.note })
        break
      case 'ignored':
        out.push({ kind: 'sign', sign: ' ', text: r.l ?? r.r, ln: r.ln, rn: r.rn, fullIndex: vr.fullIndex, cp: null, note: null })
        break
      default:
        out.push({ kind: 'sign', sign: ' ', text: r.l, ln: r.ln, rn: r.rn, fullIndex: vr.fullIndex, cp: null, note: null })
    }
  }
  return out
}

function columnWidths(rows: ViewRow[]): { left: number; right: number } {
  let left = 0
  let right = 0
  for (const vr of rows) {
    if (vr.kind === 'expander') continue
    const r = vr as DiffRow
    if (r.l !== null) left = Math.max(left, r.l.length + (r.note ? r.note.length + 2 : 0))
    if (r.r !== null) right = Math.max(right, r.r.length + (r.note ? r.note.length + 2 : 0))
  }
  return { left, right }
}

function parseOptions(ignoreText: string, identityText: string, textDiff: boolean, contextLines: number): DiffOptions {
  const ignorePaths = ignoreText.split('\n').map((s) => s.trim()).filter(Boolean)
  const identityOverrides: Record<string, string> = {}
  for (const line of identityText.split('\n')) {
    const idx = line.indexOf('=')
    if (idx > 0) {
      const p = line.slice(0, idx).trim()
      const f = line.slice(idx + 1).trim()
      if (p && f) identityOverrides[p] = f
    }
  }
  return { ignorePaths, identityOverrides, textDiff, contextLines: Math.max(1, contextLines) }
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

export default function JsonDiff() {
  const { t } = useTranslation()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [ignoreText, setIgnoreText] = useState('')
  const [identityText, setIdentityText] = useState('')
  const [textDiff, setTextDiff] = useState(true)
  const [contextLines, setContextLines] = useState(DEFAULT_CONTEXT)
  const [view, setView] = useState<'split' | 'unified'>('split')
  const [result, setResult] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const [copied, setCopied] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const leftFileRef = useRef<HTMLInputElement>(null)
  const rightFileRef = useRef<HTMLInputElement>(null)

  const toolTags = useMemo(() => t('tools:json_diff.tags', { returnObjects: true }) as string[], [t])

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL('./json/diff/worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<{ id: number; result: DiffResult }>) => {
        const { id, result: res } = e.data
        if (id !== reqIdRef.current) return
        setRunning(false)
        setError(res.ok ? null : res.error ?? null)
        setResult(res)
        setActiveIndex(null)
      }
      w.onerror = () => {
        setRunning(false)
        setError(t('tools:diff.workerError'))
      }
      workerRef.current = w
    }
    return workerRef.current
  }, [t])

  const run = useCallback(
    (left: string, right: string, opts: DiffOptions) => {
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
    const opts = parseOptions(ignoreText, identityText, textDiff, contextLines)
    timerRef.current = window.setTimeout(() => {
      run(leftText, rightText, opts)
    }, 350)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [leftText, rightText, ignoreText, identityText, textDiff, contextLines, run])

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
          setIgnoreText(payload.o.ignorePaths.join('\n'))
          setIdentityText(
            Object.entries(payload.o.identityOverrides).map(([p, f]) => `${p}=${f}`).join('\n'),
          )
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

  const currentOpts = useMemo(
    () => parseOptions(ignoreText, identityText, textDiff, contextLines),
    [ignoreText, identityText, textDiff, contextLines],
  )

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
    reader.onerror = () => setError(t('tools:diff.readError'))
    reader.readAsText(file)
  }

  const setSide = (side: 'l' | 'r', text: string) => {
    if (side === 'l') setLeftText(text)
    else setRightText(text)
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
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
      setShareMsg(t('tools:diff.shareTooLarge'))
      return
    }
    window.location.hash = `d=${hash}`
    await copyText(window.location.href)
    setShareMsg(t('tools:diff.shareCopied'))
  }

  const totalChanged =
    result ? result.stats.added + result.stats.removed + result.stats.modified + result.stats.moved : 0
  const isIdentical = result !== null && result.ok && totalChanged === 0 && result.ignoredCount === 0

  return (
    <section className="section tool-page">
      <div className="container">
        <div className="tool-page-head">
          <div className="tool-page-badges">
            {toolTags.map((tag) => (
              <span className="badge" key={tag}>{t(`tools:tags.${tag}`)}</span>
            ))}
          </div>
          <h1>{t('tools:json_diff.name')}</h1>
          <p>{t('tools:json_diff.desc')}</p>
        </div>

        <div className="diff-inputs">
          <div className="diff-input-card">
            <div className="diff-input-head">
              <span className="diff-input-title">{t('tools:diff.testLabel')}</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => leftFileRef.current?.click()}>
                {t('tools:diff.upload')}
              </button>
            </div>
            <textarea
              className="json-input diff-input"
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              placeholder={t('tools:diff.pastePlaceholder')}
              spellCheck={false}
            />
            <input
              ref={leftFileRef}
              type="file"
              accept=".json,application/json,text/plain"
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
              <span className="diff-input-title">{t('tools:diff.refLabel')}</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => rightFileRef.current?.click()}>
                {t('tools:diff.upload')}
              </button>
            </div>
            <textarea
              className="json-input diff-input"
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              placeholder={t('tools:diff.pastePlaceholder')}
              spellCheck={false}
            />
            <input
              ref={rightFileRef}
              type="file"
              accept=".json,application/json,text/plain"
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
          <label className="diff-opt-field">
            <span>{t('tools:diff.ignoreLabel')}</span>
            <textarea
              className="json-input diff-opt-text"
              value={ignoreText}
              onChange={(e) => setIgnoreText(e.target.value)}
              placeholder={t('tools:diff.ignorePlaceholder')}
              rows={1}
              spellCheck={false}
            />
          </label>
          <label className="diff-opt-field">
            <span>{t('tools:diff.identityLabel')}</span>
            <textarea
              className="json-input diff-opt-text"
              value={identityText}
              onChange={(e) => setIdentityText(e.target.value)}
              placeholder={t('tools:diff.identityPlaceholder')}
              rows={1}
              spellCheck={false}
            />
          </label>
          <div className="diff-opt-inline">
            <label className="diff-check">
              <input type="checkbox" checked={textDiff} onChange={(e) => setTextDiff(e.target.checked)} />
              <span>{t('tools:diff.textDiff')}</span>
            </label>
            <label className="diff-check">
              <span>{t('tools:diff.context')}</span>
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
              {t('tools:diff.sample')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setLeftText('')
                setRightText('')
                setIgnoreText('')
                setIdentityText('')
                setResult(null)
                setError(null)
              }}
            >
              {t('tools:diff.clear')}
            </button>
          </div>
        </div>

        {error && <div className="json-error" role="alert">{error}</div>}
        {running && <p className="json-empty">{t('tools:diff.running')}</p>}
        {loaded && !running && !error && !result && <p className="json-empty">{t('tools:diff.emptyState')}</p>}
        {isIdentical && <div className="diff-identical">{t('tools:diff.identical')}</div>}

        {result && result.ok && !isIdentical && (
          <div className="diff-output">
            <div className="diff-toolbar">
              <div className="diff-stats">
                <span className="d-stat d-stat-add">+{result.stats.added}</span>
                <span className="d-stat d-stat-del">-{result.stats.removed}</span>
                <span className="d-stat d-stat-mod">~{result.stats.modified}</span>
                <span className="d-stat d-stat-move">⇄{result.stats.moved}</span>
                {result.ignoredCount > 0 && <span className="d-stat d-stat-ign">{t('tools:diff.ignored', { count: result.ignoredCount })}</span>}
              </div>
              <div className="diff-tabs-btns" role="tablist" aria-label={t('tools:diff.viewsLabel')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'split'}
                  className={view === 'split' ? 'is-active' : ''}
                  onClick={() => setView('split')}
                >
                  {t('tools:diff.viewSplit')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'unified'}
                  className={view === 'unified' ? 'is-active' : ''}
                  onClick={() => setView('unified')}
                >
                  {t('tools:diff.viewUnified')}
                </button>
              </div>
              <div className="diff-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => copyText(result.patchJson)} title={t('tools:diff.copyPatch')}>
                  {copied ? t('tools:diff.copied') : t('tools:diff.copyPatch')}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => download(result.patchJson, 'diff.patch.json', 'application/json')}>
                  {t('tools:diff.downloadPatch')}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => download(result.reportHtml, 'diff-report.html', 'text/html')}>
                  {t('tools:diff.downloadReport')}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={handleShare}>
                  {t('tools:diff.share')}
                </button>
              </div>
            </div>
            {shareMsg && <div className="diff-share-msg">{shareMsg}</div>}

            <div className="diff-layout">
              <aside className="diff-list" aria-label={t('tools:diff.changesLabel')}>
                <div className="diff-list-head">{t('tools:diff.changesLabel')}</div>
                {result.changes.length === 0 && <div className="diff-list-empty">{t('tools:diff.noChanges')}</div>}
                <div className="diff-list-body">
                  {result.changes.map((c, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`diff-list-item ${activeIndex === c.rowIndex ? 'is-active' : ''}`}
                      onClick={() => jumpTo(c.rowIndex)}
                    >
                      <span className={`d-badge d-badge-${c.kind}`}>{kindIcon(c.kind)}</span>
                      <span className="d-path">{c.path || '/'}</span>
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
                      '--d-left': `${cols.left + 7}ch`,
                      '--d-right': `${cols.right + 7}ch`,
                    } as CSSProperties}
                  >
                    {virtualizer.getVirtualItems().map((item) => {
                      const row = viewRows[item.index]
                      if (view === 'split') {
                        return <SplitRow key={item.key} row={row as ViewRow} top={item.start} active={activeIndex} onExpand={() => expandRun(row)} />
                      }
                      return <UnifiedRowItem key={item.key} row={row as UnifiedRow} top={item.start} active={activeIndex} onExpand={() => expandRun(row)} />
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

function kindIcon(kind: string): string {
  switch (kind) {
    case 'added':
      return '+'
    case 'removed':
      return '-'
    case 'modified':
      return '~'
    case 'moved':
      return '⇄'
    default:
      return ''
  }
}

function kindClass(kind: RowKind): string {
  switch (kind) {
    case 'added':
      return 'd-add'
    case 'removed':
      return 'd-del'
    case 'modified':
      return 'd-mod'
    case 'moved':
      return 'd-move'
    case 'ignored':
      return 'd-ign'
    default:
      return 'd-ctx'
  }
}

function SplitRow({ row, top, active, onExpand }: { row: ViewRow; top: number; active: number | null; onExpand: () => void }) {
  if (row.kind === 'expander') {
    return (
      <div className="d-row d-row-expander" style={{ top, height: ROW_H }}>
        <button type="button" className="d-expander" onClick={onExpand}>
          … {row.hidden} hidden lines
        </button>
      </div>
    )
  }
  const r = row as DiffRow
  const fullIndex = row.fullIndex
  const isActive = active !== null && r.p !== null && fullIndex === active
  return (
    <div className={`d-row d-row-split ${kindClass(r.kind)} ${isActive ? 'd-row-active' : ''}`} style={{ top, height: ROW_H }}>
      <div className="d-cell">
        <span className="d-ln">{r.ln ?? ''}</span>
        <span className="d-code"><LineContent text={r.l} cp={r.cpL} /></span>
        {r.note && r.l !== null && <span className="d-note">{r.note}</span>}
      </div>
      <div className="d-cell">
        <span className="d-ln">{r.rn ?? ''}</span>
        <span className="d-code"><LineContent text={r.r} cp={r.cpR} /></span>
        {r.note && r.r !== null && <span className="d-note">{r.note}</span>}
      </div>
    </div>
  )
}

function UnifiedRowItem({ row, top, active, onExpand }: { row: UnifiedRow; top: number; active: number | null; onExpand: () => void }) {
  if (row.kind === 'expander') {
    return (
      <div className="d-row d-row-expander" style={{ top, height: ROW_H }}>
        <button type="button" className="d-expander" onClick={onExpand}>
          … {row.hidden} hidden lines
        </button>
      </div>
    )
  }
  const cls = row.sign === '+' ? 'd-add' : row.sign === '-' ? 'd-del' : 'd-ctx'
  const isActive = active !== null && row.fullIndex !== null && row.fullIndex === active
  return (
    <div className={`d-row d-row-unified ${cls} ${isActive ? 'd-row-active' : ''}`} style={{ top, height: ROW_H }}>
      <span className="d-ln">{row.ln ?? ''}</span>
      <span className="d-ln">{row.rn ?? ''}</span>
      <span className="d-sign">{row.sign}</span>
      <span className="d-code"><LineContent text={row.text} cp={row.cp} /></span>
      {row.note && <span className="d-note">{row.note}</span>}
    </div>
  )
}