import type { IcsDateTime } from './types'

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
export const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

export function isYmd(value: string): boolean {
  return YMD_RE.test(value)
}

export function isLocalDatetime(value: string): boolean {
  return LOCAL_DT_RE.test(value)
}

export function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Add or subtract days on a 'YYYY-MM-DD' string using UTC math (no DST shifts). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000
  const out = new Date(t)
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`
}

/** 'YYYY-MM-DDTHH:mm' (datetime-local input) → stored 'YYYY-MM-DDTHH:mm:ss'. */
export function inputToDatetime(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}

/** Stored 'YYYY-MM-DDTHH:mm:ss' → datetime-local input value. */
export function datetimeToInput(local: string): string {
  return local.slice(0, 16)
}

/** RFC 5545 DATE-TIME compact form → 'YYYY-MM-DD' part. */
export function compactToDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

/** 'YYYY-MM-DD' → compact 'YYYYMMDD'. */
export function ymdToCompact(ymd: string): string {
  return ymd.replace(/-/g, '')
}

/** 'YYYY-MM-DDTHH:mm:ss' → compact 'YYYYMMDDTHHMMSS'. */
export function localToCompact(local: string): string {
  return local.replace(/[-:]/g, '')
}

/** Escape a TEXT value per RFC 5545 §3.3.11. */
export function escapeTextLine(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

export function nowIcsStamp(): string {
  const d = new Date()
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

export function newUid(): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${id}@ztools.local`
}

/** Inclusive end date shown in the UI for all-day events (DTEND is exclusive). */
export function allDayUiEnd(startYmd: string, endExclusive?: string): string {
  if (!endExclusive) return startYmd
  const inclusive = addDaysYmd(endExclusive, -1)
  return inclusive < startYmd ? startYmd : inclusive
}

/** Inclusive UI end date → exclusive DTEND date. */
export function allDayEndExclusive(endInclusive: string): string {
  return addDaysYmd(endInclusive, 1)
}

/** Timed event → all-day range (inclusive UI end). Handles midnight-spanning ends. */
export function timedToAllDay(start?: IcsDateTime, end?: IcsDateTime): { start: string; end: string } {
  const s = start?.local.slice(0, 10) ?? todayYmd()
  let e = end?.local.slice(0, 10) ?? s
  if (end && end.kind === 'datetime' && end.local.slice(11) === '00:00:00') {
    e = addDaysYmd(e, -1)
  }
  if (e < s) e = s
  return { start: s, end: e }
}

/** All-day start date → timed start/end spanning the same wall-clock days. */
export function allDayToTimed(startYmd: string): { start: string; end: string } {
  const endExclusive = addDaysYmd(startYmd, 1)
  return { start: `${startYmd}T00:00:00`, end: `${endExclusive}T00:00:00` }
}

const DURATION_RE =
  /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?(?:(\d+)M)?(?:(\d+)Y)?$/i

/**
 * Apply an ISO 8601 duration to a date-time using wall-clock math (no DST).
 * Returns undefined for durations with month/year parts or malformed input.
 */
export function addIcsDuration(start: IcsDateTime, duration: string): IcsDateTime | undefined {
  const m = DURATION_RE.exec(duration.trim())
  if (!m) return undefined
  const [, w, d, h, min, s, mo, y] = m
  if (mo || y) return undefined
  const dayPart = start.local.slice(0, 10)
  const [Y, M, D] = dayPart.split('-').map(Number)
  const hasTimePart = start.kind === 'datetime'
  const [hh, mm, ss] = hasTimePart ? start.local.slice(11).split(':').map(Number) : [0, 0, 0]

  const days = (w ? Number(w) * 7 : 0) + (d ? Number(d) : 0)
  const seconds =
    (h ? Number(h) * 3600 : 0) + (min ? Number(min) * 60 : 0) + (s ? Number(s) : 0)

  const base = Date.UTC(Y, M - 1, D) + days * 86_400_000
  const withTime = base + (((hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0)) + seconds) * 1000
  const out = new Date(withTime)
  const date = `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`

  if (!hasTimePart) {
    if (seconds !== 0) return undefined
    return { kind: 'date', local: date, utc: false, tzid: start.tzid }
  }
  const time = `${pad(out.getUTCHours())}:${pad(out.getUTCMinutes())}:${pad(out.getUTCSeconds())}`
  return { kind: 'datetime', local: `${date}T${time}`, utc: start.utc, tzid: start.tzid }
}

export function isValidIcsDuration(duration: string): boolean {
  return DURATION_RE.test(duration.trim())
}

export const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ztools//ICS Calendar Editor//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:My Calendar
X-WR-CALDESC:Sample calendar made with the ztools ICS editor
BEGIN:VTIMEZONE
TZID:Asia/Shanghai
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:CST
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:sample-weekly-sync@ztools.local
DTSTAMP:20260101T120000Z
DTSTART:20260105T090000Z
DTEND:20260105T100000Z
SUMMARY:Weekly sync
LOCATION:Room 101
DESCRIPTION:Agenda:\\n- Updates\\n- Blockers\\n- Next steps
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:sample-conference-trip@ztools.local
DTSTAMP:20260101T120000Z
DTSTART;VALUE=DATE:20260210
DTEND;VALUE=DATE:20260213
SUMMARY:Conference trip
LOCATION:Berlin
DESCRIPTION:Fly out Tuesday morning\\, back Friday evening.
END:VEVENT
BEGIN:VEVENT
UID:sample-dentist@ztools.local
DTSTAMP:20260101T120000Z
DTSTART;TZID=Asia/Shanghai:20260115T143000
DTEND;TZID=Asia/Shanghai:20260115T153000
SUMMARY:Dentist appointment
LOCATION:Clinic on Nanjing Road
END:VEVENT
END:VCALENDAR
`
