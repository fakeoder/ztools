const BIGINT_TAG = '\u0001ztools:bigint\u0001'

const MAX_SAFE_TEXT = '9007199254740991'

const NUM_RE = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/
const DIGIT = /[0-9]/

export function isBigIntTagged(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(BIGINT_TAG)
}

export function decodeBigInt(v: string): string {
  return v.slice(BIGINT_TAG.length)
}

function encodeBigInt(raw: string): string {
  return BIGINT_TAG + raw
}

function isUnsafeIntegerLiteral(numText: string): boolean {
  if (numText.startsWith('-')) numText = numText.slice(1)
  if (numText.length < 16) return false
  if (numText.length > 16) return true
  return numText > MAX_SAFE_TEXT
}

/**
 * Replaces integer literals whose value exceeds 2^53-1 with quoted tagged
 * strings so that JSON.parse keeps their exact digits. Only integer literals
 * outside of string literals are touched.
 */
export function preserveBigIntegers(text: string): string {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const ch = text[i]
    if (ch === '"') {
      let j = i + 1
      let esc = false
      while (j < n) {
        const c = text[j]
        if (esc) {
          esc = false
          j++
          continue
        }
        if (c === '\\') {
          esc = true
          j++
          continue
        }
        if (c === '"') {
          j++
          break
        }
        j++
      }
      out += text.slice(i, j)
      i = j
      continue
    }
    if (ch === '-' || ch === '.' || DIGIT.test(ch)) {
      let j = i
      if (text[j] === '-') j++
      while (j < n && DIGIT.test(text[j])) j++
      if (text[j] === '.') {
        j++
        while (j < n && DIGIT.test(text[j])) j++
      }
      if (text[j] === 'e' || text[j] === 'E') {
        j++
        if (text[j] === '+' || text[j] === '-') j++
        while (j < n && DIGIT.test(text[j])) j++
      }
      const tok = text.slice(i, j)
      if (NUM_RE.test(tok) && !tok.includes('.') && !/[eE]/.test(tok)) {
        if (isUnsafeIntegerLiteral(tok)) {
          out += JSON.stringify(encodeBigInt(tok))
          i = j
          continue
        }
        out += tok
        i = j
        continue
      }
    }
    out += ch
    i++
  }
  return out
}