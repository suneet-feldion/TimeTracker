import { invoke } from '@tauri-apps/api/core'
import { mondayOf } from './schedule'
import {
  REPEAT_IDS,
  normalizeColor,
  type AppState,
  type ColorId,
  type Entry,
  type Language,
  type OccurrenceException,
  type Repeat,
  type SubTodo,
  type Todo,
} from './types'

const STORAGE_KEY = 'timetracker'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function defaultLanguage(): Language {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('de')) return 'de'
  return 'en'
}

export function createDefaultState(): AppState {
  return {
    version: 1,
    todos: [],
    entries: [],
    settings: {
      language: defaultLanguage(),
      trackingMode: false,
      weekStart: mondayOf(new Date()),
    },
  }
}

function isColor(value: unknown): value is ColorId {
  return normalizeColor(value) !== null
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isSubTodo(value: unknown): value is SubTodo {
  if (!value || typeof value !== 'object') return false
  const item = value as SubTodo
  return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.order === 'number'
}

function isTodo(value: unknown): value is Todo {
  if (!value || typeof value !== 'object') return false
  const item = value as Todo
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    normalizeColor(item.color) !== null &&
    typeof item.collapsed === 'boolean' &&
    typeof item.order === 'number' &&
    Array.isArray(item.children) &&
    item.children.every(isSubTodo)
  )
}

function isRepeat(value: unknown): value is Repeat {
  return typeof value === 'string' && (REPEAT_IDS as readonly string[]).includes(value)
}

function normalizeException(value: unknown): OccurrenceException | null {
  if (!value || typeof value !== 'object') return null
  const item = value as OccurrenceException
  if (!isIsoDate(item.date)) return null
  const exception: OccurrenceException = { date: item.date }
  if (item.deleted === true) exception.deleted = true
  if (isIsoDate(item.movedTo)) exception.movedTo = item.movedTo
  if (typeof item.planStart === 'number') exception.planStart = item.planStart
  if (typeof item.planEnd === 'number') exception.planEnd = item.planEnd
  if (typeof item.actualStart === 'number') exception.actualStart = item.actualStart
  if (typeof item.actualEnd === 'number') exception.actualEnd = item.actualEnd
  if (typeof item.actualCustomized === 'boolean') exception.actualCustomized = item.actualCustomized
  if (item.actualRemoved === true) exception.actualRemoved = true
  if (typeof item.title === 'string') exception.title = item.title
  const color = normalizeColor(item.color)
  if (color) exception.color = color
  if (typeof item.actualTitle === 'string') exception.actualTitle = item.actualTitle
  const actualColor = normalizeColor(item.actualColor)
  if (actualColor) exception.actualColor = actualColor
  if (typeof item.planNote === 'string') exception.planNote = item.planNote
  if (typeof item.actualNote === 'string') exception.actualNote = item.actualNote
  return exception
}

function normalizeEntry(value: unknown): Entry | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<Entry>
  const linkOk =
    item.link === null ||
    (typeof item.link === 'object' &&
      !!item.link &&
      (item.link.kind === 'todo' || item.link.kind === 'subtodo') &&
      typeof item.link.id === 'string')
  if (
    typeof item.id !== 'string' ||
    !isIsoDate(item.weekStart) ||
    typeof item.dayIndex !== 'number' ||
    !linkOk ||
    typeof item.title !== 'string' ||
    !isColor(item.color) ||
    typeof item.planStart !== 'number' ||
    typeof item.planEnd !== 'number' ||
    typeof item.actualStart !== 'number' ||
    typeof item.actualEnd !== 'number' ||
    typeof item.actualCustomized !== 'boolean'
  ) {
    return null
  }
  const exceptions = Array.isArray(item.exceptions)
    ? item.exceptions.flatMap((exception) => {
        const normalized = normalizeException(exception)
        return normalized ? [normalized] : []
      })
    : []
  return {
    id: item.id,
    weekStart: item.weekStart,
    dayIndex: item.dayIndex,
    link: item.link ?? null,
    title: item.title,
    color: normalizeColor(item.color) ?? 'blue',
    planStart: item.planStart,
    planEnd: item.planEnd,
    actualStart: item.actualStart,
    actualEnd: item.actualEnd,
    actualCustomized: item.actualCustomized,
    repeat: isRepeat(item.repeat) ? item.repeat : 'none',
    repeatUntil: isIsoDate(item.repeatUntil) ? item.repeatUntil : null,
    planNote: typeof item.planNote === 'string' ? item.planNote : '',
    actualNote: typeof item.actualNote === 'string' ? item.actualNote : '',
    actualRemoved: item.actualRemoved === true,
    actualOnly: item.actualOnly === true,
    actualTitle: typeof item.actualTitle === 'string' ? item.actualTitle : null,
    actualColor: normalizeColor(item.actualColor),
    exceptions,
  }
}

export function parseState(raw: string): AppState {
  const fallback = createDefaultState()
  try {
    const data = JSON.parse(raw) as Partial<AppState>
    if (!data || typeof data !== 'object') return fallback
    const language: Language =
      data.settings?.language === 'de' || data.settings?.language === 'en'
        ? data.settings.language
        : fallback.settings.language
    return {
      version: 1,
      todos: Array.isArray(data.todos)
        ? data.todos.flatMap((todo) => {
            if (!isTodo(todo)) return []
            const color = normalizeColor(todo.color)
            return color ? [{ ...todo, color }] : []
          })
        : [],
      entries: Array.isArray(data.entries)
        ? data.entries.flatMap((entry) => {
            const normalized = normalizeEntry(entry)
            return normalized ? [normalized] : []
          })
        : [],
      settings: {
        language,
        trackingMode: Boolean(data.settings?.trackingMode),
        weekStart: isIsoDate(data.settings?.weekStart) ? data.settings.weekStart : fallback.settings.weekStart,
      },
    }
  } catch {
    return fallback
  }
}

export async function loadState(): Promise<AppState> {
  try {
    if (isTauri()) {
      const raw = await invoke<string>('load_state')
      if (!raw) return createDefaultState()
      return parseState(raw)
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()
    return parseState(raw)
  } catch (error) {
    console.error('Failed to load TimeTracker data', error)
    return createDefaultState()
  }
}

export async function saveState(state: AppState): Promise<void> {
  const raw = JSON.stringify(state, null, 2)
  try {
    if (isTauri()) {
      await invoke('save_state', { contents: raw })
      return
    }
    localStorage.setItem(STORAGE_KEY, raw)
  } catch (error) {
    console.error('Failed to save TimeTracker data', error)
  }
}
