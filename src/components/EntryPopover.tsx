import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { formatMinutes, occurrenceDisplay, occurrenceOn } from '../lib/schedule'
import { REPEAT_IDS, colorById, type Repeat } from '../lib/types'
import { useStore } from '../state/store'
import { ColorSwatches } from './ColorSwatches'

const REPEAT_KEYS = {
  none: 'repeatNone',
  daily: 'repeatDaily',
  weekdays: 'repeatWeekdays',
  weekly: 'repeatWeekly',
  monthly: 'repeatMonthly',
} as const

export function EntryPopover() {
  const { t } = useI18n()
  const editing = useStore((state) => state.editing)
  const entries = useStore((state) => state.entries)
  const todos = useStore((state) => state.todos)
  const setEditing = useStore((state) => state.setEditing)
  const requestChange = useStore((state) => state.requestChange)
  const popoverRef = useRef<HTMLDivElement>(null)
  const entry = entries.find((item) => item.id === editing?.id)
  const occurrence = entry && editing ? occurrenceOn(entry, editing.originDate) : null
  const display = occurrence && editing ? occurrenceDisplay(occurrence, todos, editing.lane) : null
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const baseline = useRef({ title: '', note: '' })
  const draftRef = useRef({ title: '', note: '' })
  const editingRef = useRef(editing)
  editingRef.current = editing
  draftRef.current = { title, note }
  const pendingScope = useStore((state) => state.pendingScope)
  const pendingRef = useRef(pendingScope)
  pendingRef.current = pendingScope

  const identity = editing ? `${editing.id}\0${editing.originDate}\0${editing.lane}` : ''
  const [loadedFor, setLoadedFor] = useState('')
  if (identity !== loadedFor) {
    setLoadedFor(identity)
    if (display) {
      setTitle(display.title)
      setNote(display.note)
      baseline.current = { title: display.title, note: display.note }
      draftRef.current = { title: display.title, note: display.note }
    }
  }

  const flush = () => {
    const current = editingRef.current
    if (!current) return
    const draft = draftRef.current
    const changes = []
    if (draft.title !== baseline.current.title) changes.push({ kind: 'title' as const, title: draft.title })
    if (draft.note !== baseline.current.note) changes.push({ kind: 'note' as const, note: draft.note })
    if (changes.length === 0) return
    baseline.current = { title: draft.title, note: draft.note }
    requestChange(current, changes)
  }

  useLayoutEffect(() => {
    const popover = popoverRef.current
    if (!popover || !editing) return
    const place = () => {
      const anchor = document.querySelector<HTMLElement>(
        `[data-entry-id="${CSS.escape(editing.id)}"][data-origin="${CSS.escape(editing.originDate)}"][data-lane="${editing.lane}"]`,
      )
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
  }, [editing, occurrence?.planStart, occurrence?.planEnd, occurrence?.date])

  useEffect(() => {
    if (!editing) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('.modal-back')) return
      const current = editingRef.current
      const block = target instanceof Element ? target.closest('[data-entry-id]') : null
      const sameBlock =
        block instanceof HTMLElement &&
        current &&
        block.dataset.entryId === current.id &&
        block.dataset.origin === current.originDate &&
        block.dataset.lane === current.lane
      flush()
      if (!sameBlock) setEditing(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || pendingRef.current) return
      flush()
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', onKey, true)
    }
  })

  if (!occurrence || !editing || !display) return null

  return (
    <div className="popover" ref={popoverRef} role="dialog" aria-label={display.title || t('newEntry')}>
      <input
        value={title}
        placeholder={occurrence.link && editing.lane === 'plan' ? t('todoPlaceholder') : t('newEntry')}
        aria-label={t('newEntry')}
        onChange={(event) => setTitle(event.target.value)}
        autoFocus
      />
      <ColorSwatches
        value={colorById(display.color).id}
        onChange={(color) => requestChange(editing, [{ kind: 'color', color }])}
      />
      <label className="field">
        <span>{t('repeat')}</span>
        <select
          value={occurrence.repeat}
          aria-label={t('repeat')}
          onChange={(event) => requestChange(editing, [{ kind: 'repeat', repeat: event.target.value as Repeat }])}
        >
          {REPEAT_IDS.map((repeat) => (
            <option key={repeat} value={repeat}>
              {t(REPEAT_KEYS[repeat])}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('note')}</span>
        <textarea
          value={note}
          placeholder={t('notePlaceholder')}
          aria-label={t('note')}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {!occurrence.actualOnly && (
        <p className="times">
          {t('planColumn')} {formatMinutes(occurrence.planStart)}–{formatMinutes(occurrence.planEnd)}
        </p>
      )}
      {!occurrence.actualRemoved && (
        <p className="times">
          {t('actualColumn')} {formatMinutes(occurrence.actualStart)}–{formatMinutes(occurrence.actualEnd)}
        </p>
      )}
      {occurrence.link && editing.lane === 'plan' && <p className="hint">{t('linked')}</p>}
      <button type="button" className="danger" onClick={() => requestChange(editing, [{ kind: 'delete' }])}>
        {editing.lane === 'actual' && !occurrence.actualOnly ? t('removeActual') : t('delete')}
      </button>
    </div>
  )
}
