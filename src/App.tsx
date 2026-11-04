import { useEffect } from 'react'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EntryPopover } from './components/EntryPopover'
import { TodoSidebar } from './components/TodoSidebar'
import { TopBar } from './components/TopBar'
import { WeekGrid } from './components/WeekGrid'
import { useStore } from './state/store'

export function App() {
  const ready = useStore((state) => state.ready)
  const language = useStore((state) => state.settings.language)
  const confirmCopy = useStore((state) => state.confirmCopy)
  const editingId = useStore((state) => state.editingId)
  const shiftWeek = useStore((state) => state.shiftWeek)
  const copySelected = useStore((state) => state.copySelected)
  const paste = useStore((state) => state.paste)
  const deleteSelected = useStore((state) => state.deleteSelected)
  const setEditing = useStore((state) => state.setEditing)
  const selectEntry = useStore((state) => state.selectEntry)
  const confirmCopyPreviousWeek = useStore((state) => state.confirmCopyPreviousWeek)
  const cancelCopyPreviousWeek = useStore((state) => state.cancelCopyPreviousWeek)

  useEffect(() => {
    if (!ready) return
    document.documentElement.lang = language
  }, [language, ready])

  useEffect(() => {
    if (!ready) return
    const onKey = (event: KeyboardEvent) => {
      if (confirmCopy) {
        if (event.key === 'Escape') cancelCopyPreviousWeek()
        if (event.key === 'Enter') confirmCopyPreviousWeek()
        return
      }
      const target = event.target
      const typing = target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')
      if (event.key === 'Escape') {
        setEditing(null)
        selectEntry(null)
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
      } else if (!editingId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    cancelCopyPreviousWeek,
    confirmCopy,
    confirmCopyPreviousWeek,
    copySelected,
    deleteSelected,
    editingId,
    paste,
    ready,
    selectEntry,
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
      <ConfirmDialog />
    </div>
  )
}
