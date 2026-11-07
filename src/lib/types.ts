export const COLOR_IDS = ['black', 'blue', 'green', 'red', 'yellow', 'gold', 'violet', 'pink', 'gray', 'tan'] as const

export type ColorId = (typeof COLOR_IDS)[number]

export type PaletteColor = {
  id: ColorId
  solid: string
  tint: string
}

export const PALETTE: PaletteColor[] = [
  { id: 'black', solid: '#2c313c', tint: '#e6e8ed' },
  { id: 'blue', solid: '#2f6fe0', tint: '#e7eefc' },
  { id: 'green', solid: '#1f9a52', tint: '#e5f6ec' },
  { id: 'red', solid: '#e0454a', tint: '#fdecee' },
  { id: 'yellow', solid: '#e4d48a', tint: '#f8f3d8' },
  { id: 'gold', solid: '#d4a24a', tint: '#f8efda' },
  { id: 'violet', solid: '#7a4ed4', tint: '#f1ebfc' },
  { id: 'pink', solid: '#e2558f', tint: '#fdecf3' },
  { id: 'gray', solid: '#8e97a6', tint: '#f1f3f6' },
  { id: 'tan', solid: '#c4a484', tint: '#f7f1e8' },
]

const LEGACY_COLORS: Record<string, ColorId> = {
  slate: 'gray',
  orange: 'gold',
  amber: 'gold',
  teal: 'green',
  rose: 'pink',
  lime: 'yellow',
  cyan: 'blue',
  indigo: 'blue',
  brown: 'tan',
  olive: 'green',
  plum: 'violet',
}

export function normalizeColor(value: unknown): ColorId | null {
  if (typeof value !== 'string') return null
  if ((COLOR_IDS as readonly string[]).includes(value)) return value as ColorId
  return LEGACY_COLORS[value] ?? null
}

export function colorById(id: ColorId): PaletteColor {
  return PALETTE.find((color) => color.id === id) ?? PALETTE.find((color) => color.id === 'blue') ?? PALETTE[0]
}

export type Language = 'de' | 'en'

export type SubTodo = {
  id: string
  title: string
  order: number
}

export type Todo = {
  id: string
  title: string
  color: ColorId
  collapsed: boolean
  order: number
  children: SubTodo[]
}

export type EntryLink = {
  kind: 'todo' | 'subtodo'
  id: string
}

export const REPEAT_IDS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'] as const

export type Repeat = (typeof REPEAT_IDS)[number]

export type Scope = 'one' | 'following' | 'all'

/** Deviation of a single occurrence. `date` is the original series date. */
export type OccurrenceException = {
  date: string
  deleted?: boolean
  movedTo?: string
  planStart?: number
  planEnd?: number
  actualStart?: number
  actualEnd?: number
  actualCustomized?: boolean
  actualRemoved?: boolean
  title?: string
  color?: ColorId
  actualTitle?: string
  actualColor?: ColorId
  planNote?: string
  actualNote?: string
}

export type Entry = {
  id: string
  weekStart: string
  dayIndex: number
  link: EntryLink | null
  title: string
  color: ColorId
  planStart: number
  planEnd: number
  actualStart: number
  actualEnd: number
  actualCustomized: boolean
  repeat: Repeat
  /** Exclusive end date. Occurrences on or after this date are not shown. */
  repeatUntil: string | null
  planNote: string
  actualNote: string
  actualRemoved: boolean
  /** Shown only in the actual lane. Plan times mirror the actual times and are not drawn. */
  actualOnly: boolean
  /** Set when the actual lane has its own title. Null follows the plan title. */
  actualTitle: string | null
  actualColor: ColorId | null
  exceptions: OccurrenceException[]
}

export type Settings = {
  language: Language
  trackingMode: boolean
  weekStart: string
}

export type AppState = {
  version: 1
  todos: Todo[]
  entries: Entry[]
  settings: Settings
}

export type Lane = 'plan' | 'actual'
