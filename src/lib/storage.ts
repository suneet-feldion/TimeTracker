import { invoke } from '@tauri-apps/api/core'
import { mondayOf } from './schedule'
import { COLOR_IDS, type AppState, type ColorId, type Entry, type Language, type SubTodo, type Todo } from './types'

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
  return typeof value === 'string' && (COLOR_IDS as readonly string[]).includes(value)
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
    isColor(item.color) &&
    typeof item.collapsed === 'boolean' &&
    typeof item.order === 'number' &&
    Array.isArray(item.children) &&
    item.children.every(isSubTodo)
  )
}

function isEntry(value: unknown): value is Entry {
  if (!value || typeof value !== 'object') return false
  const item = value as Entry
  const linkOk =
    item.link === null ||
    (typeof item.link === 'object' &&
      (item.link.kind === 'todo' || item.link.kind === 'subtodo') &&
      typeof item.link.id === 'string')
  return (
    typeof item.id === 'string' &&
    isIsoDate(item.weekStart) &&
    typeof item.dayIndex === 'number' &&
    linkOk &&
    typeof item.title === 'string' &&
    isColor(item.color) &&
    typeof item.planStart === 'number' &&
    typeof item.planEnd === 'number' &&
    typeof item.actualStart === 'number' &&
    typeof item.actualEnd === 'number' &&
    typeof item.actualCustomized === 'boolean'
  )
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
      todos: Array.isArray(data.todos) ? data.todos.filter(isTodo) : [],
      entries: Array.isArray(data.entries) ? data.entries.filter(isEntry) : [],
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
