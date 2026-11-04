import { useEffect, useState, type DragEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { colorById } from '../lib/types'
import { useStore } from '../state/store'
import { ColorSwatches } from './ColorSwatches'
import { IconChevron, IconGrip, IconPlus, IconTrash } from './icons'

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
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null)

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

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h1>{t('todos')}</h1>
        <button type="button" className="icon-btn" aria-label={t('addTodo')} onClick={addTodo}>
          <IconPlus />
        </button>
      </div>
      <div className="todo-scroll">
        {ordered.length === 0 && <p className="empty">{t('emptyTodos')}</p>}
        <ul className="todo-list">
          {ordered.map((todo) => {
            const palette = colorById(todo.color)
            const children = [...todo.children].sort((a, b) => a.order - b.order)
            return (
              <li key={todo.id}>
                <div className="todo-row">
                  <span
                    className="grip"
                    draggable
                    role="img"
                    aria-label={t('dragTodo')}
                    title={t('dragTodo')}
                    onDragStart={(event) => startDrag(event, 'todo', todo.id)}
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
                    {children.map((child) => (
                      <li key={child.id}>
                        <div className="todo-row sub">
                          <span
                            className="grip"
                            draggable
                            role="img"
                            aria-label={t('dragTodo')}
                            title={t('dragTodo')}
                            onDragStart={(event) => startDrag(event, 'subtodo', child.id)}
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

function startDrag(event: DragEvent, kind: 'todo' | 'subtodo', id: string) {
  const target = event.target
  if (target instanceof Element && target.closest('input, button')) {
    event.preventDefault()
    return
  }
  const payload = JSON.stringify({ kind, id })
  event.dataTransfer.setData('application/x-timetracker', payload)
  event.dataTransfer.setData('text/plain', payload)
  event.dataTransfer.effectAllowed = 'copy'
}
