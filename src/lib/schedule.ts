import type {
  ColorId,
  Entry,
  EntryLink,
  Lane,
  Language,
  OccurrenceException,
  Repeat,
  Scope,
  Todo,
} from './types'

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
  actualRemoved?: boolean
  actualOnly?: boolean
}

export function withPlanTimes<T extends Timed>(entry: T, start: number, end: number): T {
  const range = clampRange(start, end)
  if (entry.actualCustomized || entry.actualRemoved) {
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
  return {
    ...entry,
    actualStart: range.start,
    actualEnd: range.end,
    actualCustomized: true,
    ...(entry.actualOnly ? { planStart: range.start, planEnd: range.end } : {}),
  }
}

export function copyWeekEntries(
  entries: Entry[],
  fromWeek: string,
  toWeek: string,
  newId: () => string,
): Entry[] {
  return entries
    .filter((entry) => entry.weekStart === fromWeek && entry.repeat === 'none')
    .map((entry) => ({
      ...entry,
      id: newId(),
      weekStart: toWeek,
      planStart: entry.actualOnly ? entry.actualStart : entry.planStart,
      planEnd: entry.actualOnly ? entry.actualEnd : entry.planEnd,
      actualStart: entry.actualOnly ? entry.actualStart : entry.planStart,
      actualEnd: entry.actualOnly ? entry.actualEnd : entry.planEnd,
      actualCustomized: entry.actualOnly,
      actualRemoved: false,
      actualTitle: entry.actualOnly ? entry.actualTitle : null,
      actualColor: entry.actualOnly ? entry.actualColor : null,
      actualNote: entry.actualOnly ? entry.actualNote : '',
      exceptions: [],
      repeatUntil: null,
    }))
}

export function pastedEntry(source: Entry, weekStart: string, dayIndex: number, id: string): Entry {
  const start = source.actualOnly ? source.actualStart : source.planStart
  const end = source.actualOnly ? source.actualEnd : source.planEnd
  const duration = Math.max(end - start, MIN_DURATION)
  const range = moveWithinDay(duration, start)
  return {
    ...source,
    id,
    weekStart,
    dayIndex,
    planStart: range.start,
    planEnd: range.end,
    actualStart: range.start,
    actualEnd: range.end,
    actualCustomized: source.actualOnly,
    actualRemoved: false,
    actualTitle: source.actualOnly ? source.actualTitle : null,
    actualColor: source.actualOnly ? source.actualColor : null,
    repeat: 'none',
    repeatUntil: null,
    exceptions: [],
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

export type OccurrenceRef = {
  id: string
  originDate: string
  lane: Lane
}

export type EntryChange =
  | { kind: 'times'; start: number; end: number; date?: string }
  | { kind: 'title'; title: string }
  | { kind: 'color'; color: ColorId }
  | { kind: 'note'; note: string }
  | { kind: 'repeat'; repeat: Repeat }
  | { kind: 'delete' }

export type Occurrence = {
  id: string
  originDate: string
  date: string
  weekStart: string
  dayIndex: number
  link: EntryLink | null
  title: string
  color: ColorId
  titleOverride: boolean
  colorOverride: boolean
  actualTitle: string | null
  actualColor: ColorId | null
  planStart: number
  planEnd: number
  actualStart: number
  actualEnd: number
  actualCustomized: boolean
  actualRemoved: boolean
  actualOnly: boolean
  planNote: string
  actualNote: string
  repeat: Repeat
}

export type AppliedChange = {
  entries: Entry[]
  focus: OccurrenceRef | null
}

export function blankEntryFields(): Pick<
  Entry,
  | 'repeat'
  | 'repeatUntil'
  | 'planNote'
  | 'actualNote'
  | 'actualRemoved'
  | 'actualOnly'
  | 'actualTitle'
  | 'actualColor'
  | 'exceptions'
> {
  return {
    repeat: 'none',
    repeatUntil: null,
    planNote: '',
    actualNote: '',
    actualRemoved: false,
    actualOnly: false,
    actualTitle: null,
    actualColor: null,
    exceptions: [],
  }
}

export function entryAnchor(entry: Entry): string {
  return addDays(entry.weekStart, entry.dayIndex)
}

export function anchorFields(date: string): { weekStart: string; dayIndex: number } {
  const weekStart = mondayOf(parseISODate(date))
  const weekday = parseISODate(date).getDay()
  const dayIndex = weekday === 0 ? 6 : weekday - 1
  return { weekStart, dayIndex }
}

export function daysBetween(from: string, to: string): number {
  const start = parseISODate(from).getTime()
  const end = parseISODate(to).getTime()
  return Math.round((end - start) / 86_400_000)
}

export function occursOn(entry: Entry, date: string): boolean {
  const anchor = entryAnchor(entry)
  if (date < anchor) return false
  if (entry.repeatUntil && date >= entry.repeatUntil) return false
  if (date === anchor || entry.repeat === 'none') return date === anchor
  if (entry.repeat === 'daily') return true
  if (entry.repeat === 'weekly') return daysBetween(anchor, date) % 7 === 0
  if (entry.repeat === 'weekdays') {
    const day = parseISODate(date).getDay()
    return day >= 1 && day <= 5
  }
  return parseISODate(date).getDate() === parseISODate(anchor).getDate()
}

function materialize(entry: Entry, originDate: string, exception: OccurrenceException | undefined, displayDate: string): Occurrence {
  const place = anchorFields(displayDate)
  const planStart = exception?.planStart ?? entry.planStart
  const planEnd = exception?.planEnd ?? entry.planEnd
  const actualCustomized = exception?.actualCustomized ?? entry.actualCustomized
  const actualRemoved = Boolean(entry.actualRemoved || exception?.actualRemoved)
  let actualStart = exception?.actualStart ?? entry.actualStart
  let actualEnd = exception?.actualEnd ?? entry.actualEnd
  if (!actualCustomized) {
    actualStart = planStart
    actualEnd = planEnd
  }
  return {
    id: entry.id,
    originDate,
    date: displayDate,
    weekStart: place.weekStart,
    dayIndex: place.dayIndex,
    link: entry.link,
    title: exception?.title ?? entry.title,
    color: exception?.color ?? entry.color,
    titleOverride: exception?.title !== undefined,
    colorOverride: exception?.color !== undefined,
    actualTitle: exception?.actualTitle !== undefined ? exception.actualTitle : entry.actualTitle,
    actualColor: exception?.actualColor !== undefined ? exception.actualColor : entry.actualColor,
    planStart,
    planEnd,
    actualStart,
    actualEnd,
    actualCustomized,
    actualRemoved,
    actualOnly: entry.actualOnly,
    planNote: exception?.planNote !== undefined ? exception.planNote : entry.planNote,
    actualNote: exception?.actualNote !== undefined ? exception.actualNote : entry.actualNote,
    repeat: entry.repeat,
  }
}

export function occurrenceOn(entry: Entry, originDate: string): Occurrence | null {
  if (!occursOn(entry, originDate)) return null
  const exception = entry.exceptions.find((item) => item.date === originDate)
  if (exception?.deleted) return null
  const display = exception?.movedTo && exception.movedTo !== originDate ? exception.movedTo : originDate
  return materialize(entry, originDate, exception, display)
}

export function occurrencesInWeek(entries: Entry[], weekStart: string): Occurrence[] {
  const visible = new Set(weekDates(weekStart))
  const result: Occurrence[] = []
  for (const entry of entries) {
    const shown = new Set<string>()
    for (const date of visible) {
      if (!occursOn(entry, date)) continue
      const exception = entry.exceptions.find((item) => item.date === date)
      if (exception?.deleted) continue
      const display = exception?.movedTo && exception.movedTo !== date ? exception.movedTo : date
      if (!visible.has(display)) continue
      result.push(materialize(entry, date, exception, display))
      shown.add(date)
    }
    for (const exception of entry.exceptions) {
      if (shown.has(exception.date) || exception.deleted || !exception.movedTo || exception.movedTo === exception.date) continue
      if (!visible.has(exception.movedTo) || !occursOn(entry, exception.date)) continue
      result.push(materialize(entry, exception.date, exception, exception.movedTo))
    }
  }
  return result
}

export function shownOnLane(occurrence: Pick<Occurrence, 'actualOnly' | 'actualRemoved'>, lane: Lane): boolean {
  if (lane === 'plan') return !occurrence.actualOnly
  return !occurrence.actualRemoved
}

export function occurrenceDisplay(
  occurrence: Occurrence,
  todos: Todo[],
  lane: Lane,
): { title: string; color: ColorId; note: string } {
  const linked = occurrence.link ? lookupLink(todos, occurrence.link) : null
  const planTitle = occurrence.titleOverride ? occurrence.title : (linked?.title ?? occurrence.title)
  const planColor = occurrence.colorOverride ? occurrence.color : (linked?.color ?? occurrence.color)
  if (lane === 'actual') {
    return {
      title: occurrence.actualTitle ?? planTitle,
      color: occurrence.actualColor ?? planColor,
      note: occurrence.actualNote,
    }
  }
  return { title: planTitle, color: planColor, note: occurrence.planNote }
}

function dropsEntry(entry: Entry, lane: Lane): boolean {
  return lane === 'plan' || entry.actualOnly
}

function meaningful(exception: Partial<OccurrenceException>): boolean {
  return Object.entries(exception).some(([key, value]) => key !== 'date' && value !== undefined)
}

function upsertException(entry: Entry, originDate: string, patch: Partial<OccurrenceException>): Entry {
  const existing = entry.exceptions.find((item) => item.date === originDate)
  const merged: OccurrenceException = { ...(existing ?? { date: originDate }), ...patch, date: originDate }
  for (const key of Object.keys(patch) as (keyof OccurrenceException)[]) {
    if (patch[key] === undefined) delete merged[key]
  }
  const exceptions = entry.exceptions.filter((item) => item.date !== originDate)
  if (!meaningful(merged)) return { ...entry, exceptions }
  return { ...entry, exceptions: [...exceptions, merged] }
}

function shiftException(exception: OccurrenceException, delta: number): OccurrenceException {
  if (delta === 0) return exception
  const next: OccurrenceException = { ...exception, date: addDays(exception.date, delta) }
  if (exception.movedTo) next.movedTo = addDays(exception.movedTo, delta)
  return next
}

function applyTemplate(entry: Entry, lane: Lane, change: EntryChange): Entry {
  switch (change.kind) {
    case 'delete':
      return lane === 'actual' ? { ...entry, actualRemoved: true } : entry
    case 'times':
      return lane === 'actual' ? withActualTimes(entry, change.start, change.end) : withPlanTimes(entry, change.start, change.end)
    case 'title':
      return lane === 'actual' ? { ...entry, actualTitle: change.title } : { ...entry, title: change.title }
    case 'color':
      return lane === 'actual' ? { ...entry, actualColor: change.color } : { ...entry, color: change.color }
    case 'note':
      return lane === 'actual' ? { ...entry, actualNote: change.note } : { ...entry, planNote: change.note }
    case 'repeat':
      return { ...entry, repeat: change.repeat }
  }
}

function stripChanged(exceptions: OccurrenceException[], lane: Lane, change: EntryChange): OccurrenceException[] {
  return exceptions
    .map((exception) => {
      const copy: OccurrenceException = { ...exception }
      if (change.kind === 'times') {
        delete copy.planStart
        delete copy.planEnd
        delete copy.actualStart
        delete copy.actualEnd
        delete copy.actualCustomized
      } else if (change.kind === 'title') {
        if (lane === 'plan') delete copy.title
        else delete copy.actualTitle
      } else if (change.kind === 'color') {
        if (lane === 'plan') delete copy.color
        else delete copy.actualColor
      } else if (change.kind === 'note') {
        if (lane === 'plan') delete copy.planNote
        else delete copy.actualNote
      } else if (change.kind === 'delete' && lane === 'actual') {
        delete copy.actualRemoved
      }
      return copy
    })
    .filter(meaningful)
}

/** Day delta that moves a weekly or monthly series onto the dropped day. Daily and weekday series keep their dates. */
function seriesDayShift(entry: Entry, originDate: string, lane: Lane, change: EntryChange): number {
  if (change.kind !== 'times' || lane !== 'plan' || !change.date) return 0
  if (entry.repeat !== 'weekly' && entry.repeat !== 'monthly') return 0
  const display = occurrenceOn(entry, originDate)?.date ?? originDate
  if (change.date === display) return 0
  return daysBetween(originDate, change.date)
}

function shiftSeries(entry: Entry, delta: number): Entry {
  if (delta === 0) return entry
  return {
    ...entry,
    ...anchorFields(addDays(entryAnchor(entry), delta)),
    repeatUntil: entry.repeatUntil ? addDays(entry.repeatUntil, delta) : null,
    exceptions: entry.exceptions.map((exception) => shiftException(exception, delta)),
  }
}

function replaceEntry(entries: Entry[], id: string, next: Entry | Entry[] | null): Entry[] {
  const result: Entry[] = []
  for (const entry of entries) {
    if (entry.id !== id) {
      result.push(entry)
      continue
    }
    if (Array.isArray(next)) result.push(...next)
    else if (next) result.push(next)
  }
  return result
}

function applyToOne(entry: Entry, ref: OccurrenceRef, change: EntryChange): Entry | null {
  if (entry.repeat === 'none') {
    if (change.kind === 'delete' && dropsEntry(entry, ref.lane)) return null
    let next = applyTemplate(entry, ref.lane, change)
    if (change.kind === 'times' && ref.lane === 'plan' && change.date) next = { ...next, ...anchorFields(change.date) }
    return next
  }
  if (change.kind === 'repeat') return entry
  if (change.kind === 'delete') {
    return dropsEntry(entry, ref.lane)
      ? upsertException(entry, ref.originDate, { deleted: true })
      : upsertException(entry, ref.originDate, { actualRemoved: true })
  }
  if (change.kind === 'times') {
    const range = clampRange(change.start, change.end)
    if (ref.lane === 'actual') {
      return upsertException(entry, ref.originDate, {
        actualStart: range.start,
        actualEnd: range.end,
        actualCustomized: true,
        ...(entry.actualOnly ? { planStart: range.start, planEnd: range.end } : {}),
      })
    }
    const patch: Partial<OccurrenceException> = { planStart: range.start, planEnd: range.end }
    if (change.date) patch.movedTo = change.date === ref.originDate ? undefined : change.date
    return upsertException(entry, ref.originDate, patch)
  }
  if (change.kind === 'title') {
    return upsertException(entry, ref.originDate, ref.lane === 'actual' ? { actualTitle: change.title } : { title: change.title })
  }
  if (change.kind === 'color') {
    return upsertException(entry, ref.originDate, ref.lane === 'actual' ? { actualColor: change.color } : { color: change.color })
  }
  return upsertException(entry, ref.originDate, ref.lane === 'actual' ? { actualNote: change.note } : { planNote: change.note })
}

function retainedException(
  prior: OccurrenceException,
  lane: Lane,
  change: EntryChange,
  shifting: boolean,
): Partial<OccurrenceException> | null {
  const keep: OccurrenceException = { ...prior }
  delete keep.deleted
  if (shifting) delete keep.movedTo
  if (change.kind === 'times') {
    delete keep.planStart
    delete keep.planEnd
    if (lane === 'actual' || !prior.actualCustomized) {
      delete keep.actualStart
      delete keep.actualEnd
      delete keep.actualCustomized
    }
  } else if (change.kind === 'title') {
    if (lane === 'plan') delete keep.title
    else delete keep.actualTitle
  } else if (change.kind === 'color') {
    if (lane === 'plan') delete keep.color
    else delete keep.actualColor
  } else if (change.kind === 'note') {
    if (lane === 'plan') delete keep.planNote
    else delete keep.actualNote
  } else if (change.kind === 'delete' && lane === 'actual') {
    delete keep.actualRemoved
  }
  return meaningful(keep) ? keep : null
}

function applyToAll(entries: Entry[], entry: Entry, ref: OccurrenceRef, change: EntryChange): AppliedChange {
  if (change.kind === 'delete' && dropsEntry(entry, ref.lane)) {
    return { entries: replaceEntry(entries, entry.id, null), focus: null }
  }
  const delta = seriesDayShift(entry, ref.originDate, ref.lane, change)
  let next = shiftSeries(entry, delta)
  next = applyTemplate(next, ref.lane, change)
  next = { ...next, exceptions: stripChanged(next.exceptions, ref.lane, change) }
  const origin = delta === 0 ? ref.originDate : addDays(ref.originDate, delta)
  return {
    entries: replaceEntry(entries, entry.id, next),
    focus: { ...ref, id: next.id, originDate: occursOn(next, origin) ? origin : entryAnchor(next) },
  }
}

function applyFollowing(
  entries: Entry[],
  entry: Entry,
  ref: OccurrenceRef,
  change: EntryChange,
  newId: () => string,
): AppliedChange {
  if (ref.originDate <= entryAnchor(entry)) return applyToAll(entries, entry, ref, change)
  if (change.kind === 'delete' && dropsEntry(entry, ref.lane)) {
    const truncated = {
      ...entry,
      repeatUntil: ref.originDate,
      exceptions: entry.exceptions.filter((exception) => exception.date < ref.originDate),
    }
    return { entries: replaceEntry(entries, entry.id, truncated), focus: null }
  }
  const delta = seriesDayShift(entry, ref.originDate, ref.lane, change)
  const display = occurrenceOn(entry, ref.originDate)?.date ?? ref.originDate
  const dropDate = change.kind === 'times' && ref.lane === 'plan' ? change.date : undefined
  const newAnchor = delta !== 0 && dropDate ? dropDate : ref.originDate
  const prior = entry.exceptions.find((exception) => exception.date === ref.originDate)
  const truncated = {
    ...entry,
    repeatUntil: ref.originDate,
    exceptions: entry.exceptions.filter((exception) => exception.date < ref.originDate),
  }
  let spawned: Entry = {
    ...entry,
    id: newId(),
    ...anchorFields(newAnchor),
    repeatUntil: entry.repeatUntil && delta !== 0 ? addDays(entry.repeatUntil, delta) : entry.repeatUntil,
    exceptions: entry.exceptions
      .filter((exception) => exception.date > ref.originDate)
      .map((exception) => shiftException(exception, delta)),
  }
  spawned = applyTemplate(spawned, ref.lane, change)
  if ((change.kind === 'title' || change.kind === 'color') && ref.lane === 'plan' && entry.link) {
    spawned = {
      ...spawned,
      link: null,
      title: change.kind === 'title' ? change.title : (prior?.title ?? entry.title),
      color: change.kind === 'color' ? change.color : (prior?.color ?? entry.color),
    }
  }
  if (prior) {
    const retained = retainedException(prior, ref.lane, change, delta !== 0)
    if (retained) spawned = upsertException(spawned, entryAnchor(spawned), retained)
  }
  if (dropDate && dropDate !== display && delta === 0) {
    spawned = upsertException(spawned, entryAnchor(spawned), {
      movedTo: dropDate === entryAnchor(spawned) ? undefined : dropDate,
    })
  }
  return {
    entries: replaceEntry(entries, entry.id, [truncated, spawned]),
    focus: { ...ref, id: spawned.id, originDate: entryAnchor(spawned) },
  }
}

export function applyScopedChange(
  entries: Entry[],
  ref: OccurrenceRef,
  scope: Scope,
  change: EntryChange,
  newId: () => string,
): AppliedChange {
  const entry = entries.find((item) => item.id === ref.id)
  if (!entry) return { entries, focus: null }
  if (scope === 'all' || (scope === 'following' && ref.originDate <= entryAnchor(entry))) {
    return applyToAll(entries, entry, ref, change)
  }
  if (scope === 'following') return applyFollowing(entries, entry, ref, change, newId)
  const next = applyToOne(entry, ref, change)
  const focus = next && occurrenceOn(next, ref.originDate) ? ref : null
  return { entries: replaceEntry(entries, entry.id, next), focus: focus ? { ...ref, id: next?.id ?? ref.id } : null }
}
