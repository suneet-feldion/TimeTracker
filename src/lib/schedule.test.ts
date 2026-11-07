import { describe, expect, it } from 'vitest'
import { parseState } from './storage'
import { normalizeColor, type Entry, type Todo } from './types'
import {
  DAY_END,
  DAY_START,
  applyScopedChange,
  copyWeekEntries,
  formatWeekRange,
  layoutColumns,
  mondayOf,
  moveWithinDay,
  occurrenceDisplay,
  occurrenceOn,
  occurrencesInWeek,
  pastedEntry,
  shownOnLane,
  placeDuration,
  rangeFromDrag,
  reorder,
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
    repeat: 'none',
    repeatUntil: null,
    planNote: '',
    actualNote: '',
    actualRemoved: false,
    actualOnly: false,
    actualTitle: null,
    actualColor: null,
    exceptions: [],
    ...overrides,
  }
}

describe('palette', () => {
  it('keeps current colors and folds the retired ones into the ten', () => {
    expect(normalizeColor('blue')).toBe('blue')
    expect(normalizeColor('amber')).toBe('gold')
    expect(normalizeColor('teal')).toBe('green')
    expect(normalizeColor('cyan')).toBe('blue')
    const state = parseState(
      JSON.stringify({
        todos: [{ id: 't', title: 'Gym', color: 'olive', collapsed: false, order: 0, children: [] }],
        entries: [
          {
            id: 'e',
            weekStart: '2026-11-02',
            dayIndex: 0,
            link: null,
            title: 'Lesen',
            color: 'rose',
            planStart: 600,
            planEnd: 660,
            actualStart: 600,
            actualEnd: 660,
            actualCustomized: false,
            actualColor: 'cyan',
            exceptions: [{ date: '2026-11-02', color: 'brown' }],
          },
        ],
      }),
    )
    expect(state.todos[0]?.color).toBe('green')
    expect(state.entries[0]?.color).toBe('pink')
    expect(state.entries[0]?.actualColor).toBe('blue')
    expect(state.entries[0]?.exceptions[0]?.color).toBe('tan')
  })
})

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

  it('leaves a removed actual block removed when the plan changes', () => {
    const removed = entry({ actualRemoved: true, actualStart: 9 * 60, actualEnd: 10 * 60 })
    const planned = withPlanTimes(removed, 8 * 60, 9 * 60)
    expect(planned.planStart).toBe(8 * 60)
    expect(planned.actualStart).toBe(9 * 60)
    expect(planned.actualEnd).toBe(10 * 60)
    expect(planned.actualRemoved).toBe(true)
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
    expect(resolveDisplay(entry({ link: { kind: 'todo', id: 'missing' }, title: 'Gym', color: 'gold' }), todos)).toEqual({
      title: 'Gym',
      color: 'gold',
    })
  })
})

