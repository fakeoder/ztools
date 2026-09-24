import type { IcsCalendarDoc, IcsDateTime, IcsEvent, IcsParam } from './types'
import { escapeTextLine, localToCompact, newUid, nowIcsStamp, ymdToCompact } from './util'

const encoder = new TextEncoder()

/** Fold a content line at 75 octets (RFC 5545 §3.1), CRLF-joined continuations. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let cur = ''
  let curLen = 0
  let limit = 75
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (curLen + size > limit) {
      parts.push(cur)
      cur = ch
      curLen = size
      limit = 74
    } else {
      cur += ch
      curLen += size
    }
  }
  if (cur) parts.push(cur)
  return parts.map((part, idx) => (idx === 0 ? part : ` ${part}`)).join('\r\n')
}

function quoteParam(value: string): string {
  return /[";:,\s]/.test(value) ? `"${value.replace(/"/g, '')}"` : value
}

export function formatProp(name: string, params: IcsParam[], value: string): string {
  const suffix = params
    .filter((p) => p.value !== '')
    .map((p) => `;${p.name}=${quoteParam(p.value)}`)
    .join('')
  return `${name}${suffix}:${value}`
}

function dateTimeProp(name: string, dt: IcsDateTime): string {
  const params: IcsParam[] = []
  if (dt.kind === 'date') {
    params.push({ name: 'VALUE', value: 'DATE' })
    if (dt.tzid) params.push({ name: 'TZID', value: dt.tzid })
    return formatProp(name, params, ymdToCompact(dt.local))
  }
  if (dt.utc) {
    return formatProp(name, params, `${localToCompact(dt.local)}Z`)
  }
  if (dt.tzid) params.push({ name: 'TZID', value: dt.tzid })
  return formatProp(name, params, localToCompact(dt.local))
}

function buildEvent(event: IcsEvent): string[] {
  const out: string[] = ['BEGIN:VEVENT']
  out.push(`UID:${event.uid || newUid()}`)
  out.push(`DTSTAMP:${event.dtstamp || nowIcsStamp()}`)
  out.push(formatProp('SUMMARY', [], escapeTextLine(event.summary)))
  if (event.start) out.push(dateTimeProp('DTSTART', event.start))
  if (event.end) out.push(dateTimeProp('DTEND', event.end))
  if (event.rrule) out.push(`RRULE:${event.rrule}`)
  if (event.location) out.push(formatProp('LOCATION', [], escapeTextLine(event.location)))
  if (event.description) out.push(formatProp('DESCRIPTION', [], escapeTextLine(event.description)))
  if (event.url) out.push(`URL:${event.url}`)
  if (event.status) out.push(`STATUS:${event.status}`)
  if (event.categories) out.push(formatProp('CATEGORIES', [], escapeTextLine(event.categories)))
  out.push(...event.extras)
  out.push('END:VEVENT')
  return out
}

/** Serialize a calendar model to .ics text (CRLF, folded lines). */
export function buildIcs(doc: IcsCalendarDoc): string {
  const lines: string[] = ['BEGIN:VCALENDAR']
  lines.push(`VERSION:${doc.version || '2.0'}`)
  lines.push(`PRODID:${doc.productId || '-//ztools//ICS Calendar Editor//EN'}`)
  if (doc.calscale) lines.push(`CALSCALE:${doc.calscale}`)
  if (doc.method) lines.push(`METHOD:${doc.method}`)
  if (doc.name) lines.push(formatProp('X-WR-CALNAME', [], escapeTextLine(doc.name)))
  if (doc.description) lines.push(formatProp('X-WR-CALDESC', [], escapeTextLine(doc.description)))
  lines.push(...doc.extras)
  lines.push(...doc.blocks)
  for (const event of doc.events) lines.push(...buildEvent(event))
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
