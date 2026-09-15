import { computeTextDiff } from './engine'
import type { TextDiffOptions, TextDiffResult } from './types'

interface WorkerRequest {
  id: number
  left: string
  right: string
  options: TextDiffOptions
}

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const { id, left, right, options } = e.data
  let result: TextDiffResult
  try {
    result = computeTextDiff(left, right, options)
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      rows: [],
      stats: { added: 0, removed: 0, modified: 0 },
      changes: [],
      reportHtml: '',
    }
  }
  ;(self as unknown as Worker).postMessage({ id, result })
})
