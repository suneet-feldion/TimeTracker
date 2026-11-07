import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type UIEvent } from 'react'
import { useI18n, type MessageKey } from '../lib/i18n'
import {
  DAY_END,
  DAY_START,
  addDays,
  formatMinutes,
  layoutColumns,
  moveWithinDay,
  occurrenceDisplay,
  occurrencesInWeek,
  shownOnLane,
  placeDuration,
  parseISODate,
  rangeFromDrag,
  resizeEnd,
  resizeStart,
  toISODate,
  weekDates,
  type Occurrence,
} from '../lib/schedule'
import { colorById, type Lane } from '../lib/types'
import { useStore } from '../state/store'

const HOUR_HEIGHT = 64
const TOTAL_HEIGHT = ((DAY_END - DAY_START) / 60) * HOUR_HEIGHT
const DAY_KEYS: MessageKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

type Preview =
  | { kind: 'create'; day: number; lane: Lane; start: number; end: number }
  | { kind: 'reshape'; id: string; originDate: string; day: number; lane: Lane; start: number; end: number }

function minutesAt(clientY: number, lane: HTMLElement): number {
  const rect = lane.getBoundingClientRect()
  if (rect.height === 0) return DAY_START
  return DAY_START + ((clientY - rect.top) / rect.height) * (DAY_END - DAY_START)
}

function planDayAt(clientX: number): number | null {
  const lanes = document.querySelectorAll<HTMLElement>('.lane[data-lane="plan"]')
  for (const lane of lanes) {
    const rect = lane.getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right) return Number(lane.dataset.day)
  }
  return null
}

