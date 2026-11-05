import type { ColorId, Entry, EntryLink, Language, Todo } from './types'

export const DAY_START = 6 * 60
export const DAY_END = 23 * 60
export const SNAP_MINUTES = 15
export const MIN_DURATION = 15
export const DEFAULT_DURATION = 60

export type Range = { start: number; end: number }

export function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function mondayOf(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = copy.getDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  copy.setDate(copy.getDate() + delta)
  return toISODate(copy)
}

export function previousWeek(mondayIso: string): string {
  return addDays(mondayIso, -7)
}

export function shiftWeek(mondayIso: string, deltaWeeks: number): string {
  return addDays(mondayIso, deltaWeeks * 7)
}

export function weekDates(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(mondayIso, index))
}

export function clampRange(start: number, end: number): Range {
  let nextStart = snap(start)
  let nextEnd = snap(end)
  if (nextEnd < nextStart) {
    const swap = nextStart
    nextStart = nextEnd
    nextEnd = swap
  }
  if (nextEnd - nextStart < MIN_DURATION) nextEnd = nextStart + MIN_DURATION
  if (nextStart < DAY_START) {
    nextStart = DAY_START
    if (nextEnd - nextStart < MIN_DURATION) nextEnd = nextStart + MIN_DURATION
  }
  if (nextEnd > DAY_END) {
    nextEnd = DAY_END
    if (nextEnd - nextStart < MIN_DURATION) nextStart = nextEnd - MIN_DURATION
  }
  if (nextStart < DAY_START) nextStart = DAY_START
  return { start: nextStart, end: nextEnd }
}

export function rangeFromDrag(anchor: number, current: number): Range | null {
  const start = snap(Math.min(anchor, current))
  const end = snap(Math.max(anchor, current))
  if (end - start < MIN_DURATION) return null
  return clampRange(start, end)
}

export function moveWithinDay(duration: number, nextStart: number): Range {
  const length = Math.min(Math.max(duration, MIN_DURATION), DAY_END - DAY_START)
  let start = snap(nextStart)
  let end = start + length
  if (start < DAY_START) {
    start = DAY_START
    end = start + length
  }
  if (end > DAY_END) {
    end = DAY_END
    start = end - length
  }
  return { start, end }
}

export function resizeEnd(start: number, nextEnd: number): Range {
  let end = snap(nextEnd)
  if (end < start + MIN_DURATION) end = start + MIN_DURATION
  if (end > DAY_END) end = DAY_END
  if (end < start + MIN_DURATION) return { start: DAY_END - MIN_DURATION, end: DAY_END }
  return { start, end }
}

export function resizeStart(end: number, nextStart: number): Range {
  let start = snap(nextStart)
  if (start > end - MIN_DURATION) start = end - MIN_DURATION
  if (start < DAY_START) start = DAY_START
  if (end - start < MIN_DURATION) return { start: DAY_START, end: DAY_START + MIN_DURATION }
  return { start, end }
}

