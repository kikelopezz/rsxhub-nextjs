import './globals.css'
import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'SimLeague Platform',
  description: 'League platform for Assetto Corsa and Le Mans Ultimate',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const dictionary = getDictionary(locale)

  return (
    <html lang={locale}>
      <body className={`${roboto.variable} font-body`}>
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
