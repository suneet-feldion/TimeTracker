import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  copyWeekEntries,
  lookupLink,
  pastedEntry,
  previousWeek,
  reorder,
  resolveDisplay,
  shiftWeek as moveWeek,
  withActualTimes,
  withPlanTimes,
} from '../lib/schedule'
import { createDefaultState, loadState, saveState } from '../lib/storage'
import {
  COLOR_IDS,
  type AppState,
  type ColorId,
  type Entry,
  type EntryLink,
  type Lane,
  type Language,
  type Settings,
  type Todo,
} from '../lib/types'

function createId(): string {
  return crypto.randomUUID()
}

function nextOrder(items: { order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.order), -1) + 1
}

function syncSnapshots(state: AppState): AppState {
  return {
    ...state,
    entries: state.entries.map((entry) => {
      if (!entry.link) return entry
      const display = resolveDisplay(entry, state.todos)
      return { ...entry, title: display.title, color: display.color }
    }),
  }
}

export type NewEntry = {
  dayIndex: number
  start: number
  end: number
  lane?: Lane
  title?: string
  color?: ColorId
  link?: EntryLink | null
}

type StoreValue = {
  ready: boolean
  todos: Todo[]
  entries: Entry[]
  settings: Settings
  selectedId: string | null
  pasteDay: number | null
  editingId: string | null
  confirmCopy: boolean
  focusId: string | null
  clearFocus: () => void
  setLanguage: (language: Language) => void
  setTracking: (on: boolean) => void
  shiftWeek: (deltaWeeks: number) => void
  addTodo: () => void
  setTodoTitle: (id: string, title: string) => void
  setTodoColor: (id: string, color: ColorId) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  addSubtodo: (todoId: string) => void
  setSubtodoTitle: (todoId: string, id: string, title: string) => void
  deleteSubtodo: (todoId: string, id: string) => void
  moveTodo: (id: string, slot: number) => void
  moveSubtodo: (todoId: string, id: string, slot: number) => void
  addEntry: (input: NewEntry) => string
  updateEntryTimes: (id: string, lane: Lane, start: number, end: number, dayIndex?: number) => void
  setEntryTitle: (id: string, title: string) => void
  setEntryColor: (id: string, color: ColorId) => void
  deleteEntry: (id: string) => void
  deleteSelected: () => void
  selectEntry: (id: string | null) => void
  setPasteDay: (day: number | null) => void
  setEditing: (id: string | null) => void
  copySelected: () => void
  paste: () => void
  requestCopyPreviousWeek: () => void
  confirmCopyPreviousWeek: () => void
  cancelCopyPreviousWeek: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pasteDay, setPasteDay] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [clipboard, setClipboard] = useState<Entry | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void loadState().then((loaded) => {
      if (active) setState(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const handle = window.setTimeout(() => {
      void saveState(state)
    }, 200)
    return () => window.clearTimeout(handle)
  }, [state])

  const api = useMemo<StoreValue>(() => {
    const current = state ?? createDefaultState()

    const update = (fn: (value: AppState) => AppState) => {
      setState((value) => (value ? fn(value) : value))
    }

    const clearSelection = () => {
      setSelectedId(null)
      setEditingId(null)
    }

    const replaceWeek = (value: AppState): AppState => {
      const from = previousWeek(value.settings.weekStart)
      const copied = copyWeekEntries(value.entries, from, value.settings.weekStart, createId)
      return {
        ...value,
        entries: [...value.entries.filter((entry) => entry.weekStart !== value.settings.weekStart), ...copied],
      }
    }

    return {
      ready: state !== null,
      todos: current.todos,
      entries: current.entries,
      settings: current.settings,
      selectedId,
      pasteDay,
      editingId,
      confirmCopy,
      focusId,
      clearFocus: () => setFocusId(null),
      setLanguage: (language) => update((value) => ({ ...value, settings: { ...value.settings, language } })),
      setTracking: (on) => update((value) => ({ ...value, settings: { ...value.settings, trackingMode: on } })),
      shiftWeek: (deltaWeeks) => {
        clearSelection()
        setConfirmCopy(false)
        update((value) => ({
          ...value,
          settings: { ...value.settings, weekStart: moveWeek(value.settings.weekStart, deltaWeeks) },
        }))
      },
      addTodo: () => {
        const id = createId()
        update((value) => ({
          ...value,
          todos: [
            ...value.todos,
            {
              id,
              title: '',
              color: COLOR_IDS[value.todos.length % COLOR_IDS.length],
              collapsed: false,
              order: nextOrder(value.todos),
              children: [],
            },
          ],
        }))
        setFocusId(id)
      },
      setTodoTitle: (id, title) => {
        update((value) =>
          syncSnapshots({
            ...value,
            todos: value.todos.map((todo) => (todo.id === id ? { ...todo, title } : todo)),
          }),
        )
      },
      setTodoColor: (id, color) => {
        update((value) =>
          syncSnapshots({
            ...value,
            todos: value.todos.map((todo) => (todo.id === id ? { ...todo, color } : todo)),
          }),
        )
      },
      toggleTodo: (id) => {
        update((value) => ({
          ...value,
          todos: value.todos.map((todo) => (todo.id === id ? { ...todo, collapsed: !todo.collapsed } : todo)),
        }))
      },
      deleteTodo: (id) => {
        update((value) => {
          const todo = value.todos.find((item) => item.id === id)
          if (!todo) return value
          const childIds = new Set(todo.children.map((child) => child.id))
          return {
            ...value,
            todos: value.todos.filter((item) => item.id !== id),
            entries: value.entries.map((entry) => {
              if (!entry.link) return entry
              const matches =
                (entry.link.kind === 'todo' && entry.link.id === id) ||
                (entry.link.kind === 'subtodo' && childIds.has(entry.link.id))
              if (!matches) return entry
              const display = resolveDisplay(entry, value.todos)
              return { ...entry, link: null, title: display.title, color: display.color }
            }),
          }
        })
        if (focusId === id) setFocusId(null)
      },
      addSubtodo: (todoId) => {
        const id = createId()
        update((value) => ({
          ...value,
          todos: value.todos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  collapsed: false,
                  children: [...todo.children, { id, title: '', order: nextOrder(todo.children) }],
                }
              : todo,
          ),
        }))
        setFocusId(id)
      },
      moveTodo: (id, slot) => {
        update((value) => ({ ...value, todos: reorder(value.todos, id, slot) }))
      },
      moveSubtodo: (todoId, id, slot) => {
        update((value) => ({
          ...value,
          todos: value.todos.map((todo) =>
            todo.id === todoId ? { ...todo, children: reorder(todo.children, id, slot) } : todo,
          ),
        }))
      },
      setSubtodoTitle: (todoId, id, title) => {
        update((value) =>
          syncSnapshots({
            ...value,
            todos: value.todos.map((todo) =>
              todo.id === todoId
                ? { ...todo, children: todo.children.map((child) => (child.id === id ? { ...child, title } : child)) }
                : todo,
            ),
          }),
        )
      },
      deleteSubtodo: (todoId, id) => {
        update((value) => ({
          ...value,
          todos: value.todos.map((todo) =>
            todo.id === todoId ? { ...todo, children: todo.children.filter((child) => child.id !== id) } : todo,
          ),
          entries: value.entries.map((entry) => {
            if (entry.link?.kind !== 'subtodo' || entry.link.id !== id) return entry
            const display = resolveDisplay(entry, value.todos)
            return { ...entry, link: null, title: display.title, color: display.color }
          }),
        }))
      },
      addEntry: (input) => {
        const id = createId()
        update((value) => {
          const link = input.link ?? null
          const linked = link ? lookupLink(value.todos, link) : null
          if (link && !linked) return value
          const entry: Entry = {
            id,
            weekStart: value.settings.weekStart,
            dayIndex: input.dayIndex,
            link,
            title: linked?.title ?? input.title ?? '',
            color: linked?.color ?? input.color ?? 'blue',
            planStart: input.start,
            planEnd: input.end,
            actualStart: input.start,
            actualEnd: input.end,
            actualCustomized: input.lane === 'actual',
          }
          const timed = input.lane === 'actual' ? withActualTimes(entry, input.start, input.end) : withPlanTimes(entry, input.start, input.end)
          return { ...value, entries: [...value.entries, { ...timed, id, link, actualCustomized: input.lane === 'actual' }] }
        })
        setSelectedId(id)
        return id
      },
      updateEntryTimes: (id, lane, start, end, dayIndex) => {
        update((value) => ({
          ...value,
          entries: value.entries.map((entry) => {
            if (entry.id !== id) return entry
            const timed = lane === 'plan' ? withPlanTimes(entry, start, end) : withActualTimes(entry, start, end)
            if (lane === 'plan' && dayIndex !== undefined) return { ...timed, dayIndex }
            return timed
          }),
        }))
      },
      setEntryTitle: (id, title) => {
        update((value) => {
          const entry = value.entries.find((item) => item.id === id)
          if (!entry) return value
          if (!entry.link) {
            return { ...value, entries: value.entries.map((item) => (item.id === id ? { ...item, title } : item)) }
          }
          const todos = value.todos.map((todo) => {
            if (entry.link?.kind === 'todo' && todo.id === entry.link.id) return { ...todo, title }
            if (entry.link?.kind === 'subtodo') {
              return {
                ...todo,
                children: todo.children.map((child) => (child.id === entry.link?.id ? { ...child, title } : child)),
              }
            }
            return todo
          })
          return syncSnapshots({ ...value, todos })
        })
      },
      setEntryColor: (id, color) => {
        update((value) => {
          const entry = value.entries.find((item) => item.id === id)
          if (!entry) return value
          if (!entry.link) {
            return { ...value, entries: value.entries.map((item) => (item.id === id ? { ...item, color } : item)) }
          }
          const parentId =
            entry.link.kind === 'todo'
              ? entry.link.id
              : value.todos.find((todo) => todo.children.some((child) => child.id === entry.link?.id))?.id
          if (!parentId) return value
          return syncSnapshots({
            ...value,
            todos: value.todos.map((todo) => (todo.id === parentId ? { ...todo, color } : todo)),
          })
        })
      },
      deleteEntry: (id) => {
        update((value) => ({ ...value, entries: value.entries.filter((entry) => entry.id !== id) }))
        if (selectedId === id) setSelectedId(null)
        if (editingId === id) setEditingId(null)
      },
      deleteSelected: () => {
        if (!selectedId) return
        const id = selectedId
        update((value) => ({ ...value, entries: value.entries.filter((entry) => entry.id !== id) }))
        setSelectedId(null)
        setEditingId(null)
      },
      selectEntry: setSelectedId,
      setPasteDay,
      setEditing: setEditingId,
      copySelected: () => {
        if (!state || !selectedId) return
        const entry = state.entries.find((item) => item.id === selectedId)
        if (!entry) return
        const display = resolveDisplay(entry, state.todos)
        setClipboard({ ...entry, title: display.title, color: display.color })
      },
      paste: () => {
        if (!clipboard) return
        const id = createId()
        const day = pasteDay ?? clipboard.dayIndex
        update((value) => {
          const display = resolveDisplay(clipboard, value.todos)
          const next = pastedEntry({ ...clipboard, title: display.title, color: display.color }, value.settings.weekStart, day, id)
          return { ...value, entries: [...value.entries, next] }
        })
        setSelectedId(id)
        setEditingId(null)
      },
      requestCopyPreviousWeek: () => {
        if (!state) return
        const from = previousWeek(state.settings.weekStart)
        const hasPrevious = state.entries.some((entry) => entry.weekStart === from)
        if (!hasPrevious) return
        const hasCurrent = state.entries.some((entry) => entry.weekStart === state.settings.weekStart)
        if (hasCurrent) {
          setConfirmCopy(true)
          return
        }
        clearSelection()
        update(replaceWeek)
      },
      confirmCopyPreviousWeek: () => {
        clearSelection()
        setConfirmCopy(false)
        update(replaceWeek)
      },
      cancelCopyPreviousWeek: () => setConfirmCopy(false),
    }
  }, [clipboard, confirmCopy, editingId, focusId, pasteDay, selectedId, state])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore<T>(selector: (state: StoreValue) => T): T {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return selector(value)
}
