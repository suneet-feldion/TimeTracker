import { useEffect } from 'react'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EntryPopover } from './components/EntryPopover'
import { ScopeDialog } from './components/ScopeDialog'
import { TodoSidebar } from './components/TodoSidebar'
import { TopBar } from './components/TopBar'
import { WeekGrid } from './components/WeekGrid'
import { useStore } from './state/store'

export function App() {
  const ready = useStore((state) => state.ready)
  const language = useStore((state) => state.settings.language)
  const confirmCopy = useStore((state) => state.confirmCopy)
  const editing = useStore((state) => state.editing)
  const pendingScope = useStore((state) => state.pendingScope)
  const shiftWeek = useStore((state) => state.shiftWeek)
  const copySelected = useStore((state) => state.copySelected)
  const paste = useStore((state) => state.paste)
  const deleteSelected = useStore((state) => state.deleteSelected)
  const setEditing = useStore((state) => state.setEditing)
  const selectOccurrence = useStore((state) => state.selectOccurrence)
  const cancelScope = useStore((state) => state.cancelScope)
  const confirmCopyPreviousWeek = useStore((state) => state.confirmCopyPreviousWeek)
  const cancelCopyPreviousWeek = useStore((state) => state.cancelCopyPreviousWeek)

  useEffect(() => {
    if (!ready) return
    document.documentElement.lang = language
  }, [language, ready])

  useEffect(() => {
    if (!ready) return
    const onKey = (event: KeyboardEvent) => {
      if (pendingScope) {
        if (event.key === 'Escape') cancelScope()
        return
      }
      if (confirmCopy) {
        if (event.key === 'Escape') cancelCopyPreviousWeek()
        if (event.key === 'Enter') confirmCopyPreviousWeek()
        return
      }
      const target = event.target
      const typing = target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')
      if (event.key === 'Escape') {
        setEditing(null)
        selectOccurrence(null)
        return
      }
      if (typing) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        shiftWeek(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        shiftWeek(1)
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelected()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        paste()
      } else if (!editing && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    cancelCopyPreviousWeek,
    cancelScope,
    confirmCopy,
    confirmCopyPreviousWeek,
    copySelected,
    deleteSelected,
    editing,
    paste,
    pendingScope,
    ready,
    selectOccurrence,
    setEditing,
    shiftWeek,
  ])

  if (!ready) return <div className="boot">TimeTracker</div>

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <TodoSidebar />
        <WeekGrid />
      </div>
      <EntryPopover />
      <ScopeDialog />
      <ConfirmDialog />
    </div>
  )
}
