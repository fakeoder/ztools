export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const RRULE_FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RRuleFreq = (typeof RRULE_FREQS)[number]

/** Parsed RRULE. Unknown parts are kept in `extra` so nothing is lost on rebuild. */
export type RRuleModel = {
  freq: RRuleFreq
  interval: number
  byDay: string[]
  count?: number
  until?: string
  extra: [string, string][]
}

export function isWeekday(token: string): token is Weekday {
  return (WEEKDAYS as readonly string[]).includes(token)
}

/** Parse a raw RRULE value (with or without the 'RRULE:' prefix). */
export function parseRRule(raw: string | undefined | null): RRuleModel | null {
  if (!raw || !raw.trim()) return null
  let body = raw.trim()
  const m = /^RRULE\s*:/i.exec(body)
  if (m) body = body.slice(m[0].length)

  const parts: [string, string][] = []
  for (const chunk of body.split(';')) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) return null
    parts.push([trimmed.slice(0, eq).trim().toUpperCase(), trimmed.slice(eq + 1).trim()])
  }

  const freqRaw = parts.find(([k]) => k === 'FREQ')?.[1].toUpperCase()
  if (!freqRaw || !(RRULE_FREQS as readonly string[]).includes(freqRaw)) return null

  const intervalRaw = parts.find(([k]) => k === 'INTERVAL')?.[1]
  const interval = intervalRaw ? Number.parseInt(intervalRaw, 10) : 1
  const countRaw = parts.find(([k]) => k === 'COUNT')?.[1]
  const count = countRaw ? Number.parseInt(countRaw, 10) : undefined
  const until = parts.find(([k]) => k === 'UNTIL')?.[1]
  const byDayRaw = parts.find(([k]) => k === 'BYDAY')?.[1]
  const byDay = byDayRaw ? byDayRaw.split(',').map((d) => d.trim()).filter(Boolean) : []

  const extra = parts.filter(
    ([k]) => k !== 'FREQ' && k !== 'INTERVAL' && k !== 'COUNT' && k !== 'UNTIL' && k !== 'BYDAY',
  )

  return {
    freq: freqRaw as RRuleFreq,
    interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
    byDay,
    count: count !== undefined && Number.isFinite(count) && count > 0 ? count : undefined,
    until: until || undefined,
    extra,
  }
}

export function buildRRule(model: RRuleModel): string {
  const parts: string[] = [`FREQ=${model.freq}`]
  if (model.interval > 1) parts.push(`INTERVAL=${model.interval}`)
  if (model.byDay.length > 0) parts.push(`BYDAY=${model.byDay.join(',')}`)
  if (model.count !== undefined) parts.push(`COUNT=${model.count}`)
  else if (model.until) parts.push(`UNTIL=${model.until}`)
  for (const [k, v] of model.extra) parts.push(`${k}=${v}`)
  return parts.join(';')
}

/** UNTIL value for a picked end date: date-only for all-day, UTC end-of-day otherwise. */
export function untilFromYmd(ymd: string, allDay: boolean): string {
  return allDay ? ymd.replace(/-/g, '') : `${ymd.replace(/-/g, '')}T235959Z`
}

/** Extract the 'YYYY-MM-DD' part of an UNTIL value for a date input. */
export function untilToDate(raw: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}
