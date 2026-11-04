import { useEffect, useLayoutEffect, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { formatMinutes, resolveDisplay } from '../lib/schedule'
import { colorById } from '../lib/types'
import { useStore } from '../state/store'
import { ColorSwatches } from './ColorSwatches'

export function EntryPopover() {
  const { t } = useI18n()
  const editingId = useStore((state) => state.editingId)
  const entries = useStore((state) => state.entries)
  const todos = useStore((state) => state.todos)
  const setEditing = useStore((state) => state.setEditing)
  const setEntryTitle = useStore((state) => state.setEntryTitle)
  const setEntryColor = useStore((state) => state.setEntryColor)
  const deleteEntry = useStore((state) => state.deleteEntry)
  const popoverRef = useRef<HTMLDivElement>(null)
  const entry = entries.find((item) => item.id === editingId)

  useLayoutEffect(() => {
    const popover = popoverRef.current
    if (!popover || !editingId) return
    const place = () => {
      const anchor = document.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(editingId)}"]`)
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const width = popover.offsetWidth
      const height = popover.offsetHeight
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right + 8))
      const top = Math.min(window.innerHeight - height - 12, Math.max(12, rect.top))
      popover.style.left = `${left}px`
      popover.style.top = `${top}px`
    }
    place()
    const scroller = document.querySelector('.cal-scroll')
    scroller?.addEventListener('scroll', place)
    window.addEventListener('resize', place)
    return () => {
      scroller?.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [editingId, entry?.planStart, entry?.planEnd, entry?.dayIndex])

  useEffect(() => {
    if (!editingId) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target)) return
      if (target instanceof Element) {
        const block = target.closest('[data-entry-id]')
        if (block instanceof HTMLElement && block.dataset.entryId === editingId) return
      }
      setEditing(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [editingId, setEditing])

  if (!entry) return null
  const display = resolveDisplay(entry, todos)

  return (
    <div className="popover" ref={popoverRef} role="dialog" aria-label={display.title || t('newEntry')}>
      <input
        value={display.title}
        placeholder={entry.link ? t('todoPlaceholder') : t('newEntry')}
        aria-label={t('newEntry')}
        onChange={(event) => setEntryTitle(entry.id, event.target.value)}
        autoFocus
      />
      <ColorSwatches value={colorById(display.color).id} onChange={(color) => setEntryColor(entry.id, color)} />
      <p className="times">
        {t('planColumn')} {formatMinutes(entry.planStart)}–{formatMinutes(entry.planEnd)}
      </p>
      <p className="times">
        {t('actualColumn')} {formatMinutes(entry.actualStart)}–{formatMinutes(entry.actualEnd)}
      </p>
      {entry.link && <p className="hint">{t('linked')}</p>}
      <button type="button" className="danger" onClick={() => deleteEntry(entry.id)}>
        {t('delete')}
      </button>
    </div>
  )
}
