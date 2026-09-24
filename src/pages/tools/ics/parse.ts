import type { IcsCalendarDoc, IcsDateTime, IcsEvent, IcsProp } from './types'
import { addIcsDuration, compactToDate, isValidIcsDuration, newUid } from './util'

export class IcsParseError extends Error {}

export function normalizeNewlines(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** Unfold RFC 5545 content lines into logical lines. */
export function unfoldLines(text: string): string[] {
  const normalized = normalizeNewlines(text)
  const out: string[] = []
  for (const line of normalized.split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** Parse a single content line: NAME;PARAM=value…:value (quotes respected). */
export function parseContentLine(line: string): IcsProp | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  let inQuotes = false
  let colon = -1
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ':' && !inQuotes) {
      colon = i
      break
    }
  }
  if (colon === -1) return null

  const head = trimmed.slice(0, colon)
  const value = trimmed.slice(colon + 1)

  const segments: string[] = []
  let cur = ''
  inQuotes = false
  for (let i = 0; i < head.length; i++) {
    const ch = head[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      cur += ch
    } else if (ch === ';' && !inQuotes) {
      segments.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  segments.push(cur)

  const name = segments[0].trim().toUpperCase()
  if (!name) return null

  const params = segments.slice(1).filter((s) => s.trim() !== '').map((seg) => {
    const eq = seg.indexOf('=')
    if (eq === -1) return { name: seg.trim().toUpperCase(), value: '' }
    const key = seg.slice(0, eq).trim().toUpperCase()
    let raw = seg.slice(eq + 1).trim()
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
      raw = raw.slice(1, -1)
    }
    return { name: key, value: raw }
  })

  return { name, params, value }
}

export function getParam(prop: IcsProp, name: string): string | undefined {
  return prop.params.find((p) => p.name === name)?.value
}

export function unescapeText(value: string): string {
  return value.replace(/\\[\\nN,;]/g, (m) => {
    switch (m[1]) {
      case '\\':
        return '\\'
      case 'n':
      case 'N':
        return '\n'
      case ',':
        return ','
      case ';':
        return ';'
      default:
        return m
    }
  })
}

const DT_RE = /^(\d{8})(?:T(\d{6})(Z)?)?$/

export function parseDateTimeProp(prop: IcsProp): IcsDateTime | undefined {
  const m = DT_RE.exec(prop.value.trim())
  if (!m) return undefined
  const [, date, time, z] = m
  const tzid = getParam(prop, 'TZID')
  if (!time) {
    return { kind: 'date', local: compactToDate(date), utc: false, tzid }
  }
  const local = `${compactToDate(date)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`
  return { kind: 'datetime', local, utc: Boolean(z), tzid: z ? undefined : tzid }
}

type Lines = { lines: string[]; next: number }

/** Collect a BEGIN/END-delimited component starting at `start` (inclusive). */
function collectComponent(all: string[], start: number): Lines {
  let depth = 0
  const out: string[] = []
  for (let i = start; i < all.length; i++) {
    const line = all[i]
    const prop = parseContentLine(line)
    if (prop?.name === 'BEGIN') depth++
    else if (prop?.name === 'END') {
      depth--
      if (depth <= 0) {
        out.push(line)
        return { lines: out, next: i + 1 }
      }
    }
    out.push(line)
  }
  throw new IcsParseError('unterminated component')
}

const EVENT_TEXT_PROPS: Record<string, keyof Pick<IcsEvent, 'summary' | 'description' | 'location' | 'url' | 'status' | 'categories'>> = {
  SUMMARY: 'summary',
  DESCRIPTION: 'description',
  LOCATION: 'location',
  URL: 'url',
  STATUS: 'status',
  CATEGORIES: 'categories',
}

function parseEvent(rawLines: string[]): IcsEvent {
  const event: IcsEvent = {
    uid: '',
    summary: '',
    description: '',
    location: '',
    url: '',
    status: '',
    categories: '',
    extras: [],
  }
  let duration: string | undefined

  // Skip BEGIN:VEVENT … END:VEVENT
  for (let i = 1; i < rawLines.length - 1; i++) {
    const line = rawLines[i]
    const prop = parseContentLine(line)
    if (!prop) continue

    if (prop.name === 'BEGIN') {
      const block = collectComponent(rawLines, i)
      event.extras.push(...block.lines)
      i = block.next - 1
      continue
    }
    if (prop.name === 'END') continue

    const textField = EVENT_TEXT_PROPS[prop.name]
    if (textField) {
      event[textField] = unescapeText(prop.value)
      continue
    }

    switch (prop.name) {
      case 'UID':
        event.uid = prop.value.trim()
        break
      case 'DTSTAMP':
        event.dtstamp = prop.value.trim()
        break
      case 'DTSTART':
        event.start = parseDateTimeProp(prop)
        break
      case 'DTEND':
        event.end = parseDateTimeProp(prop)
        break
      case 'DURATION':
        duration = prop.value.trim()
        break
      case 'RRULE':
        event.rrule = prop.value.trim()
        break
      default:
        event.extras.push(line)
    }
  }

  if (!event.uid) event.uid = newUid()
  if (!event.end && event.start && duration && isValidIcsDuration(duration)) {
    const computed = addIcsDuration(event.start, duration)
    if (computed) event.end = computed
    else event.extras.push(`DURATION:${duration}`)
  } else if (!event.end && duration) {
    event.extras.push(`DURATION:${duration}`)
  }

  return event
}

const CAL_TEXT_PROPS: Record<string, 'name' | 'description'> = {
  'X-WR-CALNAME': 'name',
  'X-WR-CALDESC': 'description',
}

/** Parse an .ics document into an editable calendar model. */
export function parseIcs(text: string): IcsCalendarDoc {
  const lines = unfoldLines(text)
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++

  const first = parseContentLine(lines[i] ?? '')
  if (!first || first.name !== 'BEGIN' || first.value.trim().toUpperCase() !== 'VCALENDAR') {
    throw new IcsParseError('missing BEGIN:VCALENDAR')
  }
  i++

  const doc: IcsCalendarDoc = {
    version: '2.0',
    productId: '-//ztools//ICS Calendar Editor//EN',
    extras: [],
    blocks: [],
    events: [],
  }

  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const prop = parseContentLine(line)
    if (!prop) {
      doc.extras.push(line)
      continue
    }

    if (prop.name === 'BEGIN') {
      const component = prop.value.trim().toUpperCase()
      const block = collectComponent(lines, i)
      i = block.next - 1
      if (component === 'VEVENT') {
        doc.events.push(parseEvent(block.lines))
      } else {
        doc.blocks.push(...block.lines)
      }
      continue
    }

    if (prop.name === 'END') {
      if (prop.value.trim().toUpperCase() === 'VCALENDAR') break
      continue
    }

    const textField = CAL_TEXT_PROPS[prop.name]
    if (textField) {
      doc[textField] = unescapeText(prop.value)
      continue
    }

    switch (prop.name) {
      case 'VERSION':
        doc.version = prop.value.trim() || '2.0'
        break
      case 'PRODID':
        doc.productId = prop.value
        break
      case 'CALSCALE':
        doc.calscale = prop.value.trim()
        break
      case 'METHOD':
        doc.method = prop.value.trim()
        break
      default:
        doc.extras.push(line)
    }
  }

  return doc
}

/** Create an empty calendar document. */
export function emptyCalendar(): IcsCalendarDoc {
  return {
    version: '2.0',
    productId: '-//ztools//ICS Calendar Editor//EN',
    extras: [],
    blocks: [],
    events: [],
  }
}