export function placeDuration(start: number, duration = DEFAULT_DURATION): Range {
  return moveWithinDay(duration, start)
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const MONTHS: Record<Language, string[]> = {
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

export function formatWeekRange(mondayIso: string, language: Language): string {
  const start = parseISODate(mondayIso)
  const end = parseISODate(addDays(mondayIso, 6))
  const startMonth = MONTHS[language][start.getMonth()]
  const endMonth = MONTHS[language][end.getMonth()]
  const startDay = start.getDate()
  const endDay = end.getDate()
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()
  const sameMonth = startYear === endYear && start.getMonth() === end.getMonth()

  if (language === 'de') {
    if (sameMonth) return `${startDay}.–${endDay}. ${startMonth} ${startYear}`
    if (startYear === endYear) return `${startDay}. ${startMonth} – ${endDay}. ${endMonth} ${startYear}`
    return `${startDay}. ${startMonth} ${startYear} – ${endDay}. ${endMonth} ${endYear}`
  }
  if (sameMonth) return `${startMonth} ${startDay}–${endDay}, ${startYear}`
  if (startYear === endYear) return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`
}

type Timed = {
  planStart: number
  planEnd: number
  actualStart: number
  actualEnd: number
  actualCustomized: boolean
}

export function withPlanTimes<T extends Timed>(entry: T, start: number, end: number): T {
  const range = clampRange(start, end)
  if (entry.actualCustomized) {
    return { ...entry, planStart: range.start, planEnd: range.end }
  }
  return {
    ...entry,
    planStart: range.start,
    planEnd: range.end,
    actualStart: range.start,
    actualEnd: range.end,
  }
}

export function withActualTimes<T extends Timed>(entry: T, start: number, end: number): T {
  const range = clampRange(start, end)
  return { ...entry, actualStart: range.start, actualEnd: range.end, actualCustomized: true }
}

export function copyWeekEntries(
  entries: Entry[],
  fromWeek: string,
  toWeek: string,
  newId: () => string,
): Entry[] {
  return entries
    .filter((entry) => entry.weekStart === fromWeek)
    .map((entry) => ({
      ...entry,
      id: newId(),
      weekStart: toWeek,
      actualStart: entry.planStart,
      actualEnd: entry.planEnd,
      actualCustomized: false,
    }))
}

export function pastedEntry(source: Entry, weekStart: string, dayIndex: number, id: string): Entry {
  const duration = Math.max(source.planEnd - source.planStart, MIN_DURATION)
  const range = moveWithinDay(duration, source.planStart)
  return {
    ...source,
    id,
    weekStart,
    dayIndex,
    planStart: range.start,
    planEnd: range.end,
    actualStart: range.start,
    actualEnd: range.end,
    actualCustomized: false,
  }
}

/** `slot` is a gap in the current order: 0 is before the first item, `items.length` after the last. */
export function reorder<T extends { id: string; order: number }>(items: T[], id: string, slot: number): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const from = sorted.findIndex((item) => item.id === id)
  if (from === -1) return items
  const [moved] = sorted.splice(from, 1)
  const bounded = Math.min(Math.max(slot, 0), sorted.length + 1)
  sorted.splice(bounded > from ? bounded - 1 : bounded, 0, moved)
  return sorted.map((item, order) => (item.order === order ? item : { ...item, order }))
}

export function lookupLink(todos: Todo[], link: EntryLink): { title: string; color: ColorId } | null {
  if (link.kind === 'todo') {
    const todo = todos.find((item) => item.id === link.id)
    return todo ? { title: todo.title, color: todo.color } : null
  }
  for (const todo of todos) {
    const child = todo.children.find((item) => item.id === link.id)
    if (child) return { title: child.title, color: todo.color }
  }
  return null
}

export function resolveDisplay(entry: Entry, todos: Todo[]): { title: string; color: ColorId } {
  if (entry.link) {
    const linked = lookupLink(todos, entry.link)
    if (linked) return linked
  }
  return { title: entry.title, color: entry.color }
}

export function layoutColumns(
  items: { id: string; start: number; end: number }[],
): Map<string, { column: number; columns: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const result = new Map<string, { column: number; columns: number }>()
  let group: typeof sorted = []
  let groupEnd = -1

  const flush = () => {
    if (group.length === 0) return
    const columnEnds: number[] = []
    const assigned = new Map<string, number>()
    for (const item of group) {
      let column = columnEnds.findIndex((end) => end <= item.start)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(item.end)
      } else {
        columnEnds[column] = item.end
      }
      assigned.set(item.id, column)
    }
    const columns = Math.max(columnEnds.length, 1)
    for (const item of group) {
      result.set(item.id, { column: assigned.get(item.id) ?? 0, columns })
    }
    group = []
    groupEnd = -1
  }

  for (const item of sorted) {
    if (group.length > 0 && item.start >= groupEnd) flush()
    group.push(item)
    groupEnd = Math.max(groupEnd, item.end)
  }
  flush()
  return result
}
