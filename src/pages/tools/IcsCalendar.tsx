import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import LineNumberedTextarea from '../../components/LineNumberedTextarea'
import { buildIcs } from './ics/build'
import { emptyCalendar, parseIcs } from './ics/parse'
import {
  buildRRule,
  isWeekday,
  parseRRule,
  untilFromYmd,
  untilToDate,
  WEEKDAYS,
  type RRuleFreq,
  type RRuleModel,
} from './ics/rrule'
import type { IcsCalendarDoc, IcsDateTime, IcsEvent } from './ics/types'
import {
  addDaysYmd,
  addIcsDuration,
  allDayEndExclusive,
  allDayToTimed,
  allDayUiEnd,
  datetimeToInput,
  inputToDatetime,
  newUid,
  nowIcsStamp,
  SAMPLE_ICS,
  timedToAllDay,
  todayYmd,
} from './ics/util'

const MAX_SIZE = 5 * 1024 * 1024

const STANDARD_FREQS: RRuleFreq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

type ViewMode = 'form' | 'raw'

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${+(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function download(content: string, name: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function eventWhen(event: IcsEvent): string {
  if (!event.start) return ''
  if (event.start.kind === 'date') {
    const start = event.start.local
    const end = event.end ? allDayUiEnd(start, event.end.local) : start
    return end === start ? start : `${start} → ${end}`
  }
  const start = datetimeToInput(event.start.local).replace('T', ' ')
  if (!event.end) return start
  const end = datetimeToInput(event.end.local).replace('T', ' ')
  return `${start} → ${end}`
}

function dedupeUids(doc: IcsCalendarDoc): IcsCalendarDoc {
  const seen = new Set<string>()
  for (const event of doc.events) {
    if (seen.has(event.uid)) event.uid = newUid()
    seen.add(event.uid)
  }
  return doc
}

export default function IcsCalendar() {
  const { t } = useTranslation()
  const [doc, setDoc] = useState<IcsCalendarDoc | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState('calendar.ics')
  const [view, setView] = useState<ViewMode>('form')
  const [rawText, setRawText] = useState('')
  const [rawError, setRawError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const toolTags = useMemo(() => t('tools:ics_calendar.tags', { returnObjects: true }) as string[], [t])

  const selected = useMemo(
    () => doc?.events.find((event) => event.uid === selectedId) ?? null,
    [doc, selectedId],
  )
  const rr = useMemo(() => parseRRule(selected?.rrule), [selected?.rrule])

  const loadText = useCallback(
    (text: string, name: string) => {
      try {
        const parsed = dedupeUids(parseIcs(text))
        setDoc(parsed)
        setSelectedId(parsed.events[0]?.uid ?? null)
        setFilename(name)
        setError(null)
        setRawError(null)
        setView('form')
      } catch (e) {
        setError(t('tools:ics_calendar.parseError', { msg: e instanceof Error ? e.message : String(e) }))
      }
    },
    [t],
  )

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      if (file.size > MAX_SIZE) {
        setError(t('tools:ics_calendar.tooLarge', { size: formatSize(MAX_SIZE) }))
        return
      }
      const reader = new FileReader()
      reader.onload = () => loadText(String(reader.result ?? ''), file.name || 'calendar.ics')
      reader.onerror = () => setError(t('tools:ics_calendar.readError'))
      reader.readAsText(file)
    },
    [loadText, t],
  )

  const handleClear = () => {
    setDoc(null)
    setSelectedId(null)
    setError(null)
    setRawError(null)
    setView('form')
    setFilename('calendar.ics')
  }

  const handleExport = () => {
    if (!doc) return
    const name = filename.toLowerCase().endsWith('.ics') ? filename : `${filename.replace(/\.ical$/i, '')}.ics`
    download(buildIcs(doc), name || 'calendar.ics', 'text/calendar;charset=utf-8')
  }

  const patchEvent = (patch: Partial<IcsEvent>) => {
    if (!selected) return
    const uid = selected.uid
    setDoc((current) =>
      current
        ? { ...current, events: current.events.map((event) => (event.uid === uid ? { ...event, ...patch } : event)) }
        : current,
    )
  }

  const patchDoc = (patch: Partial<IcsCalendarDoc>) => {
    setDoc((current) => (current ? { ...current, ...patch } : current))
  }

  const addEvent = () => {
    const day = todayYmd()
    const event: IcsEvent = {
      uid: newUid(),
      dtstamp: nowIcsStamp(),
      summary: '',
      description: '',
      location: '',
      url: '',
      status: '',
      categories: '',
      start: { kind: 'datetime', local: `${day}T09:00:00`, utc: false },
      end: { kind: 'datetime', local: `${day}T10:00:00`, utc: false },
      extras: [],
    }
    setDoc((current) => {
      const base = current ?? emptyCalendar()
      return { ...base, events: [...base.events, event] }
    })
    setSelectedId(event.uid)
  }

  const duplicateEvent = (uid: string) => {
    if (!doc) return
    const index = doc.events.findIndex((event) => event.uid === uid)
    if (index === -1) return
    const source = doc.events[index]
    const copy: IcsEvent = {
      ...source,
      uid: newUid(),
      dtstamp: nowIcsStamp(),
      extras: [...source.extras],
    }
    const events = [...doc.events]
    events.splice(index + 1, 0, copy)
    setDoc({ ...doc, events })
    setSelectedId(copy.uid)
  }

  const deleteEvent = (uid: string) => {
    if (!doc) return
    if (!window.confirm(t('tools:ics_calendar.confirmDelete'))) return
    const index = doc.events.findIndex((event) => event.uid === uid)
    const events = doc.events.filter((event) => event.uid !== uid)
    setDoc({ ...doc, events })
    if (selectedId === uid) {
      setSelectedId(events[Math.min(index, events.length - 1)]?.uid ?? null)
    }
  }

  const applyRaw = (): boolean => {
    try {
      const parsed = dedupeUids(parseIcs(rawText))
      setDoc(parsed)
      setSelectedId((prev) => (parsed.events.some((event) => event.uid === prev) ? prev : (parsed.events[0]?.uid ?? null)))
      setRawError(null)
      return true
    } catch (e) {
      setRawError(t('tools:ics_calendar.rawInvalid', { msg: e instanceof Error ? e.message : String(e) }))
      return false
    }
  }

  const switchView = (next: ViewMode) => {
    if (next === view) return
    if (next === 'raw') {
      if (doc) setRawText(buildIcs(doc))
      setRawError(null)
      setView('raw')
      return
    }
    if (applyRaw()) setView('form')
  }

  const allDay = selected?.start?.kind === 'date'

  const onStartChange = (value: string) => {
    if (!selected) return
    if (value === '') {
      patchEvent({ start: undefined })
      return
    }
    let start: IcsDateTime
    let end = selected.end
    if (allDay) {
      start = { kind: 'date', local: value, utc: false }
      if (end && end.local <= start.local) {
        end = { kind: 'date', local: addDaysYmd(start.local, 1), utc: false }
      }
    } else {
      const base = selected.start
      start = { kind: 'datetime', local: inputToDatetime(value), utc: base?.utc ?? false, tzid: base?.tzid }
      if (end && end.kind === 'datetime' && end.local <= start.local) {
        end = addIcsDuration(start, 'PT1H') ?? end
      } else if (end && end.kind === 'date') {
        end = undefined
      }
    }
    patchEvent({ start, end })
  }

  const onEndChange = (value: string) => {
    if (!selected) return
    if (value === '') {
      patchEvent({ end: undefined })
      return
    }
    if (allDay) {
      const startYmd = selected.start?.local ?? todayYmd()
      const inclusive = value < startYmd ? startYmd : value
      patchEvent({ end: { kind: 'date', local: allDayEndExclusive(inclusive), utc: false } })
      return
    }
    const base = selected.end
    let end: IcsDateTime = {
      kind: 'datetime',
      local: inputToDatetime(value),
      utc: base?.utc ?? selected.start?.utc ?? false,
      tzid: base?.tzid ?? selected.start?.tzid,
    }
    if (selected.start && end.local <= selected.start.local) {
      end = addIcsDuration(selected.start, 'PT1H') ?? end
    }
    patchEvent({ end })
  }

  const onAllDayChange = (checked: boolean) => {
    if (!selected?.start) return
    if (checked) {
      const range = timedToAllDay(selected.start, selected.end)
      patchEvent({
        start: { kind: 'date', local: range.start, utc: false, tzid: undefined },
        end: { kind: 'date', local: allDayEndExclusive(range.end), utc: false, tzid: undefined },
      })
    } else {
      const range = allDayToTimed(selected.start.local.slice(0, 10))
      patchEvent({
        start: { kind: 'datetime', local: range.start, utc: false, tzid: undefined },
        end: { kind: 'datetime', local: range.end, utc: false, tzid: undefined },
      })
    }
  }

  const tzidOption = selected?.start?.tzid ?? selected?.end?.tzid
  const tzValue = allDay
    ? 'floating'
    : selected?.start?.utc || selected?.end?.utc
      ? 'utc'
      : tzidOption
        ? `tzid:${tzidOption}`
        : 'floating'

  const onTzChange = (value: string) => {
    if (!selected) return
    const fix = (dt?: IcsDateTime): IcsDateTime | undefined => {
      if (!dt || dt.kind === 'date') return dt
      if (value === 'utc') return { ...dt, utc: true, tzid: undefined }
      if (value.startsWith('tzid:') && value.length > 5) {
        return { ...dt, utc: false, tzid: value.slice(5) }
      }
      return { ...dt, utc: false, tzid: undefined }
    }
    patchEvent({ start: fix(selected.start), end: fix(selected.end) })
  }

  const setRRule = (model: RRuleModel) => patchEvent({ rrule: buildRRule(model) })

  const onRepeatChange = (value: string) => {
    if (!selected) return
    if (value === 'none') {
      patchEvent({ rrule: undefined })
      return
    }
    const freq = value.toUpperCase() as RRuleFreq
    const base: RRuleModel = rr ?? { freq, interval: 1, byDay: [], extra: [] }
    const next: RRuleModel = {
      ...base,
      freq,
      byDay: freq === 'WEEKLY' || freq === 'MONTHLY' ? base.byDay : [],
    }
    setRRule(next)
  }

  const toggleByDay = (token: string) => {
    if (!rr) return
    const next = rr.byDay.includes(token)
      ? rr.byDay.filter((day) => day !== token)
      : [...rr.byDay, token]
    const standard = WEEKDAYS.filter((day) => next.includes(day))
    const other = next.filter((day) => !isWeekday(day))
    setRRule({ ...rr, byDay: [...standard, ...other] })
  }

  const endsMode = rr?.count ? 'count' : rr?.until ? 'until' : 'never'

  const setEndsMode = (mode: 'never' | 'count' | 'until') => {
    if (!rr) return
    if (mode === 'never') setRRule({ ...rr, count: undefined, until: undefined })
    else if (mode === 'count') setRRule({ ...rr, count: rr.count ?? 10, until: undefined })
    else {
      const startYmd = selected?.start?.local.slice(0, 10) ?? todayYmd()
      setRRule({ ...rr, count: undefined, until: rr.until ?? untilFromYmd(addDaysYmd(startYmd, 30), Boolean(allDay)) })
    }
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragging(false)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const repeatValue = rr ? rr.freq.toLowerCase() : 'none'
  const exoticFreq = rr && !STANDARD_FREQS.includes(rr.freq) ? rr.freq : null
  const showByDay = rr && (rr.freq === 'WEEKLY' || rr.freq === 'MONTHLY')
  const intervalUnitKey = rr
    ? rr.freq === 'DAILY'
      ? 'day'
      : rr.freq === 'WEEKLY'
        ? 'week'
        : rr.freq === 'MONTHLY'
          ? 'month'
          : rr.freq === 'YEARLY'
            ? 'year'
            : 'day'
    : 'day'
  const rruleInvalid = Boolean(selected?.rrule) && !rr

  const importButton = (
    <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
      {t('tools:ics_calendar.import')}
    </button>
  )

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".ics,.ical,text/calendar"
      className="visually-hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
        e.target.value = ''
      }}
    />
  )

  return (
    <section className="section tool-page">
      <div className="container">
        <div className="tool-page-head">
          <div className="tool-page-badges">
            {toolTags.map((tag) => (
              <span className="badge" key={tag}>
                {t(`tools:tags.${tag}`)}
              </span>
            ))}
          </div>
          <h1>{t('tools:ics_calendar.name')}</h1>
          <p>{t('tools:ics_calendar.desc')}</p>
        </div>

        <div className="ics-body" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <div className="ics-toolbar">
            {importButton}
            <button type="button" className="btn btn-ghost" onClick={() => loadText(SAMPLE_ICS, 'sample.ics')}>
              {t('tools:ics_calendar.sample')}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleExport} disabled={!doc}>
              {t('tools:ics_calendar.export')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleClear} disabled={!doc}>
              {t('tools:ics_calendar.clear')}
            </button>
            {doc && (
              <span className="ics-meta">
                {t('tools:ics_calendar.stats', { events: doc.events.length, name: doc.name || filename })}
              </span>
            )}
          </div>

          {fileInput}
          {error && <div className="json-error" role="alert">{error}</div>}

          {!doc ? (
            <div className={`ics-drop${dragging ? ' is-drag' : ''}`}>
              <svg
                viewBox="0 0 24 24"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
                <path d="M8 15h3M13 15h3M8 18h6" />
              </svg>
              <p className="ics-drop-title">{t('tools:ics_calendar.dropTitle')}</p>
              <p className="ics-drop-hint">{t('tools:ics_calendar.dropHint')}</p>
              <div className="ics-drop-actions">
                {importButton}
                <button type="button" className="btn btn-ghost" onClick={() => loadText(SAMPLE_ICS, 'sample.ics')}>
                  {t('tools:ics_calendar.sample')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="ics-viewbar">
                <div className="ics-cal-fields">
                  <div className="ics-field">
                    <label className="ics-label" htmlFor="ics-cal-name">
                      {t('tools:ics_calendar.calName')}
                    </label>
                    <input
                      id="ics-cal-name"
                      className="ics-input"
                      type="text"
                      value={doc.name ?? ''}
                      onChange={(e) => patchDoc({ name: e.target.value || undefined })}
                    />
                  </div>
                  <div className="ics-field">
                    <label className="ics-label" htmlFor="ics-cal-desc">
                      {t('tools:ics_calendar.calDesc')}
                    </label>
                    <input
                      id="ics-cal-desc"
                      className="ics-input"
                      type="text"
                      value={doc.description ?? ''}
                      onChange={(e) => patchDoc({ description: e.target.value || undefined })}
                    />
                  </div>
                </div>
                <div className="json-tabs-btns" role="tablist" aria-label={t('tools:ics_calendar.viewLabel')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === 'form'}
                    className={view === 'form' ? 'is-active' : ''}
                    onClick={() => switchView('form')}
                  >
                    {t('tools:ics_calendar.viewForm')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === 'raw'}
                    className={view === 'raw' ? 'is-active' : ''}
                    onClick={() => switchView('raw')}
                  >
                    {t('tools:ics_calendar.viewRaw')}
                  </button>
                </div>
              </div>

              {view === 'raw' ? (
                <div className="ics-raw">
                  <LineNumberedTextarea
                    className="json-input ics-raw-input"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    aria-label={t('tools:ics_calendar.viewRaw')}
                    rows={20}
                  />
                  {rawError && (
                    <div className="json-error" role="alert">
                      {rawError}
                    </div>
                  )}
                  <div className="ics-raw-actions">
                    <button type="button" className="btn btn-primary" onClick={() => applyRaw()}>
                      {t('tools:ics_calendar.applyRaw')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        if (doc) setRawText(buildIcs(doc))
                      }}
                    >
                      {t('tools:ics_calendar.resetRaw')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ics-layout">
                  <aside className="ics-list-panel">
                    <div className="ics-list-head">
                      <span>
                        {t('tools:ics_calendar.eventsTitle')}
                        <span className="ics-count">{doc.events.length}</span>
                      </span>
                      <button type="button" className="btn btn-primary btn-sm" onClick={addEvent}>
                        {t('tools:ics_calendar.addEvent')}
                      </button>
                    </div>
                    <div className="ics-list">
                      {doc.events.length === 0 ? (
                        <p className="ics-empty">{t('tools:ics_calendar.noEvents')}</p>
                      ) : (
                        doc.events.map((event) => (
                          <button
                            type="button"
                            key={event.uid}
                            className={`ics-item${event.uid === selectedId ? ' is-active' : ''}`}
                            onClick={() => setSelectedId(event.uid)}
                          >
                            <span className="ics-item-title">
                              {event.summary || t('tools:ics_calendar.untitled')}
                            </span>
                            <span className="ics-item-meta">
                              <span>{eventWhen(event) || '—'}</span>
                              {event.rrule && (
                                <span className="ics-repeat-mark" title={t('tools:ics_calendar.repeat')}>
                                  ↻
                                </span>
                              )}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </aside>

                  <div className="ics-editor">
                    {!selected ? (
                      <p className="ics-empty">{t('tools:ics_calendar.selectEvent')}</p>
                    ) : (
                      <>
                        <div className="ics-row">
                          <div className="ics-field ics-span">
                            <label className="ics-label" htmlFor="ics-summary">
                              {t('tools:ics_calendar.summary')}
                            </label>
                            <input
                              id="ics-summary"
                              className="ics-input"
                              type="text"
                              value={selected.summary}
                              placeholder={t('tools:ics_calendar.summaryPlaceholder')}
                              onChange={(e) => patchEvent({ summary: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="ics-row">
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-start">
                              {t('tools:ics_calendar.start')}
                            </label>
                            <input
                              id="ics-start"
                              className="ics-input"
                              type={allDay ? 'date' : 'datetime-local'}
                              value={
                                selected.start
                                  ? allDay
                                    ? selected.start.local
                                    : datetimeToInput(selected.start.local)
                                  : ''
                              }
                              onChange={(e) => onStartChange(e.target.value)}
                            />
                          </div>
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-end">
                              {t('tools:ics_calendar.end')}
                            </label>
                            <input
                              id="ics-end"
                              className="ics-input"
                              type={allDay ? 'date' : 'datetime-local'}
                              value={
                                selected.end
                                  ? allDay
                                    ? allDayUiEnd(selected.start?.local ?? selected.end.local, selected.end.local)
                                    : datetimeToInput(selected.end.local)
                                  : ''
                              }
                              onChange={(e) => onEndChange(e.target.value)}
                            />
                            {allDay && <p className="ics-hint">{t('tools:ics_calendar.endAllDayHint')}</p>}
                          </div>
                        </div>

                        <div className="ics-row">
                          <div className="ics-field">
                            <span className="ics-label">{t('tools:ics_calendar.allDay')}</span>
                            <label className="ics-check">
                              <input
                                type="checkbox"
                                checked={Boolean(allDay)}
                                disabled={!selected.start}
                                onChange={(e) => onAllDayChange(e.target.checked)}
                              />
                              {t('tools:ics_calendar.allDay')}
                            </label>
                          </div>
                          {!allDay && (
                            <div className="ics-field">
                              <label className="ics-label" htmlFor="ics-tz">
                                {t('tools:ics_calendar.timezone')}
                              </label>
                              <select id="ics-tz" className="ics-select" value={tzValue} onChange={(e) => onTzChange(e.target.value)}>
                                <option value="floating">{t('tools:ics_calendar.tz.floating')}</option>
                                <option value="utc">{t('tools:ics_calendar.tz.utc')}</option>
                                {tzidOption && <option value={`tzid:${tzidOption}`}>{tzidOption}</option>}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="ics-row">
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-location">
                              {t('tools:ics_calendar.location')}
                            </label>
                            <input
                              id="ics-location"
                              className="ics-input"
                              type="text"
                              value={selected.location}
                              placeholder={t('tools:ics_calendar.locationPlaceholder')}
                              onChange={(e) => patchEvent({ location: e.target.value })}
                            />
                          </div>
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-status">
                              {t('tools:ics_calendar.status')}
                            </label>
                            <select
                              id="ics-status"
                              className="ics-select"
                              value={selected.status.toUpperCase()}
                              onChange={(e) => patchEvent({ status: e.target.value })}
                            >
                              <option value="">{t('tools:ics_calendar.statusOptions.none')}</option>
                              <option value="CONFIRMED">{t('tools:ics_calendar.statusOptions.confirmed')}</option>
                              <option value="TENTATIVE">{t('tools:ics_calendar.statusOptions.tentative')}</option>
                              <option value="CANCELLED">{t('tools:ics_calendar.statusOptions.cancelled')}</option>
                            </select>
                          </div>
                        </div>

                        <div className="ics-row">
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-repeat">
                              {t('tools:ics_calendar.repeat')}
                            </label>
                            <select id="ics-repeat" className="ics-select" value={repeatValue} onChange={(e) => onRepeatChange(e.target.value)}>
                              <option value="none">{t('tools:ics_calendar.repeatOptions.none')}</option>
                              <option value="daily">{t('tools:ics_calendar.repeatOptions.daily')}</option>
                              <option value="weekly">{t('tools:ics_calendar.repeatOptions.weekly')}</option>
                              <option value="monthly">{t('tools:ics_calendar.repeatOptions.monthly')}</option>
                              <option value="yearly">{t('tools:ics_calendar.repeatOptions.yearly')}</option>
                              {exoticFreq && <option value={exoticFreq.toLowerCase()}>{exoticFreq}</option>}
                            </select>
                          </div>
                          {rr && (
                            <div className="ics-field">
                              <label className="ics-label" htmlFor="ics-interval">
                                {t('tools:ics_calendar.every')}
                              </label>
                              <div className="ics-inline">
                                <input
                                  id="ics-interval"
                                  className="ics-input ics-input-narrow"
                                  type="number"
                                  min={1}
                                  max={999}
                                  value={rr.interval}
                                  onChange={(e) => {
                                    const n = Number.parseInt(e.target.value, 10)
                                    setRRule({ ...rr, interval: Number.isFinite(n) && n > 0 ? n : 1 })
                                  }}
                                />
                                <span className="ics-inline-hint">
                                  {t(`tools:ics_calendar.intervalUnits.${intervalUnitKey}`)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {rr && showByDay && (
                          <div className="ics-field">
                            <span className="ics-label">{t('tools:ics_calendar.weekdays')}</span>
                            <div className="ics-weekdays">
                              {WEEKDAYS.map((day) => (
                                <label className="ics-day" key={day}>
                                  <input
                                    type="checkbox"
                                    checked={rr.byDay.includes(day)}
                                    onChange={() => toggleByDay(day)}
                                  />
                                  {t(`tools:ics_calendar.weekdayNames.${day.toLowerCase()}`)}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {rr && (
                          <div className="ics-field">
                            <span className="ics-label">{t('tools:ics_calendar.ends')}</span>
                            <div className="ics-ends">
                              <label className="ics-radio">
                                <input
                                  type="radio"
                                  name="ics-ends"
                                  checked={endsMode === 'never'}
                                  onChange={() => setEndsMode('never')}
                                />
                                {t('tools:ics_calendar.endsOptions.never')}
                              </label>
                              <label className="ics-radio">
                                <input
                                  type="radio"
                                  name="ics-ends"
                                  checked={endsMode === 'count'}
                                  onChange={() => setEndsMode('count')}
                                />
                                {t('tools:ics_calendar.endsOptions.count')}
                                <input
                                  className="ics-input ics-input-narrow"
                                  type="number"
                                  min={1}
                                  max={9999}
                                  disabled={endsMode !== 'count'}
                                  value={rr.count ?? 10}
                                  onChange={(e) => {
                                    const n = Number.parseInt(e.target.value, 10)
                                    setRRule({
                                      ...rr,
                                      count: Number.isFinite(n) && n > 0 ? n : 1,
                                      until: undefined,
                                    })
                                  }}
                                />
                                {t('tools:ics_calendar.times')}
                              </label>
                              <label className="ics-radio">
                                <input
                                  type="radio"
                                  name="ics-ends"
                                  checked={endsMode === 'until'}
                                  onChange={() => setEndsMode('until')}
                                />
                                {t('tools:ics_calendar.endsOptions.until')}
                                <input
                                  className="ics-input"
                                  type="date"
                                  disabled={endsMode !== 'until'}
                                  value={rr.until ? untilToDate(rr.until) : ''}
                                  onChange={(e) =>
                                    setRRule({
                                      ...rr,
                                      count: undefined,
                                      until: e.target.value ? untilFromYmd(e.target.value, Boolean(allDay)) : undefined,
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        )}

                        {(rr || Boolean(selected.rrule)) && (
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-rrule">
                              {t('tools:ics_calendar.advancedRepeat')}
                            </label>
                            <input
                              id="ics-rrule"
                              className="ics-input ics-mono"
                              type="text"
                              value={selected.rrule ?? ''}
                              onChange={(e) => patchEvent({ rrule: e.target.value.trim() || undefined })}
                            />
                            {rruleInvalid && <p className="ics-field-error">{t('tools:ics_calendar.rruleInvalid')}</p>}
                          </div>
                        )}

                        <div className="ics-row">
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-url">
                              {t('tools:ics_calendar.url')}
                            </label>
                            <input
                              id="ics-url"
                              className="ics-input"
                              type="text"
                              value={selected.url}
                              placeholder="https://…"
                              onChange={(e) => patchEvent({ url: e.target.value })}
                            />
                          </div>
                          <div className="ics-field">
                            <label className="ics-label" htmlFor="ics-categories">
                              {t('tools:ics_calendar.categories')}
                            </label>
                            <input
                              id="ics-categories"
                              className="ics-input"
                              type="text"
                              value={selected.categories}
                              placeholder={t('tools:ics_calendar.categoriesPlaceholder')}
                              onChange={(e) => patchEvent({ categories: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="ics-row">
                          <div className="ics-field ics-span">
                            <label className="ics-label" htmlFor="ics-description">
                              {t('tools:ics_calendar.description')}
                            </label>
                            <textarea
                              id="ics-description"
                              className="ics-input ics-textarea"
                              rows={4}
                              value={selected.description}
                              placeholder={t('tools:ics_calendar.descriptionPlaceholder')}
                              onChange={(e) => patchEvent({ description: e.target.value })}
                            />
                          </div>
                        </div>

                        {selected.extras.length > 0 && (
                          <p className="ics-hint">
                            {t('tools:ics_calendar.extrasNote', { count: selected.extras.length })}
                          </p>
                        )}

                        <div className="ics-actions">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => duplicateEvent(selected.uid)}>
                            {t('tools:ics_calendar.duplicate')}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteEvent(selected.uid)}>
                            {t('tools:ics_calendar.delete')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
