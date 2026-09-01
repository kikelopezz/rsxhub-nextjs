import type { Locale } from './locales'
import type { Dictionary } from './dictionaries/es'
import es from './dictionaries/es'
import en from './dictionaries/en'

const dictionaries: Record<Locale, Dictionary> = { es, en }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}
