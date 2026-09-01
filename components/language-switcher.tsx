'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALE_COOKIE, locales, type Locale } from '@/lib/i18n/locales'
import { useLocale } from '@/lib/i18n/locale-provider'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function switchTo(next: Locale) {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex items-center border border-white/10 bg-black/60 text-[11px] font-bold uppercase tracking-wider">
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchTo(code)}
          disabled={isPending}
          aria-pressed={locale === code}
          className={`px-2.5 py-2 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
            locale === code ? 'bg-[#1274de] text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
