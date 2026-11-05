import { useEffect, useState, type DragEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { colorById } from '../lib/types'
import { useStore } from '../state/store'
import { ColorSwatches } from './ColorSwatches'
import { IconChevron, IconGrip, IconPlus, IconTrash } from './icons'

type Dragging = { kind: 'todo'; id: string } | { kind: 'subtodo'; id: string; parentId: string }
type DropTarget = { list: string; slot: number }

const TODO_LIST = 'todos'

export function TodoSidebar() {
  const { t } = useI18n()
  const todos = useStore((state) => state.todos)
  const focusId = useStore((state) => state.focusId)
  const clearFocus = useStore((state) => state.clearFocus)
  const addTodo = useStore((state) => state.addTodo)
  const setTodoTitle = useStore((state) => state.setTodoTitle)
  const setTodoColor = useStore((state) => state.setTodoColor)
  const toggleTodo = useStore((state) => state.toggleTodo)
  const deleteTodo = useStore((state) => state.deleteTodo)
  const addSubtodo = useStore((state) => state.addSubtodo)
  const setSubtodoTitle = useStore((state) => state.setSubtodoTitle)
  const deleteSubtodo = useStore((state) => state.deleteSubtodo)
  const moveTodo = useStore((state) => state.moveTodo)
  const moveSubtodo = useStore((state) => state.moveSubtodo)
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  // WebKit hides dataTransfer contents during dragover, so the dragged item is tracked here.
  const [dragging, setDragging] = useState<Dragging | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  useEffect(() => {
    if (!focusId) return
    document.querySelector<HTMLInputElement>(`[data-focus-id="${CSS.escape(focusId)}"]`)?.focus()
    clearFocus()
  }, [clearFocus, focusId])

  useEffect(() => {
    if (!menu) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.color-menu, .dot')) return
      setMenu(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  const ordered = [...todos].sort((a, b) => a.order - b.order)
  const menuTodo = ordered.find((todo) => todo.id === menu?.id)

  const endDrag = () => {
    setDragging(null)
    setDropTarget(null)
  }

  const showDrop = (list: string, slot: number) => {
    setDropTarget((current) => (current?.list === list && current.slot === slot ? current : { list, slot }))
  }

  const dropMark = (list: string, index: number, count: number): string => {
    if (dropTarget?.list !== list) return ''
    if (dropTarget.slot === index) return ' drop-before'
    if (dropTarget.slot === count && index === count - 1) return ' drop-after'
    return ''
  }

  const onScrollDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return
    if (dragging?.kind === 'todo' && ordered.length > 0) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      showDrop(TODO_LIST, ordered.length)
      return
    }
    setDropTarget(null)
  }

  const onScrollDrop = (event: DragEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return
    if (dragging?.kind === 'todo') {
      event.preventDefault()
      moveTodo(dragging.id, ordered.length)
    }
    endDrag()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h1>{t('todos')}</h1>
        <button type="button" className="icon-btn" aria-label={t('addTodo')} onClick={addTodo}>
          <IconPlus />
        </button>
      </div>
      <div
        className="todo-scroll"
        onDragOver={onScrollDragOver}
        onDrop={onScrollDrop}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return
          setDropTarget(null)
        }}
      >
        {ordered.length === 0 && <p className="empty">{t('emptyTodos')}</p>}
        <ul className="todo-list">
          {ordered.map((todo, index) => {
            const palette = colorById(todo.color)
            const children = [...todo.children].sort((a, b) => a.order - b.order)
            const isDragged = dragging?.id === todo.id
            return (
              <li
                key={todo.id}
                className={`todo-item${isDragged ? ' dragging' : ''}${dropMark(TODO_LIST, index, ordered.length)}`}
                onDragOver={(event) => {
                  if (dragging?.kind !== 'todo') return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  showDrop(TODO_LIST, slotAt(event, index))
                }}
                onDrop={(event) => {
                  if (dragging?.kind !== 'todo') return
                  event.preventDefault()
                  moveTodo(dragging.id, slotAt(event, index))
                  endDrag()
                }}
              >
                <div className="todo-row">
                  <span
                    className="grip"
                    draggable
                    role="img"
                    aria-label={t('dragTodo')}
                    title={t('dragTodo')}
                    onDragStart={(event) => {
                      if (startDrag(event, 'todo', todo.id)) {
                        window.setTimeout(() => setDragging({ kind: 'todo', id: todo.id }))
                      }
                    }}
                    onDragEnd={endDrag}
                  >
                    <IconGrip />
                  </span>
                  <button
                    type="button"
                    className={todo.collapsed ? 'chevron collapsed' : 'chevron'}
                    aria-label={todo.title || t('todoPlaceholder')}
                    aria-expanded={!todo.collapsed}
                    onClick={() => toggleTodo(todo.id)}
                  >
                    <IconChevron />
                  </button>
                  <button
                    type="button"
                    className="dot"
                    style={{ background: palette.solid }}
                    aria-label={t('color')}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      setMenu((current) =>
                        current?.id === todo.id ? null : { id: todo.id, top: rect.bottom + 6, left: rect.left },
                      )
                    }}
                  />
                  <input
                    className="todo-title"
                    data-focus-id={todo.id}
                    value={todo.title}
                    placeholder={t('todoPlaceholder')}
                    aria-label={t('todoPlaceholder')}
                    onChange={(event) => setTodoTitle(todo.id, event.target.value)}
                  />
                  <button type="button" className="quiet" aria-label={t('addSubtodo')} onClick={() => addSubtodo(todo.id)}>
                    <IconPlus size={14} />
                  </button>
                  <button type="button" className="quiet" aria-label={t('deleteTodo')} onClick={() => deleteTodo(todo.id)}>
                    <IconTrash />
                  </button>
                </div>
                {!todo.collapsed && children.length > 0 && (
                  <ul className="subtodo-list">
                    {children.map((child, childIndex) => (
                      <li
                        key={child.id}
                        className={`todo-item${dragging?.id === child.id ? ' dragging' : ''}${dropMark(todo.id, childIndex, children.length)}`}
                        onDragOver={(event) => {
                          if (dragging?.kind !== 'subtodo' || dragging.parentId !== todo.id) return
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                          showDrop(todo.id, slotAt(event, childIndex))
                        }}
                        onDrop={(event) => {
                          if (dragging?.kind !== 'subtodo' || dragging.parentId !== todo.id) return
                          event.preventDefault()
                          moveSubtodo(todo.id, dragging.id, slotAt(event, childIndex))
                          endDrag()
                        }}
                      >
                        <div className="todo-row sub">
                          <span
                            className="grip"
                            draggable
                            role="img"
                            aria-label={t('dragTodo')}
                            title={t('dragTodo')}
                            onDragStart={(event) => {
                              if (startDrag(event, 'subtodo', child.id)) {
                                window.setTimeout(() => setDragging({ kind: 'subtodo', id: child.id, parentId: todo.id }))
                              }
                            }}
                            onDragEnd={endDrag}
                          >
                            <IconGrip />
                          </span>
                          <span className="inherit" style={{ background: palette.solid }} />
                          <input
                            className="todo-title"
                            data-focus-id={child.id}
                            value={child.title}
                            placeholder={t('subtodoPlaceholder')}
                            aria-label={t('subtodoPlaceholder')}
                            onChange={(event) => setSubtodoTitle(todo.id, child.id, event.target.value)}
                          />
                          <button
                            type="button"
                            className="quiet"
                            aria-label={t('deleteSubtodo')}
                            onClick={() => deleteSubtodo(todo.id, child.id)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {menu && menuTodo && (
        <div className="color-menu" style={{ top: menu.top, left: menu.left }}>
          <ColorSwatches
            value={menuTodo.color}
            onChange={(color) => {
              setTodoColor(menuTodo.id, color)
              setMenu(null)
            }}
          />
        </div>
      )}
    </aside>
  )
}

function startDrag(event: DragEvent<HTMLElement>, kind: 'todo' | 'subtodo', id: string): boolean {
  const target = event.target
  if (target instanceof Element && target.closest('input, button')) {
    event.preventDefault()
    return false
  }
  event.dataTransfer.setData('application/x-timetracker', JSON.stringify({ kind, id }))
  event.dataTransfer.effectAllowed = 'copyMove'
  const row = event.currentTarget.closest('.todo-row')
  if (row instanceof HTMLElement) {
    const rect = row.getBoundingClientRect()
    event.dataTransfer.setDragImage(row, event.clientX - rect.left, event.clientY - rect.top)
  }
  return true
}

/** Slot before or after the item, split at the middle of its own row so expanded children don't count. */
function slotAt(event: DragEvent<HTMLElement>, index: number): number {
  const row = event.currentTarget.querySelector('.todo-row') ?? event.currentTarget
  const rect = row.getBoundingClientRect()
  return event.clientY > rect.top + rect.height / 2 ? index + 1 : index
}
