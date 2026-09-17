import DOMPurify from 'dompurify'
import { marked } from 'marked'

type MermaidApi = (typeof import('mermaid'))['default']

let mermaidPromise: Promise<MermaidApi> | null = null
let mermaidTheme: 'light' | 'dark' | null = null

function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function configure(mermaid: MermaidApi): void {
  const theme = currentTheme()
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  })
  mermaidTheme = theme
}

async function ensureMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      configure(mod.default)
      return mod.default
    })
  }
  const mermaid = await mermaidPromise
  if (currentTheme() !== mermaidTheme) configure(mermaid)
  return mermaid
}

export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false, gfm: true })
  return DOMPurify.sanitize(raw)
}

async function hydrateMermaid(
  container: HTMLElement,
  token: number,
  isStale: () => boolean,
): Promise<void> {
  const nodes = Array.from(container.querySelectorAll('code.language-mermaid'))
  if (nodes.length === 0) return

  let mermaid: MermaidApi
  try {
    mermaid = await ensureMermaid()
  } catch {
    return
  }
  if (isStale()) return

  let index = 0
  for (const node of nodes) {
    const source = node.textContent ?? ''
    const target = node.closest('pre') ?? node
    const id = `md-mermaid-${token}-${index++}`
    try {
      const { svg } = await mermaid.render(id, source)
      if (isStale()) return
      const wrapper = document.createElement('div')
      wrapper.className = 'md-mermaid'
      wrapper.innerHTML = svg
      target.replaceWith(wrapper)
    } catch (err) {
      if (isStale()) return
      const wrapper = document.createElement('div')
      wrapper.className = 'md-mermaid-error'
      const message = document.createElement('p')
      message.textContent = err instanceof Error ? err.message : String(err)
      const code = document.createElement('pre')
      code.textContent = source
      wrapper.append(message, code)
      target.replaceWith(wrapper)
    }
  }
}

export async function renderPreview(
  container: HTMLElement,
  markdown: string,
  token: number,
  isStale: () => boolean,
): Promise<void> {
  container.innerHTML = renderMarkdown(markdown)
  for (const link of Array.from(container.querySelectorAll('a[href]'))) {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  }
  await hydrateMermaid(container, token, isStale)
}
