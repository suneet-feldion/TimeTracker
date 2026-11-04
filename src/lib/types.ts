export const COLOR_IDS = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet'] as const

export type ColorId = (typeof COLOR_IDS)[number]

export type PaletteColor = {
  id: ColorId
  solid: string
  tint: string
}

export const PALETTE: PaletteColor[] = [
  { id: 'slate', solid: '#5d6b7a', tint: '#e7ebf0' },
  { id: 'red', solid: '#c4544e', tint: '#f8e6e4' },
  { id: 'orange', solid: '#d4783a', tint: '#f8eadc' },
  { id: 'amber', solid: '#b8860b', tint: '#f8f0d8' },
  { id: 'green', solid: '#2f8f5b', tint: '#e3f3ea' },
  { id: 'teal', solid: '#1f8a84', tint: '#e2f4f3' },
  { id: 'blue', solid: '#3a6fd0', tint: '#e5edfa' },
  { id: 'violet', solid: '#6f56a8', tint: '#eee8f6' },
]

export function colorById(id: ColorId): PaletteColor {
  return PALETTE.find((color) => color.id === id) ?? PALETTE[6]
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