function laneElement(day: number, lane: Lane): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.lane[data-day="${day}"][data-lane="${lane}"]`)
}

function placement(
  occurrence: Occurrence,
  day: number,
  lane: Lane,
  preview: Preview | null,
): { start: number; end: number } | null {
  const reshaping =
    preview?.kind === 'reshape' && preview.id === occurrence.id && preview.originDate === occurrence.originDate
  if (reshaping && preview.lane === 'plan') {
    if (lane === 'plan') {
      if (preview.day !== day) return null
      return { start: preview.start, end: preview.end }
    }
    if (occurrence.actualRemoved || occurrence.actualOnly) return null
    if (occurrence.actualCustomized) {
      if (occurrence.dayIndex !== day) return null
      return { start: occurrence.actualStart, end: occurrence.actualEnd }
    }
    if (preview.day !== day) return null
    return { start: preview.start, end: preview.end }
  }
  if (reshaping && preview.lane === 'actual') {
    if (occurrence.dayIndex !== day) return null
    if (lane === 'actual') return { start: preview.start, end: preview.end }
    if (occurrence.actualOnly) return null
    return { start: occurrence.planStart, end: occurrence.planEnd }
  }
  if (occurrence.dayIndex !== day || !shownOnLane(occurrence, lane)) return null
  if (lane === 'actual') return { start: occurrence.actualStart, end: occurrence.actualEnd }
  return { start: occurrence.planStart, end: occurrence.planEnd }
}

function FitTitle({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState(13)
  const [truncate, setTruncate] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    const block = el?.parentElement
    if (!el || !block) return
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return
    const family = getComputedStyle(el).fontFamily
    const fit = () => {
      const width = el.clientWidth
      if (width <= 0) return
      const style = getComputedStyle(block)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const contentHeight = block.clientHeight - padY
      const heightCap = Math.min(13, Math.max(9, contentHeight / 1.15))
      const fits = (px: number) => {
        context.font = `600 ${px}px ${family}`
        return context.measureText(text).width <= width + 0.5
      }
      let next = Math.max(9, Math.floor(heightCap * 2) / 2)
      while (next > 9 && !fits(next)) next = Math.round((next - 0.5) * 2) / 2
      setSize(next)
      setTruncate(!fits(next))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(block)
    return () => observer.disconnect()
  }, [text])

  return (
    <span ref={ref} className={truncate ? 'block-title truncate' : 'block-title'} style={{ fontSize: `${size}px` }}>
      {text}
    </span>
  )
}

function NowMarker({ now }: { now: Date }) {
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (minutes < DAY_START || minutes > DAY_END) return null
  const top = ((minutes - DAY_START) / 60) * HOUR_HEIGHT
  return (
    <div className="now-line" style={{ top }} aria-hidden="true">
      <span className="now-dot" />
    </div>
  )
}

export function WeekGrid() {
  const { t } = useI18n()
  const entries = useStore((state) => state.entries)
  const todos = useStore((state) => state.todos)
  const settings = useStore((state) => state.settings)
  const selected = useStore((state) => state.selected)
  const addEntry = useStore((state) => state.addEntry)
  const requestChange = useStore((state) => state.requestChange)
  const selectOccurrence = useStore((state) => state.selectOccurrence)
  const setPasteDay = useStore((state) => state.setPasteDay)
  const setEditing = useStore((state) => state.setEditing)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [over, setOver] = useState<{ day: number; lane: Lane } | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [tip, setTip] = useState<{ text: string; left: number; top: number; below: boolean } | null>(null)
  const previewRef = useRef<Preview | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef({ addEntry, requestChange, selectOccurrence, setPasteDay, setEditing, weekStart: settings.weekStart })
  apiRef.current = { addEntry, requestChange, selectOccurrence, setPasteDay, setEditing, weekStart: settings.weekStart }

  const showPreview = (next: Preview | null) => {
    previewRef.current = next
    setPreview(next)
    if (next) setTip(null)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const occurrences = occurrencesInWeek(entries, settings.weekStart)
  const dates = weekDates(settings.weekStart)
  const today = toISODate(now)
  const tracking = settings.trackingMode

  const onLanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target
    if (target instanceof Element && target.closest('[data-entry]')) return
    const laneEl = event.currentTarget
    const lane = laneEl.dataset.lane as Lane
    const day = Number(laneEl.dataset.day)
    const originY = event.clientY
    const anchor = minutesAt(originY, laneEl)
    apiRef.current.setPasteDay(day)
    apiRef.current.selectOccurrence(null)
    apiRef.current.setEditing(null)

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - originY) < 4) {
        showPreview(null)
        return
      }
      const range = rangeFromDrag(anchor, minutesAt(ev.clientY, laneEl))
      showPreview(range ? { kind: 'create', day, lane, start: range.start, end: range.end } : null)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const moved = Math.abs(ev.clientY - originY) >= 4
      const range = rangeFromDrag(anchor, minutesAt(ev.clientY, laneEl))
      showPreview(null)
      if (!moved || !range) return
      const id = apiRef.current.addEntry({ dayIndex: day, start: range.start, end: range.end, lane })
      apiRef.current.setEditing({ id, originDate: addDays(apiRef.current.weekStart, day), lane })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onBlockPointerDown = (event: ReactPointerEvent<HTMLDivElement>, occurrence: Occurrence, lane: Lane) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const handle = event.target instanceof HTMLElement ? (event.target.dataset.handle as 'start' | 'end' | undefined) : undefined
    const originX = event.clientX
    const originY = event.clientY
    const ref = { id: occurrence.id, originDate: occurrence.originDate, lane }
    apiRef.current.selectOccurrence(ref)
    apiRef.current.setPasteDay(occurrence.dayIndex)
    const times = lane === 'actual' ? { start: occurrence.actualStart, end: occurrence.actualEnd } : { start: occurrence.planStart, end: occurrence.planEnd }
    const host = laneElement(occurrence.dayIndex, lane) ?? (event.currentTarget.closest('.lane') as HTMLElement | null)
    if (!host) return
    const grab = minutesAt(originY, host) - times.start
    let moved = false

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - originX) > 3 || Math.abs(ev.clientY - originY) > 3) moved = true
      if (!moved) return
      if (handle === 'end') {
        const range = resizeEnd(times.start, minutesAt(ev.clientY, host))
        showPreview({ kind: 'reshape', id: occurrence.id, originDate: occurrence.originDate, day: occurrence.dayIndex, lane, start: range.start, end: range.end })
        return
      }
      if (handle === 'start') {
        const range = resizeStart(times.end, minutesAt(ev.clientY, host))
        showPreview({ kind: 'reshape', id: occurrence.id, originDate: occurrence.originDate, day: occurrence.dayIndex, lane, start: range.start, end: range.end })
        return
      }
      const day = lane === 'plan' ? (planDayAt(ev.clientX) ?? occurrence.dayIndex) : occurrence.dayIndex
      const column = laneElement(day, lane) ?? host
      const range = moveWithinDay(times.end - times.start, minutesAt(ev.clientY, column) - grab)
      showPreview({ kind: 'reshape', id: occurrence.id, originDate: occurrence.originDate, day, lane, start: range.start, end: range.end })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const next = previewRef.current
      showPreview(null)
      if (!moved || next?.kind !== 'reshape') {
        if (!moved) apiRef.current.setEditing(ref)
        return
      }
      apiRef.current.requestChange(ref, [
        {
          kind: 'times',
          start: next.start,
          end: next.end,
          ...(next.lane === 'plan' ? { date: addDays(apiRef.current.weekStart, next.day) } : {}),
        },
      ])
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setOver(null)
    const raw = event.dataTransfer.getData('application/x-timetracker')
    if (!raw) return
    let payload: { kind?: string; id?: string }
    try {
      payload = JSON.parse(raw) as { kind?: string; id?: string }
    } catch {
      return
    }
    if ((payload.kind !== 'todo' && payload.kind !== 'subtodo') || !payload.id) return
    const day = Number(event.currentTarget.dataset.day)
    const range = placeDuration(minutesAt(event.clientY, event.currentTarget))
    const id = apiRef.current.addEntry({
      dayIndex: day,
      start: range.start,
      end: range.end,
      link: { kind: payload.kind, id: payload.id },
    })
    apiRef.current.setPasteDay(day)
    apiRef.current.setEditing({ id, originDate: addDays(apiRef.current.weekStart, day), lane: 'plan' })
  }

  const renderLane = (day: number, lane: Lane) => {
    const items: { key: string; id: string; start: number; end: number; occurrence: Occurrence | null }[] = occurrences.flatMap((occurrence) => {
      const placed = placement(occurrence, day, lane, preview)
      if (!placed) return []
      return [{ key: `${occurrence.id}@${occurrence.originDate}`, id: occurrence.id, ...placed, occurrence }]
    })
    if (preview?.kind === 'create' && preview.day === day && preview.lane === lane) {
      items.push({ key: 'ghost', id: 'ghost', start: preview.start, end: preview.end, occurrence: null })
    }
    const layout = layoutColumns(items.map((item) => ({ id: item.key, start: item.start, end: item.end })))
    return (
      <div
        key={lane}
        className={`lane${lane === 'actual' ? ' actual' : ''}${over?.day === day && over.lane === lane ? ' over' : ''}`}
        data-day={day}
        data-lane={lane}
        onPointerDown={onLanePointerDown}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('application/x-timetracker')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setOver((current) => (current?.day === day && current.lane === lane ? current : { day, lane }))
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return
          setOver(null)
        }}
        onDrop={onDrop}
      >
        {items.map((item) => {
          const placed = layout.get(item.key) ?? { column: 0, columns: 1 }
          const occurrence = item.occurrence
          const display = occurrence
            ? occurrenceDisplay(occurrence, todos, lane)
            : { title: t('newEntry'), color: 'blue' as const, note: '' }
          const palette = colorById(display.color)
          const top = ((item.start - DAY_START) / 60) * HOUR_HEIGHT
          const height = ((item.end - item.start) / 60) * HOUR_HEIGHT
          const title = display.title || t('untitled')
          const selectedHere =
            occurrence &&
            selected?.id === occurrence.id &&
            selected.originDate === occurrence.originDate &&
            selected.lane === lane
          return (
            <div
              key={item.key}
              className={`block${selectedHere ? ' selected' : ''}${occurrence ? '' : ' ghost'}${height < 40 ? ' compact' : ''}`}
              data-entry={occurrence ? '' : undefined}
              data-entry-id={occurrence?.id}
              data-origin={occurrence?.originDate}
              data-lane={lane}
              role={occurrence ? 'button' : undefined}
              aria-label={occurrence ? `${title} ${formatMinutes(item.start)}–${formatMinutes(item.end)}` : undefined}
              style={{
                top,
                height: Math.max(height - 3, 14),
                left: `calc(${(placed.column * 100) / placed.columns}% + 3px)`,
                width: `calc(${100 / placed.columns}% - 6px)`,
                background: palette.tint,
                borderLeftColor: palette.solid,
                boxShadow: selectedHere ? `inset 0 0 0 1.5px ${palette.solid}` : undefined,
              }}
              onPointerDown={occurrence ? (event) => onBlockPointerDown(event, occurrence, lane) : undefined}
              onPointerEnter={
                occurrence && display.note
                  ? (event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      const below = rect.top < 56
                      setTip({ text: display.note, left: rect.left, top: below ? rect.bottom + 6 : rect.top, below })
                    }
                  : undefined
              }
              onPointerLeave={occurrence && display.note ? () => setTip(null) : undefined}
            >
              <FitTitle text={title} />
              {height >= 40 && (
                <span className="block-time">
                  {formatMinutes(item.start)}–{formatMinutes(item.end)}
                </span>
              )}
              {occurrence && (
                <>
                  <span className="resize top" data-handle="start" />
                  <span className="resize bottom" data-handle="end" />
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const onBodyScroll = (event: UIEvent<HTMLDivElement>) => {
    const body = event.currentTarget
    if (headRef.current) {
      headRef.current.scrollLeft = body.scrollLeft
      headRef.current.style.paddingRight = `${body.offsetWidth - body.clientWidth}px`
    }
    if (timeRef.current) timeRef.current.scrollTop = body.scrollTop
    setTip(null)
  }

  useEffect(() => {
    const body = document.querySelector('.cal-scroll')
    const time = timeRef.current
    const inner = time?.firstElementChild
    if (!(body instanceof HTMLElement) || !(inner instanceof HTMLElement)) return
    const apply = () => {
      inner.style.marginBottom = `${body.offsetHeight - body.clientHeight}px`
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(body)
    return () => observer.disconnect()
  }, [tracking])

  return (
    <section className={tracking ? 'calendar tracking' : 'calendar'} aria-label={t('plan')}>
      <div className="corner" />
      <div className="head-scroll" ref={headRef}>
        <div className="day-track">
          {dates.map((iso, day) => {
            const date = parseISODate(iso)
            return (
              <div key={iso} className={`day-head${iso === today ? ' today' : ''}${day >= 5 ? ' weekend' : ''}`}>
                <div className="day-label">
                  <span className="dow">{t(DAY_KEYS[day])}</span>
                  <span className={iso === today ? 'dom today' : 'dom'}>{date.getDate()}</span>
                </div>
                {tracking && (
                  <div className="subheads">
                    <span>{t('planColumn')}</span>
                    <span>{t('actualColumn')}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="time-scroll" ref={timeRef}>
        <div className="time-col" style={{ height: TOTAL_HEIGHT }}>
          {Array.from({ length: 18 }, (_, index) => 6 + index).map((hour) => (
            <span
              key={hour}
              className={hour === 6 ? 'hour first' : hour === 23 ? 'hour last' : 'hour'}
              style={{ top: (hour - 6) * HOUR_HEIGHT }}
            >
              {String(hour).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      </div>
      <div className="cal-scroll" onScroll={onBodyScroll}>
        <div className="day-track">
          {dates.map((iso, day) => (
            <div
              key={iso}
              className={`day-col${iso === today ? ' today' : ''}${day >= 5 ? ' weekend' : ''}`}
              style={{ height: TOTAL_HEIGHT }}
            >
              {iso === today && <NowMarker now={now} />}
              {renderLane(day, 'plan')}
              {tracking && renderLane(day, 'actual')}
            </div>
          ))}
        </div>
      </div>
      {tip && (
        <div
          className={tip.below ? 'note-tip below' : 'note-tip'}
          style={{ left: tip.left, top: tip.below ? tip.top : tip.top }}
          role="tooltip"
        >
          {tip.text}
        </div>
      )}
    </section>
  )
}
