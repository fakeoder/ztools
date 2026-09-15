import { computeDiff } from './engine'
import type { DiffOptions, DiffResult } from './types'

interface WorkerRequest {
  id: number
  left: string
  right: string
  options: DiffOptions
}

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const { id, left, right, options } = e.data
  let result: DiffResult
  try {
    result = computeDiff(left, right, options)
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      rows: [],
      stats: { added: 0, removed: 0, modified: 0, moved: 0 },
      changes: [],
      patch: [],
      patchJson: '[]',
      reportHtml: '',
      ignoredCount: 0,
    }
  }
  ;(self as unknown as Worker).postMessage({ id, result })
})