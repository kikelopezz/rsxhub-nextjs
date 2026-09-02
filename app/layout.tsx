import './globals.css'
import type { Metadata } from 'next'
import { Roboto, Barlow_Condensed, JetBrains_Mono } from 'next/font/google'
import { AppShell } from '@/components/app-shell'

import { Suspense } from 'react'
import { GlobalLoader } from '@/components/global-loader'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { LocaleProvider } from '@/lib/i18n/locale-provider'

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-roboto',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-barlow-condensed',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'SimLeague Platform',
  description: 'League platform for Assetto Corsa and Le Mans Ultimate',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const dictionary = getDictionary(locale)

  return (
    <html lang={locale}>
      <body className={`${roboto.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} font-body`}>
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <AppShell>{children}</AppShell>
          <Suspense fallback={null}>
            <GlobalLoader />
          </Suspense>
        </LocaleProvider>
      </body>
    </html>
  )
}
