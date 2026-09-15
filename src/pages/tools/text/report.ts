import type { TextDiffRow, TextDiffStats } from './types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function rowHtml(cls: string, ln: number | null, rn: number | null, sign: string, text: string): string {
  return `<div class="${cls}"><span class="d-ln">${ln ?? ''}</span><span class="d-ln">${rn ?? ''}</span><span class="d-sign">${sign}</span><span class="d-code">${esc(text)}</span></div>`
}

function buildReportBody(rows: TextDiffRow[]): string {
  const out: string[] = []
  for (const row of rows) {
    switch (row.kind) {
      case 'context':
        out.push(rowHtml('d-ctx', row.ln, row.rn, ' ', row.l ?? ''))
        break
      case 'removed':
        out.push(rowHtml('d-del', row.ln, null, '-', row.l ?? ''))
        break
      case 'added':
        out.push(rowHtml('d-add', null, row.rn, '+', row.r ?? ''))
        break
      case 'modified':
        out.push(rowHtml('d-mod', row.ln, null, '~', row.l ?? ''))
        out.push(rowHtml('d-mod', null, row.rn, '~', row.r ?? ''))
        break
    }
  }
  return out.join('\n')
}

export function buildReportHtml(rows: TextDiffRow[], stats: TextDiffStats): string {
  const css = `
    body { margin: 0; padding: 24px; background: #fff; color: #1f2328; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; }
    .stat { margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #57606a; }
    .diff { border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; }
    .d-ctx { background: #fff; color: #1f2328; }
    .d-add { background: #e6ffec; color: #1a7f37; }
    .d-del { background: #ffebe9; color: #cf222e; }
    .d-mod { background: #fff8c5; color: #4d2d00; }
    .d-ln { display: inline-block; min-width: 2.6em; text-align: right; padding-right: 0.6em; color: #8c959f; user-select: none; }
    .d-sign { display: inline-block; width: 1.4em; text-align: center; user-select: none; }
    .d-code { white-space: pre; }
  `
  const total = stats.added + stats.removed + stats.modified
  const head =
    total === 0
      ? '<div class="stat">The two texts are identical.</div>'
      : `<div class="stat">+${stats.added} added · -${stats.removed} removed · ~${stats.modified} modified</div>`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Text Diff Report</title>
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
