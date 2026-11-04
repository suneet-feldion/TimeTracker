import { useStore } from '../state/store'
import de from '../locales/de.json'
import en from '../locales/en.json'
import type { Language } from './types'

export type MessageKey = keyof typeof de

const dictionaries: Record<Language, Record<MessageKey, string>> = { de, en }

export function useI18n() {
  const language = useStore((state) => state.settings.language)
  const setLanguage = useStore((state) => state.setLanguage)
  const t = (key: MessageKey) => dictionaries[language][key] ?? dictionaries.en[key] ?? key
  return { t, language, setLanguage }
}
