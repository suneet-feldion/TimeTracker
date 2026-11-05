import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type UIEvent } from 'react'
import { useI18n, type MessageKey } from '../lib/i18n'
import {
  DAY_END,
  DAY_START,
  formatMinutes,
  layoutColumns,
  moveWithinDay,
  placeDuration,
  parseISODate,
  rangeFromDrag,
  resizeEnd,
  resizeStart,
  resolveDisplay,
  toISODate,
  weekDates,
} from '../lib/schedule'
import { colorById, type Entry, type Lane } from '../lib/types'
import { useStore } from '../state/store'

const HOUR_HEIGHT = 64
const TOTAL_HEIGHT = ((DAY_END - DAY_START) / 60) * HOUR_HEIGHT
const DAY_KEYS: MessageKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

type Preview =
  | { kind: 'create'; day: number; lane: Lane; start: number; end: number }
  | { kind: 'reshape'; id: string; day: number; lane: Lane; start: number; end: number }

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

function placement(entry: Entry, day: number, lane: Lane, preview: Preview | null): { start: number; end: number } | null {
  if (preview?.kind === 'reshape' && preview.id === entry.id) {
    if (preview.lane === 'plan') {
      if (preview.day !== day) return null
      if (lane === 'plan') return { start: preview.start, end: preview.end }
      if (entry.actualCustomized) return { start: entry.actualStart, end: entry.actualEnd }
      return { start: preview.start, end: preview.end }
    }
    if (entry.dayIndex !== day) return null
    if (lane === 'actual') return { start: preview.start, end: preview.end }
    return { start: entry.planStart, end: entry.planEnd }
  }
  if (entry.dayIndex !== day) return null
  if (lane === 'plan') return { start: entry.planStart, end: entry.planEnd }
  return { start: entry.actualStart, end: entry.actualEnd }
}