describe('reordering', () => {
  const items = [
    { id: 'c', order: 2 },
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
  ]
  const ids = (list: { id: string; order: number }[]) =>
    [...list].sort((x, y) => x.order - y.order).map((item) => item.id)

  it('moves an item up and renumbers the order', () => {
    const result = reorder(items, 'c', 0)
    expect(ids(result)).toEqual(['c', 'a', 'b'])
    expect(result.map((item) => item.order)).toEqual([0, 1, 2])
  })

  it('moves an item down past later items', () => {
    expect(ids(reorder(items, 'a', 3))).toEqual(['b', 'c', 'a'])
    expect(ids(reorder(items, 'a', 2))).toEqual(['b', 'a', 'c'])
  })

  it('keeps the order when dropped next to itself', () => {
    expect(ids(reorder(items, 'b', 1))).toEqual(['a', 'b', 'c'])
    expect(ids(reorder(items, 'b', 2))).toEqual(['a', 'b', 'c'])
  })

  it('ignores an unknown id', () => {
    expect(reorder(items, 'missing', 0)).toBe(items)
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

function ref(originDate: string, lane: 'plan' | 'actual' = 'plan') {
  return { id: 'entry-1', originDate, lane }
}

describe('recurrence', () => {
  const weekly = entry({ repeat: 'weekly' })

  it('places weekly, weekday, and monthly occurrences, skipping a short month', () => {
    expect(occurrencesInWeek([weekly], '2026-11-09').map((item) => item.date)).toEqual(['2026-11-09'])
    expect(occurrencesInWeek([entry({ repeat: 'weekdays' })], '2026-11-02')).toHaveLength(5)
    const monthly = entry({
      weekStart: '2026-01-26',
      dayIndex: 5,
      repeat: 'monthly',
    })
    expect(occurrenceOn(monthly, '2026-01-31')).not.toBeNull()
    expect(occurrenceOn(monthly, '2026-02-28')).toBeNull()
    expect(occurrenceOn(monthly, '2026-03-31')?.date).toBe('2026-03-31')
  })

  it('shows a moved occurrence in the destination week and hides it at the origin', () => {
    const moved = entry({
      repeat: 'weekly',
      exceptions: [{ date: '2026-11-09', movedTo: '2026-11-10' }],
    })
    expect(occurrencesInWeek([moved], '2026-11-09').map((item) => item.date)).toEqual(['2026-11-10'])
    expect(occurrencesInWeek([moved], '2026-11-02').map((item) => item.date)).toEqual(['2026-11-02'])
  })

  it('changes only one plan occurrence and lets its actual time follow', () => {
    const applied = applyScopedChange([weekly], ref('2026-11-09'), 'one', { kind: 'times', start: 10 * 60, end: 12 * 60 }, () => 'new')
    const changed = occurrenceOn(applied.entries[0], '2026-11-09')
    const untouched = occurrenceOn(applied.entries[0], '2026-11-02')
    expect(changed).toMatchObject({ planStart: 10 * 60, planEnd: 12 * 60, actualStart: 10 * 60, actualEnd: 12 * 60 })
    expect(untouched).toMatchObject({ planStart: 9 * 60, actualStart: 9 * 60 })
  })

  it('keeps the plan when only the actual time changes', () => {
    const applied = applyScopedChange(
      [weekly],
      ref('2026-11-09', 'actual'),
      'one',
      { kind: 'times', start: 10 * 60, end: 13 * 60 },
      () => 'new',
    )
    expect(occurrenceOn(applied.entries[0], '2026-11-09')).toMatchObject({
      planStart: 9 * 60,
      planEnd: 11 * 60,
      actualStart: 10 * 60,
      actualEnd: 13 * 60,
      actualCustomized: true,
    })
    expect(occurrenceOn(applied.entries[0], '2026-11-02')).toMatchObject({ actualStart: 9 * 60, actualCustomized: false })
  })

  it('removes the actual block and leaves the plan block', () => {
    const applied = applyScopedChange([weekly], ref('2026-11-09', 'actual'), 'one', { kind: 'delete' }, () => 'new')
    const changed = occurrenceOn(applied.entries[0], '2026-11-09')
    expect(changed?.actualRemoved).toBe(true)
    expect(changed?.planStart).toBe(9 * 60)
    expect(occurrencesInWeek(applied.entries, '2026-11-09')).toHaveLength(1)
    const later = applyScopedChange(applied.entries, ref('2026-11-02'), 'all', { kind: 'times', start: 8 * 60, end: 9 * 60 }, () => 'newer')
    expect(occurrenceOn(later.entries[0], '2026-11-09')?.actualRemoved).toBe(true)
    expect(occurrenceOn(later.entries[0], '2026-11-02')).toMatchObject({ planStart: 8 * 60, actualStart: 8 * 60, actualRemoved: false })
  })

  it('drops a single plan occurrence without deleting the series', () => {
    const applied = applyScopedChange([weekly], ref('2026-11-09'), 'one', { kind: 'delete' }, () => 'new')
    expect(occurrenceOn(applied.entries[0], '2026-11-09')).toBeNull()
    expect(occurrenceOn(applied.entries[0], '2026-11-16')?.date).toBe('2026-11-16')
  })

  it('splits the series from the edited occurrence and keeps later exceptions', () => {
    const series = entry({
      repeat: 'weekly',
      exceptions: [{ date: '2026-11-16', planNote: 'später' }],
    })
    const applied = applyScopedChange([series], ref('2026-11-09'), 'following', { kind: 'times', start: 8 * 60, end: 9 * 60 }, () => 'new')
    const oldSeries = applied.entries.find((item) => item.id === 'entry-1')
    const spawned = applied.entries.find((item) => item.id === 'new')
    expect(oldSeries?.repeatUntil).toBe('2026-11-09')
    expect(occurrenceOn(oldSeries!, '2026-11-02')).toMatchObject({ planStart: 9 * 60 })
    expect(occurrenceOn(spawned!, '2026-11-09')).toMatchObject({ planStart: 8 * 60, actualStart: 8 * 60 })
    expect(occurrenceOn(spawned!, '2026-11-16')).toMatchObject({ planStart: 8 * 60, planNote: 'später' })
  })

  it('clears deviant times when the whole series moves', () => {
    const series = entry({
      repeat: 'weekly',
      exceptions: [{ date: '2026-11-09', planStart: 7 * 60, planEnd: 8 * 60 }],
    })
    const applied = applyScopedChange([series], ref('2026-11-02'), 'all', { kind: 'times', start: 10 * 60, end: 11 * 60 }, () => 'new')
    expect(applied.entries[0].exceptions).toEqual([])
    expect(occurrenceOn(applied.entries[0], '2026-11-09')).toMatchObject({ planStart: 10 * 60, actualStart: 10 * 60 })
  })

  it('keeps plan and actual notes apart', () => {
    const applied = applyScopedChange([weekly], ref('2026-11-09', 'actual'), 'one', { kind: 'note', note: 'Ist-Notiz' }, () => 'new')
    const changed = occurrenceOn(applied.entries[0], '2026-11-09')
    expect(changed?.actualNote).toBe('Ist-Notiz')
    expect(changed?.planNote).toBe('')
    expect(occurrenceOn(applied.entries[0], '2026-11-02')?.actualNote).toBe('')
    const shown = occurrenceDisplay(changed!, [], 'actual')
    const plan = occurrenceDisplay(changed!, [], 'plan')
    expect(shown.note).toBe('Ist-Notiz')
    expect(plan.note).toBe('')
  })

  it('copies one-off entries and leaves a repeating series in place', () => {
    const copied = copyWeekEntries(
      [entry({ id: 'once' }), entry({ id: 'series', repeat: 'weekly' })],
      '2026-11-02',
      '2026-11-09',
      () => 'copy',
    )
    expect(copied.map((item) => item.id)).toEqual(['copy'])
    expect(copied[0].repeat).toBe('none')
  })

  it('pastes a repeating entry as a one-off', () => {
    const copy = pastedEntry(weekly, '2026-11-09', 2, 'pasted')
    expect(copy).toMatchObject({ repeat: 'none', dayIndex: 2, exceptions: [], actualCustomized: false })
  })

  it('shows an unplanned actual entry only in the actual lane', () => {
    const call = entry({
      id: 'call',
      title: '',
      actualTitle: 'Anruf',
      actualOnly: true,
      actualCustomized: true,
      planStart: 11 * 60,
      planEnd: 12 * 60,
      actualStart: 11 * 60,
      actualEnd: 12 * 60,
    })
    const gym = entry({ id: 'gym', planStart: 11 * 60, planEnd: 14 * 60, actualStart: 12 * 60, actualEnd: 14 * 60, actualCustomized: true })
    const callOccurrence = occurrenceOn(call, '2026-11-02')
    expect(callOccurrence && shownOnLane(callOccurrence, 'plan')).toBe(false)
    expect(callOccurrence && shownOnLane(callOccurrence, 'actual')).toBe(true)
    expect(occurrenceDisplay(callOccurrence!, [], 'actual').title).toBe('Anruf')
    const moved = applyScopedChange(
      [call, gym],
      { id: 'call', originDate: '2026-11-02', lane: 'actual' },
      'all',
      { kind: 'times', start: 11 * 60, end: 12 * 60 + 15 },
      () => 'new',
    )
    expect(occurrenceOn(moved.entries.find((item) => item.id === 'call')!, '2026-11-02')).toMatchObject({
      planStart: 11 * 60,
      planEnd: 12 * 60 + 15,
      actualStart: 11 * 60,
      actualEnd: 12 * 60 + 15,
    })
    expect(occurrenceOn(moved.entries.find((item) => item.id === 'gym')!, '2026-11-02')).toMatchObject({
      planStart: 11 * 60,
      planEnd: 14 * 60,
    })
  })

  it('deletes an unplanned actual entry instead of hiding it', () => {
    const call = entry({ actualOnly: true, actualCustomized: true })
    const removed = applyScopedChange([call], ref('2026-11-02', 'actual'), 'all', { kind: 'delete' }, () => 'new')
    expect(removed.entries).toEqual([])
    const series = entry({ actualOnly: true, repeat: 'weekly' })
    const one = applyScopedChange([series], ref('2026-11-09', 'actual'), 'one', { kind: 'delete' }, () => 'new')
    expect(occurrenceOn(one.entries[0], '2026-11-09')).toBeNull()
    expect(occurrenceOn(one.entries[0], '2026-11-16')).not.toBeNull()
  })

  it('copies an unplanned actual entry without turning it into a plan block', () => {
    const call = entry({
      actualOnly: true,
      actualCustomized: true,
      title: '',
      actualTitle: 'Anruf',
      actualNote: 'unterwegs',
      actualStart: 11 * 60,
      actualEnd: 12 * 60,
    })
    const copied = copyWeekEntries([call], '2026-11-02', '2026-11-09', () => 'copy')
    expect(copied[0]).toMatchObject({
      actualOnly: true,
      actualTitle: 'Anruf',
      actualNote: 'unterwegs',
      actualStart: 11 * 60,
      actualEnd: 12 * 60,
      planStart: 11 * 60,
      planEnd: 12 * 60,
    })
    const pasted = pastedEntry(call, '2026-11-09', 3, 'pasted')
    expect(pasted).toMatchObject({
      actualOnly: true,
      dayIndex: 3,
      actualTitle: 'Anruf',
      actualNote: 'unterwegs',
      actualStart: 11 * 60,
      planStart: 11 * 60,
      repeat: 'none',
    })
  })
})
