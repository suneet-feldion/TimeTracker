import { describe, expect, it } from 'vitest'
import type { Entry, Todo } from './types'
import {
  DAY_END,
  DAY_START,
  copyWeekEntries,
  formatWeekRange,
  layoutColumns,
  mondayOf,
  moveWithinDay,
  pastedEntry,
  placeDuration,
  rangeFromDrag,
  resolveDisplay,
  resizeEnd,
  resizeStart,
  snap,
  withActualTimes,
  withPlanTimes,
} from './schedule'

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    weekStart: '2026-11-02',
    dayIndex: 0,
    link: null,
    title: 'Lernen',
    color: 'blue',
    planStart: 9 * 60,
    planEnd: 11 * 60,
    actualStart: 9 * 60,
    actualEnd: 11 * 60,
    actualCustomized: false,
    ...overrides,
  }
}

describe('weeks start on Monday', () => {
  it('maps Wednesday, Sunday, and Monday onto the same Monday', () => {
    expect(mondayOf(new Date(2026, 10, 4))).toBe('2026-11-02')
    expect(mondayOf(new Date(2026, 10, 8))).toBe('2026-11-02')
    expect(mondayOf(new Date(2026, 10, 2))).toBe('2026-11-02')
  })
})

describe('snapping and ranges', () => {
  it('snaps to 15 minutes', () => {
    expect(snap(6 * 60 + 7)).toBe(6 * 60)
    expect(snap(6 * 60 + 8)).toBe(6 * 60 + 15)
  })

  it('ignores a drag that snaps to less than 15 minutes', () => {
    expect(rangeFromDrag(9 * 60, 9 * 60 + 7)).toBeNull()
  })

  it('creates a two-hour range and clamps it to the day', () => {
    expect(rangeFromDrag(9 * 60, 11 * 60)).toEqual({ start: 9 * 60, end: 11 * 60 })
    expect(rangeFromDrag(22 * 60, 23 * 60 + 40)?.end).toBe(DAY_END)
    expect(rangeFromDrag(5 * 60, 7 * 60)?.start).toBe(DAY_START)
  })

  it('keeps a moved block inside 6:00–23:00', () => {
    expect(moveWithinDay(2 * 60, 22 * 60)).toEqual({ start: 21 * 60, end: 23 * 60 })
  })

  it('keeps a minimum length while resizing', () => {
    expect(resizeEnd(10 * 60, 10 * 60)).toEqual({ start: 10 * 60, end: 10 * 60 + 15 })
    expect(resizeStart(8 * 60, 8 * 60)).toEqual({ start: 8 * 60 - 15, end: 8 * 60 })
  })

  it('places a one-hour block even near the end of the day', () => {
    expect(placeDuration(22 * 60 + 30)).toEqual({ start: 22 * 60, end: 23 * 60 })
  })
})

describe('plan and actual times', () => {
  it('lets actual follow the plan until it is edited', () => {
    const planned = withPlanTimes(entry(), 10 * 60, 12 * 60)
    expect(planned.actualStart).toBe(10 * 60)
    expect(planned.actualEnd).toBe(12 * 60)
    expect(planned.actualCustomized).toBe(false)
  })

  it('keeps a customized actual time when the plan changes', () => {
    const customized = withActualTimes(entry(), 9 * 60, 12 * 60)
    const planned = withPlanTimes(customized, 8 * 60, 10 * 60)
    expect(planned.planStart).toBe(8 * 60)
    expect(planned.planEnd).toBe(10 * 60)
    expect(planned.actualStart).toBe(9 * 60)
    expect(planned.actualEnd).toBe(12 * 60)
    expect(planned.actualCustomized).toBe(true)
  })
})

describe('copying weeks and entries', () => {
  it('copies only the plan and resets actual time', () => {
    const ids = ['a', 'b']
    const copied = copyWeekEntries(
      [
        entry({ id: 'old', actualCustomized: true, actualEnd: 14 * 60 }),
        entry({ id: 'other', weekStart: '2026-11-09' }),
      ],
      '2026-11-02',
      '2026-11-09',
      () => ids.shift() ?? 'x',
    )
    expect(copied).toHaveLength(1)
    expect(copied[0]).toMatchObject({
      id: 'a',
      weekStart: '2026-11-09',
      planStart: 9 * 60,
      planEnd: 11 * 60,
      actualStart: 9 * 60,
      actualEnd: 11 * 60,
      actualCustomized: false,
    })
  })

  it('pastes onto another day with actual time back in sync', () => {
    const copy = pastedEntry(
      entry({ dayIndex: 0, actualCustomized: true, actualEnd: 14 * 60 }),
      '2026-11-09',
      4,
      'pasted',
    )
    expect(copy).toMatchObject({
      id: 'pasted',
      weekStart: '2026-11-09',
      dayIndex: 4,
      actualStart: 9 * 60,
      actualEnd: 11 * 60,
      actualCustomized: false,
    })
  })
})

describe('linked todos', () => {
  const todos: Todo[] = [
    {
      id: 'todo-1',
      title: 'Lernen',
      color: 'green',
      collapsed: false,
      order: 0,
      children: [{ id: 'sub-1', title: 'Mathe', order: 0 }],
    },
  ]

  it('uses the parent color for a sub-todo', () => {
    expect(resolveDisplay(entry({ link: { kind: 'subtodo', id: 'sub-1' }, title: 'alt', color: 'red' }), todos)).toEqual({
      title: 'Mathe',
      color: 'green',
    })
  })

  it('falls back to the snapshot when the link is gone', () => {
    expect(resolveDisplay(entry({ link: { kind: 'todo', id: 'missing' }, title: 'Gym', color: 'amber' }), todos)).toEqual({
      title: 'Gym',
      color: 'amber',
    })
  })
})

describe('week labels', () => {
  it('formats a week inside one month', () => {
    expect(formatWeekRange('2026-11-02', 'de')).toBe('2.–8. Nov 2026')
    expect(formatWeekRange('2026-11-02', 'en')).toBe('Nov 2–8, 2026')
  })

  it('formats a week across months and years', () => {
    expect(formatWeekRange('2026-11-30', 'de')).toBe('30. Nov – 6. Dez 2026')
    expect(formatWeekRange('2026-12-28', 'en')).toBe('Dec 28, 2026 – Jan 3, 2027')
  })
})

describe('overlap layout', () => {
  it('splits overlapping blocks and leaves a later block full width', () => {
    const layout = layoutColumns([
      { id: 'a', start: 9 * 60, end: 11 * 60 },
      { id: 'b', start: 10 * 60, end: 12 * 60 },
      { id: 'c', start: 12 * 60, end: 13 * 60 },
    ])
    expect(layout.get('a')?.columns).toBe(2)
    expect(layout.get('b')?.columns).toBe(2)
    expect(layout.get('a')?.column).not.toBe(layout.get('b')?.column)
    expect(layout.get('c')).toEqual({ column: 0, columns: 1 })
  })
})
