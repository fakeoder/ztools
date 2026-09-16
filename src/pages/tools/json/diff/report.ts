import type { DiffRow, DiffStats } from './types'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function rowClass(kind: string): string {
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

function sign(kind: string): string {
  if (kind === 'added') return '+'
  if (kind === 'removed') return '-'
  if (kind === 'moved') return '⇄'
  if (kind === 'modified') return '~'
  return ' '
}

function buildReportBody(rows: DiffRow[]): string {
  const out: string[] = []
  for (const row of rows) {
    const cls = rowClass(row.kind)
    const text = row.kind === 'added' || row.kind === 'moved' ? row.r : row.l
    const line = text ?? ''
    const note = row.note ? ` <span class="d-note">${esc(row.note)}</span>` : ''
    out.push(`<div class="${cls}"><span class="d-sign">${sign(row.kind)}</span><span class="d-code">${esc(line)}${note}</span></div>`)
  }
  return out.join('\n')
}

export function buildReportHtml(rows: DiffRow[], stats: DiffStats, ignoredCount: number): string {
  const css = `
    body { margin: 0; padding: 24px; background: #fff; color: #1f2328; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; }
    .stat { margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #57606a; }
    .stat b { font-weight: 700; }
    .diff { border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; }
    .d-ctx { background: #fff; color: #1f2328; }
    .d-add { background: #e6ffec; color: #1a7f37; }
    .d-del { background: #ffebe9; color: #cf222e; }
    .d-mod { background: #fff8c5; color: #4d2d00; }
    .d-move { background: #f0f0ff; color: #6f42c1; }
    .d-ign { background: #f6f8fa; color: #8c959f; }
    .d-sign { display: inline-block; width: 1.4em; text-align: center; user-select: none; }
    .d-code { white-space: pre; }
    .d-note { color: #6f42c1; font-style: italic; }
  `
  const total = stats.added + stats.removed + stats.modified + stats.moved
  const head =
    total === 0 && ignoredCount === 0
      ? '<div class="stat">The two documents are identical.</div>'
      : `<div class="stat">+${stats.added} added · -${stats.removed} removed · ~${stats.modified} modified · \u21C4${stats.moved} moved` +
        (ignoredCount > 0 ? ` · ${ignoredCount} ignored` : '') +
        '</div>'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>JSON Diff Report</title>
<style>${css}</style>
</head>
<body>
${head}
<div class="diff">
${buildReportBody(rows)}
</div>
</body>
</html>`
}