import type { Metadata } from 'next'

/** Dominio público canónico. Se puede sobrescribir con NEXT_PUBLIC_SITE_URL (NEXT_PUBLIC_APP_URL vale localhost en desarrollo). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://realsimexperience.com').replace(/\/$/, '')
export const SITE_NAME = 'RSX'
export const DEFAULT_OG_IMAGE = '/hero/hero-1.jpg'

type PageMetaInput = {
  title: string
  description: string
  /** Ruta absoluta dentro del sitio, p. ej. "/ligas". Genera el canonical y og:url. */
  path: string
  image?: string | null
  noindex?: boolean
}

/** Metadata completa (title, description, canonical, Open Graph y Twitter) para una página pública. */
export function pageMetadata({ title, description, path, image, noindex }: PageMetaInput): Metadata {
  const images = [{ url: image || DEFAULT_OG_IMAGE }]
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url: path, images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  }
}

/** Recorta un texto libre (descripciones de ligas/equipos) a un largo razonable para meta description. */
export function toDescription(text: string | null | undefined, fallback: string, max = 160): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}
