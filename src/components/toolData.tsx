import type { ReactNode } from 'react'

export type Tool = {
  id: string
  tags: string[]
  icon: ReactNode
}

export const ALL_TAG = '__all__'

export const TOOLS: Tool[] = [
  {
    id: 'json_diff',
    tags: ['data'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    id: 'text_diff',
    tags: ['data', 'text'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6h10M4 12h16M4 18h10" />
        <path d="M18 4v6M15 7h6" />
      </svg>
    ),
  },
  {
    id: 'json_format',
    tags: ['data', 'json', 'format'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: 'favicon',
    tags: ['design', 'image'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M12 8.5v7M8.5 15.5h7" />
      </svg>
    ),
  },
  {
    id: 'markdown',
    tags: ['text', 'format', 'markdown'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 1.5 17V7a2.5 2.5 0 0 1 2.5-2.5h16A2.5 2.5 0 0 1 22.5 7v10a2.5 2.5 0 0 1-2.5 2.5z" />
        <path d="M7 16V8l3.5 4L14 8v8" />
      </svg>
    ),
  },
  {
    id: 'encrypt',
    tags: ['security', 'text'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
  {
    id: 'html_viewer',
    tags: ['code', 'text'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M10 13l-2 2 2 2" />
        <path d="M14 13l2 2-2 2" />
      </svg>
    ),
  },
  {
    id: 'timestamp',
    tags: ['time'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: 'ics_calendar',
    tags: ['time', 'data'],
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <path d="M8 15h3M13 15h3M8 18h6" />
      </svg>
    ),
  },
]

export const TOOL_TAGS = Array.from(new Set(TOOLS.flatMap((tool) => tool.tags)))
