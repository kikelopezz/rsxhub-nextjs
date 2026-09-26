import { getLocale } from '@/lib/i18n/get-locale'
import { pageMetadata } from '@/lib/seo'

// La página es un componente de cliente y no puede exportar metadata, por eso vive en este layout.
export async function generateMetadata() {
  const en = (await getLocale()) === 'en'
  return pageMetadata({
    title: en ? 'Live timing' : 'Live timing en directo',
    description: en
      ? 'Live timing for RSX races: positions, lap times, stints and results in real time.'
      : 'Live timing de las carreras de RSX: posiciones, tiempos por vuelta, stints y resultados en tiempo real.',
    path: '/live-timing',
  })
}

export default function LiveTimingLayout({ children }: { children: React.ReactNode }) {
  return children
}
