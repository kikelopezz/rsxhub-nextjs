import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { SITE_URL } from '@/lib/seo'

// Se genera en cada petición (con caché de la CDN): depende de la base de datos, que no existe durante el build.
export const dynamic = 'force-dynamic'

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' }> = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: '/ligas', priority: 0.9, changeFrequency: 'daily' },
  { path: '/calendario', priority: 0.8, changeFrequency: 'daily' },
  { path: '/equipos', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/noticias', priority: 0.7, changeFrequency: 'daily' },
  { path: '/market', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/live-timing', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacidad', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terminos', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/cookies', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/aviso-legal', priority: 0.2, changeFrequency: 'yearly' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  try {
    const [leagues, teams] = await Promise.all([
      db.league.findMany({ where: { status: { not: 'draft' } }, select: { slug: true, createdAt: true } }),
      db.team.findMany({ where: { status: 'approved' }, select: { id: true, createdAt: true } }),
    ])
    for (const l of leagues) {
      entries.push({ url: `${SITE_URL}/ligas/${l.slug}`, lastModified: l.createdAt, changeFrequency: 'daily', priority: 0.8 })
    }
    for (const t of teams) {
      entries.push({ url: `${SITE_URL}/equipos/${t.id}`, lastModified: t.createdAt, changeFrequency: 'weekly', priority: 0.6 })
    }
  } catch (error) {
    // Si la base de datos no responde, el sitemap sigue sirviendo las páginas estáticas.
    console.error('[sitemap] no se pudieron cargar ligas/equipos:', error)
  }

  return entries
}