export function WeekGrid() {
  const { t } = useI18n()
  const entries = useStore((state) => state.entries)
  const todos = useStore((state) => state.todos)
  const settings = useStore((state) => state.settings)
  const selectedId = useStore((state) => state.selectedId)
  const addEntry = useStore((state) => state.addEntry)
  const updateEntryTimes = useStore((state) => state.updateEntryTimes)
  const selectEntry = useStore((state) => state.selectEntry)
  const setPasteDay = useStore((state) => state.setPasteDay)
  const setEditing = useStore((state) => state.setEditing)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [over, setOver] = useState<{ day: number; lane: Lane } | null>(null)
  const previewRef = useRef<Preview | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef({ addEntry, updateEntryTimes, selectEntry, setPasteDay, setEditing })
  apiRef.current = { addEntry, updateEntryTimes, selectEntry, setPasteDay, setEditing }

  const showPreview = (next: Preview | null) => {
    previewRef.current = next
    setPreview(next)
  }

  const weekEntries = entries.filter((entry) => entry.weekStart === settings.weekStart)
  const dates = weekDates(settings.weekStart)
  const today = toISODate(new Date())
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
    apiRef.current.selectEntry(null)
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
      apiRef.current.setEditing(id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onBlockPointerDown = (event: ReactPointerEvent<HTMLDivElement>, entry: Entry, lane: Lane) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const handle = event.target instanceof HTMLElement ? (event.target.dataset.handle as 'start' | 'end' | undefined) : undefined
    const originX = event.clientX
    const originY = event.clientY
    apiRef.current.selectEntry(entry.id)
    apiRef.current.setPasteDay(entry.dayIndex)
    const times =
      lane === 'actual'
        ? { start: entry.actualStart, end: entry.actualEnd }
        : { start: entry.planStart, end: entry.planEnd }
    const host = laneElement(entry.dayIndex, lane) ?? (event.currentTarget.closest('.lane') as HTMLElement | null)
    if (!host) return
    const grab = minutesAt(originY, host) - times.start
    let moved = false

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - originX) > 3 || Math.abs(ev.clientY - originY) > 3) moved = true
      if (!moved) return
      if (handle === 'end') {
        const range = resizeEnd(times.start, minutesAt(ev.clientY, host))
        showPreview({ kind: 'reshape', id: entry.id, day: entry.dayIndex, lane, start: range.start, end: range.end })
        return
      }
      if (handle === 'start') {
        const range = resizeStart(times.end, minutesAt(ev.clientY, host))
        showPreview({ kind: 'reshape', id: entry.id, day: entry.dayIndex, lane, start: range.start, end: range.end })
        return
      }
      const day = lane === 'plan' ? (planDayAt(ev.clientX) ?? entry.dayIndex) : entry.dayIndex
      const column = laneElement(day, lane) ?? host
      const range = moveWithinDay(times.end - times.start, minutesAt(ev.clientY, column) - grab)
      showPreview({ kind: 'reshape', id: entry.id, day, lane, start: range.start, end: range.end })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const next = previewRef.current
      showPreview(null)
      if (!moved || next?.kind !== 'reshape') return
      apiRef.current.updateEntryTimes(next.id, next.lane, next.start, next.end, next.lane === 'plan' ? next.day : undefined)
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
    apiRef.current.addEntry({
      dayIndex: day,
      start: range.start,
      end: range.end,
      link: { kind: payload.kind, id: payload.id },
    })
    apiRef.current.setPasteDay(day)
  }

  const renderLane = (day: number, lane: Lane) => {
    const items: { id: string; start: number; end: number; entry: Entry | null }[] = weekEntries.flatMap((entry) => {
      const placed = placement(entry, day, lane, preview)
      return placed ? [{ id: entry.id, ...placed, entry }] : []
    })
    if (preview?.kind === 'create' && preview.day === day && preview.lane === lane) {
      items.push({ id: 'ghost', start: preview.start, end: preview.end, entry: null as Entry | null })
    }
    const layout = layoutColumns(items)
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
          const placed = layout.get(item.id) ?? { column: 0, columns: 1 }
          const entry = item.entry
          const display = entry ? resolveDisplay(entry, todos) : { title: t('newEntry'), color: 'blue' as const }
          const palette = colorById(display.color)
          const top = ((item.start - DAY_START) / 60) * HOUR_HEIGHT
          const height = ((item.end - item.start) / 60) * HOUR_HEIGHT
          const title = display.title || t('untitled')
          return (
            <div
              key={item.id}
              className={`block${entry && entry.id === selectedId ? ' selected' : ''}${entry ? '' : ' ghost'}`}
              data-entry={entry ? '' : undefined}
              data-entry-id={entry?.id}
              data-lane={lane}
              role={entry ? 'button' : undefined}
              aria-label={entry ? `${title} ${formatMinutes(item.start)}–${formatMinutes(item.end)}` : undefined}
              style={{
                top,
                height: Math.max(height - 3, 14),
                left: `calc(${(placed.column * 100) / placed.columns}% + 3px)`,
                width: `calc(${100 / placed.columns}% - 6px)`,
                background: palette.tint,
                borderLeftColor: palette.solid,
                boxShadow: entry && entry.id === selectedId ? `inset 0 0 0 1.5px ${palette.solid}` : undefined,
              }}
              onPointerDown={entry ? (event) => onBlockPointerDown(event, entry, lane) : undefined}
              onDoubleClick={
                entry
                  ? (event) => {
                      event.stopPropagation()
                      apiRef.current.selectEntry(entry.id)
                      apiRef.current.setEditing(entry.id)
                    }
                  : undefined
              }
            >
              <span className="block-title">{title}</span>
              {height >= 40 && (
                <span className="block-time">
                  {formatMinutes(item.start)}–{formatMinutes(item.end)}
                </span>
              )}
              {entry && (
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
              {renderLane(day, 'plan')}
              {tracking && renderLane(day, 'actual')}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
