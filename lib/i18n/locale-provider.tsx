'use client'

import { createContext, useContext } from 'react'
import type { Locale } from './locales'
import type { Dictionary } from './dictionaries/es'

type LocaleContextValue = {
  locale: Locale
  dictionary: Dictionary
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale
  dictionary: Dictionary
  children: React.ReactNode
}) {
  return <LocaleContext.Provider value={{ locale, dictionary }}>{children}</LocaleContext.Provider>
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale/useDictionary must be used within a LocaleProvider')
  return ctx
}

export function useLocale(): Locale {
  return useLocaleContext().locale
}

export function useDictionary(): Dictionary {
  return useLocaleContext().dictionary
}
