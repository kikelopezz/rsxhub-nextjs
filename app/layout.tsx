import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Roboto, Barlow_Condensed, JetBrains_Mono, Anton } from 'next/font/google'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { TopLoadingBar } from '@/components/top-loading-bar'

import { headers } from 'next/headers'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { LocaleProvider } from '@/lib/i18n/locale-provider'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '@/lib/seo'

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

const SITE_TITLE = 'RSX — Real Sim Experience | Ligas y campeonatos de simracing'
const SITE_DESCRIPTION =
  'RSX es la plataforma de competición de simracing en español: ligas y campeonatos de Assetto Corsa y Le Mans Ultimate, equipos, calendario, resultados y live timing.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s | RSX' },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'simracing', 'sim racing', 'ligas simracing', 'campeonatos simracing', 'Assetto Corsa', 'Le Mans Ultimate',
    'competición simracing', 'liga online', 'equipos simracing', 'Real Sim Experience', 'RSX',
  ],
  authors: [{ name: 'Real Sim Experience', url: SITE_URL }],
  creator: 'Real Sim Experience',
  publisher: 'Real Sim Experience',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'es_ES',
    alternateLocale: ['en_US'],
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, alt: 'RSX — Real Sim Experience' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  icons: {
    icon: '/branding/rsx-logo.ico',
    shortcut: '/branding/rsx-logo.ico',
    apple: '/branding/rsx-logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#06080d',
}

// Datos estructurados (schema.org) para que Google entienda qué es el sitio y muestre el nombre y el logo.
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Real Sim Experience',
      alternateName: 'RSX',
      url: SITE_URL,
      logo: `${SITE_URL}/branding/rsx-logo.png`,
      description: SITE_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'RSX',
      alternateName: 'Real Sim Experience',
      description: SITE_DESCRIPTION,
      inLanguage: ['es', 'en'],
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const dictionary = getDictionary(locale)
  // El middleware genera un nonce por petición y lo manda en esta cabecera — hace falta ponerlo a
  // mano aquí porque este <script> no lo genera el propio Next.js (ese sí se marca solo con CSP).
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang={locale}>
      <body className={`${roboto.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} ${anton.variable} font-body`}>
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <TopLoadingBar />
          <Toaster theme="dark" position="top-right" richColors closeButton />
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  )
}
