export type IcsParam = { name: string; value: string }

export type IcsProp = {
  name: string
  params: IcsParam[]
  value: string
}

/** DATE or DATE-TIME value. `local` holds literal calendar components without
 *  any zone applied: 'YYYY-MM-DD' for DATE, 'YYYY-MM-DDTHH:mm:ss' for DATE-TIME. */
export type IcsDateTime = {
  kind: 'date' | 'datetime'
  local: string
  utc: boolean
  tzid?: string
}

export type IcsEvent = {
  uid: string
  dtstamp?: string
  summary: string
  description: string
  location: string
  url: string
  status: string
  categories: string
  start?: IcsDateTime
  /** DTEND semantics: for DATE values the end is exclusive (RFC 5545). */
  end?: IcsDateTime
  /** Raw RRULE value, without the 'RRULE:' prefix. */
  rrule?: string
  /** Unfolded raw lines preserved verbatim (unknown properties, VALARM blocks…). */
  extras: string[]
}

export type IcsCalendarDoc = {
  version: string
  productId: string
  calscale?: string
  method?: string
  /** X-WR-CALNAME */
  name?: string
  /** X-WR-CALDESC */
  description?: string
  /** Calendar-level unknown raw lines. */
  extras: string[]
  /** Raw unfolded lines of other top-level components (VTIMEZONE, VTODO…). */
  blocks: string[]
  events: IcsEvent[]
}
