'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALE_COOKIE, locales, type Locale } from '@/lib/i18n/locales'
import { useLocale } from '@/lib/i18n/locale-provider'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const activeIndex = locales.indexOf(locale)

  function switchTo(next: Locale) {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="relative flex items-center border border-white/10 bg-black/60 text-[11px] font-bold uppercase tracking-wider overflow-hidden transition-all duration-200 hover:border-[#4ea1ff] hover:shadow-[0_0_16px_rgba(78,161,255,0.6)]">
      <span
        className="absolute inset-y-0 left-0 bg-[#1274de] shadow-[0_0_14px_rgba(78,161,255,0.8)] transition-transform duration-300 ease-out"
        style={{ width: `${100 / locales.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden="true"
      />
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchTo(code)}
          disabled={isPending}
          aria-pressed={locale === code}
          className={`relative z-10 px-2.5 py-2 transition-colors duration-200 cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
            locale === code ? 'text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
