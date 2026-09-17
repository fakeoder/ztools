const PRINT_CSS = `
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #1f2328;
    background: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    font-size: 12pt;
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.4em 0 0.6em; }
  h1 { font-size: 1.8em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1.1em; }
  p { margin: 0.8em 0; }
  a { color: #0969da; text-decoration: underline; }
  ul, ol { padding-left: 1.6em; margin: 0.8em 0; }
  ul { list-style: disc; }
  ol { list-style: decimal; }
  li { margin: 0.25em 0; }
  li > ul, li > ol { margin: 0.3em 0; }
  blockquote {
    margin: 1em 0;
    padding: 0.4em 1em;
    border-left: 3px solid #d0d7de;
    background: #f6f8fa;
    color: #57606a;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 0.88em;
    background: #f6f8fa;
    padding: 0.15em 0.35em;
    border-radius: 4px;
  }
  pre {
    background: #f6f8fa;
    padding: 12px;
    border-radius: 8px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; }
  th { background: #f6f8fa; }
  img, svg { max-width: 100% !important; height: auto; }
  .md-mermaid { margin: 1.2em 0; text-align: center; }
  .md-mermaid svg { max-width: 100% !important; height: auto; }
  .md-mermaid-error {
    color: #cf222e;
    border: 1px solid rgba(255, 129, 130, 0.4);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.9em;
  }
  h1, h2, h3, h4, h5, h6, tr, pre, blockquote, .md-mermaid { break-inside: avoid; }
`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function downloadMarkdown(markdown: string, filename: string): void {
  const name = /\.(md|markdown|txt)$/i.test(filename) ? filename : `${filename || 'document'}.md`
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function exportPdf(bodyHtml: string, title: string): void {
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }))
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      iframe.remove()
    }, 0)
  }

  iframe.onload = () => {
    const win = iframe.contentWindow
    if (!win) {
      cleanup()
      return
    }
    try {
      win.focus()
      win.print()
    } catch {
      // printing unavailable
    } finally {
      cleanup()
    }
  }

  iframe.src = url
  document.body.appendChild(iframe)
}
