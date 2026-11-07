import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addDays,
  applyScopedChange,
  blankEntryFields,
  copyWeekEntries,
  entryAnchor,
  lookupLink,
  occurrenceDisplay,
  occurrenceOn,
  pastedEntry,
  previousWeek,
  reorder,
  resolveDisplay,
  shiftWeek as moveWeek,
  withActualTimes,
  withPlanTimes,
  type EntryChange,
  type OccurrenceRef,
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
  type Scope,
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

export type PendingScope = {
  ref: OccurrenceRef
  changes: EntryChange[]
  allowOne: boolean
}

function applyLinkChange(todos: Todo[], entry: Entry, change: EntryChange): Todo[] {
  if (!entry.link) return todos
  if (change.kind === 'title') {
    const title = change.title
    if (entry.link.kind === 'todo') {
      return todos.map((todo) => (todo.id === entry.link?.id ? { ...todo, title } : todo))
    }
    const childId = entry.link.id
    return todos.map((todo) => ({
      ...todo,
      children: todo.children.map((child) => (child.id === childId ? { ...child, title } : child)),
    }))
  }
  if (change.kind === 'color') {
    const color = change.color
    const parentId =
      entry.link.kind === 'todo'
        ? entry.link.id
        : todos.find((todo) => todo.children.some((child) => child.id === entry.link?.id))?.id
    if (!parentId) return todos
    return todos.map((todo) => (todo.id === parentId ? { ...todo, color } : todo))
  }
  return todos
}

function retarget(current: OccurrenceRef | null, from: OccurrenceRef, focus: OccurrenceRef | null): OccurrenceRef | null {
  if (!current || current.id !== from.id || current.originDate !== from.originDate) return current
  return focus ? { ...focus, lane: current.lane } : null
}

type StoreValue = {
  ready: boolean
  todos: Todo[]
  entries: Entry[]
  settings: Settings
  selected: OccurrenceRef | null
  pasteDay: number | null
  editing: OccurrenceRef | null
  pendingScope: PendingScope | null
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
  requestChange: (ref: OccurrenceRef, changes: EntryChange[]) => void
  confirmScope: (scope: Scope) => void
  cancelScope: () => void
  deleteSelected: () => void
  selectOccurrence: (ref: OccurrenceRef | null) => void
  setPasteDay: (day: number | null) => void
  setEditing: (ref: OccurrenceRef | null) => void
  copySelected: () => void
  paste: () => void
  requestCopyPreviousWeek: () => void
  confirmCopyPreviousWeek: () => void
  cancelCopyPreviousWeek: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [selected, setSelected] = useState<OccurrenceRef | null>(null)
  const [pasteDay, setPasteDay] = useState<number | null>(null)
  const [editing, setEditing] = useState<OccurrenceRef | null>(null)
  const [pendingScope, setPendingScope] = useState<PendingScope | null>(null)
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
      setSelected(null)
      setEditing(null)
      setPendingScope(null)
    }

    const commit = (ref: OccurrenceRef, scope: Scope, changes: EntryChange[]) => {
      if (!state) return
      let next = state
      let cursor = ref
      let focus: OccurrenceRef | null = ref
      for (const change of changes) {
        const entry = next.entries.find((item) => item.id === cursor.id)
        if (!entry) {
          focus = null
          break
        }
        const applied = applyScopedChange(next.entries, cursor, scope, change, createId)
        const anchor = entryAnchor(entry)
        const whole = scope === 'all' || (scope === 'following' && cursor.originDate <= anchor)
        if (entry.link && cursor.lane === 'plan' && whole && (change.kind === 'title' || change.kind === 'color')) {
          next = syncSnapshots({
            ...next,
            todos: applyLinkChange(next.todos, entry, change),
            entries: applied.entries,
          })
        } else {
          next = { ...next, entries: applied.entries }
        }
        focus = applied.focus
        if (!focus) break
        cursor = focus
      }
      setState(next)
      setSelected((current) => retarget(current, ref, focus))
      setEditing((current) => retarget(current, ref, focus))
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
      selected,
      pasteDay,
      editing,
      pendingScope,
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
            ...blankEntryFields(),
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
            actualOnly: input.lane === 'actual',
          }
          const timed = input.lane === 'actual' ? withActualTimes(entry, input.start, input.end) : withPlanTimes(entry, input.start, input.end)
          return {
            ...value,
            entries: [...value.entries, { ...timed, id, link, actualCustomized: input.lane === 'actual', actualOnly: input.lane === 'actual' }],
          }
        })
        const lane = input.lane ?? 'plan'
        setSelected(state ? { id, originDate: addDays(state.settings.weekStart, input.dayIndex), lane } : null)
        return id
      },
      requestChange: (ref, changes) => {
        if (!state || changes.length === 0) return
        const entry = state.entries.find((item) => item.id === ref.id)
        if (!entry) return
        if (entry.repeat === 'none') {
          commit(ref, 'all', changes)
          return
        }
        setPendingScope({ ref, changes, allowOne: changes.every((change) => change.kind !== 'repeat') })
      },
      confirmScope: (scope) => {
        if (!pendingScope) return
        commit(pendingScope.ref, scope, pendingScope.changes)
        setPendingScope(null)
      },
      cancelScope: () => setPendingScope(null),
      deleteSelected: () => {
        if (!selected) return
        const entry = state?.entries.find((item) => item.id === selected.id)
        if (!entry) return
        if (entry.repeat === 'none') {
          commit(selected, 'all', [{ kind: 'delete' }])
          return
        }
        setPendingScope({ ref: selected, changes: [{ kind: 'delete' }], allowOne: true })
      },
      selectOccurrence: setSelected,
      setPasteDay,
      setEditing,
      copySelected: () => {
        if (!state || !selected) return
        const entry = state.entries.find((item) => item.id === selected.id)
        if (!entry) return
        const occurrence = occurrenceOn(entry, selected.originDate)
        if (!occurrence) return
        const actualOnly = occurrence.actualOnly
        const display = occurrenceDisplay(occurrence, state.todos, actualOnly ? 'actual' : 'plan')
        const start = actualOnly ? occurrence.actualStart : occurrence.planStart
        const end = actualOnly ? occurrence.actualEnd : occurrence.planEnd
        setClipboard({
          ...blankEntryFields(),
          id: occurrence.id,
          weekStart: occurrence.weekStart,
          dayIndex: occurrence.dayIndex,
          link: actualOnly ? null : occurrence.link,
          title: display.title,
          color: display.color,
          planStart: start,
          planEnd: end,
          actualStart: start,
          actualEnd: end,
          actualCustomized: actualOnly,
          actualOnly,
          actualTitle: actualOnly ? occurrence.actualTitle : null,
          actualColor: actualOnly ? occurrence.actualColor : null,
          planNote: actualOnly ? '' : occurrence.planNote,
          actualNote: occurrence.actualNote,
        })
      },
      paste: () => {
        if (!clipboard || !state) return
        const id = createId()
        const day = pasteDay ?? clipboard.dayIndex
        const display = resolveDisplay(clipboard, state.todos)
        const next = pastedEntry(
          { ...clipboard, title: display.title, color: display.color },
          state.settings.weekStart,
          day,
          id,
        )
        setState({ ...state, entries: [...state.entries, next] })
        setSelected({ id, originDate: entryAnchor(next), lane: next.actualOnly ? 'actual' : 'plan' })
        setEditing(null)
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
  }, [clipboard, confirmCopy, editing, focusId, pasteDay, pendingScope, selected, state])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore<T>(selector: (state: StoreValue) => T): T {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return selector(value)
}
