import './globals.css'
import type { Metadata } from 'next'
import { Roboto, Barlow_Condensed, JetBrains_Mono, Anton } from 'next/font/google'
import { AppShell } from '@/components/app-shell'
import { TopLoadingBar } from '@/components/top-loading-bar'

import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { LocaleProvider } from '@/lib/i18n/locale-provider'

const roboto = Roboto({
  subsets: ['latin'],
  // Weight 300 isn't used anywhere in the app (no font-light utility, no inline
  // font-weight:300) — one less font file for the browser to download on every page.
  weight: ['400', '500', '700', '900'],
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

const anton = Anton({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-anton',
})

// Emoji favicon: an inline SVG that just draws the character, so there's no separate
// image asset to keep in sync with the tab icon.
const emojiFavicon = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏁</text></svg>'
)}`

export const metadata: Metadata = {
  title: 'RSX',
  description: 'League platform for Assetto Corsa and Le Mans Ultimate',
  icons: {
    icon: emojiFavicon,
    shortcut: emojiFavicon,
  },
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const dictionary = getDictionary(locale)

  return (
    <html lang={locale}>
      <body className={`${roboto.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} ${anton.variable} font-body`}>
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <TopLoadingBar />
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  )
}
