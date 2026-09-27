import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Zonas privadas o sin valor para buscadores: panel admin, API, alta y edición de perfil.
        disallow: ['/admin', '/api/', '/onboarding', '/perfil/editar'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
