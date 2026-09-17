export type MdActionId =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inlineCode'
  | 'link'
  | 'image'
  | 'quote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'codeBlock'
  | 'table'
  | 'mermaid'
  | 'horizontalRule'

export interface EditOutcome {
  text: string
  selectionStart: number
  selectionEnd: number
}

const CODE_BLOCK = '```\ncode\n```'
const MERMAID_BLOCK = '```mermaid\ngraph TD\n  A[Start] --> B[End]\n```'
const TABLE_BLOCK = '| Header | Header |\n| --- | --- |\n| Cell | Cell |'
const RULE_BLOCK = '---'

const LIST_PREFIX = /^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+|>\s?)+/

function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): EditOutcome {
  const selected = text.slice(start, end)
  const inner = selected.length > 0 ? selected : placeholder
  const inserted = before + inner + after
  const next = text.slice(0, start) + inserted + text.slice(end)
  const selectionStart = start + before.length
  return { text: next, selectionStart, selectionEnd: selectionStart + inner.length }
}

function insertLink(text: string, start: number, end: number, image: boolean): EditOutcome {
  const selected = text.slice(start, end)
  const label = selected.length > 0 ? selected : 'text'
  const prefix = image ? '![' : '['
  const inserted = `${prefix}${label}](url)`
  const next = text.slice(0, start) + inserted + text.slice(end)
  const urlStart = start + prefix.length + label.length + 2
  return { text: next, selectionStart: urlStart, selectionEnd: urlStart + 3 }
}

function setHeading(text: string, start: number, end: number, level: number): EditOutcome {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  let lineEnd = text.indexOf('\n', end)
  if (lineEnd === -1) lineEnd = text.length
  const block = text.slice(lineStart, lineEnd)
  const prefix = `${'#'.repeat(level)} `
  const lines = (block.length > 0 ? block.split('\n') : ['']).map((line) => {
    const match = /^(#{1,6})\s+(.*)$/.exec(line)
    const content = match ? match[2] : line
    const currentLevel = match ? match[1].length : 0
    return currentLevel === level ? content : prefix + content
  })
  const nextBlock = lines.join('\n')
  const next = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd)
  return { text: next, selectionStart: lineStart, selectionEnd: lineStart + nextBlock.length }
}

type ListKind = 'ul' | 'ol' | 'task' | 'quote'

function matchesKind(line: string, kind: ListKind): boolean {
  switch (kind) {
    case 'ul':
      return /^[-*+]\s+/.test(line) && !/^[-*+]\s+\[[ xX]\]/.test(line)
    case 'task':
      return /^[-*+]\s+\[[ xX]\]\s+/.test(line)
    case 'ol':
      return /^\d+\.\s+/.test(line)
    case 'quote':
      return /^>\s?/.test(line)
  }
}

function prefixLines(text: string, start: number, end: number, kind: ListKind): EditOutcome {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  let lineEnd = text.indexOf('\n', end)
  if (lineEnd === -1) lineEnd = text.length
  const block = text.slice(lineStart, lineEnd)
  const lines = block.length > 0 ? block.split('\n') : ['']
  const removing = lines.every((line) => matchesKind(line, kind))
  const result = lines.map((line, index) => {
    const content = line.replace(LIST_PREFIX, '')
    if (removing) return content
    switch (kind) {
      case 'ul':
        return `- ${content}`
      case 'ol':
        return `${index + 1}. ${content}`
      case 'task':
        return `- [ ] ${content}`
      case 'quote':
        return `> ${content}`
    }
  })
  const nextBlock = result.join('\n')
  const next = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd)
  return { text: next, selectionStart: lineStart, selectionEnd: lineStart + nextBlock.length }
}

export function insertImage(text: string, start: number, end: number, alt: string, src: string): EditOutcome {
  const safeAlt = (alt || 'image').replace(/["()\\]/g, '').trim() || 'image'
  const inserted = `![${safeAlt}](${src})`
  const next = text.slice(0, start) + inserted + text.slice(end)
  const cursor = start + inserted.length
  return { text: next, selectionStart: cursor, selectionEnd: cursor }
}

function insertBlock(
  text: string,
  start: number,
  end: number,
  block: string,
  placeholder?: string,
): EditOutcome {
  const before = text.slice(0, start)
  const after = text.slice(end)
  const lead = before.length > 0 && !before.endsWith('\n') ? '\n\n' : ''
  const trail = after.length > 0 && !after.startsWith('\n') ? '\n\n' : ''
  const inserted = lead + block + trail
  const next = before + inserted + after
  if (placeholder && block.includes(placeholder)) {
    const offset = start + lead.length + block.indexOf(placeholder)
    return { text: next, selectionStart: offset, selectionEnd: offset + placeholder.length }
  }
  const cursor = start + inserted.length
  return { text: next, selectionStart: cursor, selectionEnd: cursor }
}

export function applyAction(id: MdActionId, text: string, start: number, end: number): EditOutcome {
  switch (id) {
    case 'heading1':
      return setHeading(text, start, end, 1)
    case 'heading2':
      return setHeading(text, start, end, 2)
    case 'heading3':
      return setHeading(text, start, end, 3)
    case 'bold':
      return wrapSelection(text, start, end, '**', '**', 'bold text')
    case 'italic':
      return wrapSelection(text, start, end, '*', '*', 'italic text')
    case 'strikethrough':
      return wrapSelection(text, start, end, '~~', '~~', 'strikethrough')
    case 'inlineCode':
      return wrapSelection(text, start, end, '`', '`', 'code')
    case 'link':
      return insertLink(text, start, end, false)
    case 'image':
      return insertLink(text, start, end, true)
    case 'quote':
      return prefixLines(text, start, end, 'quote')
    case 'bulletList':
      return prefixLines(text, start, end, 'ul')
    case 'orderedList':
      return prefixLines(text, start, end, 'ol')
    case 'taskList':
      return prefixLines(text, start, end, 'task')
    case 'codeBlock':
      return insertBlock(text, start, end, CODE_BLOCK, 'code')
    case 'table':
      return insertBlock(text, start, end, TABLE_BLOCK, 'Header')
    case 'mermaid':
      return insertBlock(text, start, end, MERMAID_BLOCK)
    case 'horizontalRule':
      return insertBlock(text, start, end, RULE_BLOCK)
  }
}
