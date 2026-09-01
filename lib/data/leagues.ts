/**
 * lib/data/leagues.ts
 *
 * League-related data-fetching functions extracted from lib/platform-data.ts.
 * All existing imports from '@/lib/platform-data' continue to work via the barrel re-export.
 */

import { cache } from 'react'
import { leagues as mockLeagues } from '@/data/mock'
import { DEFAULT_CIRCUITS } from '@/lib/circuit-catalog'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { formatFirestoreValue, parseClassTags } from '@/lib/firestore-utils'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import type { Circuit, League } from '@/types'

export const getLeagues = cache(async (): Promise<League[]> => {
  if (!hasFirebase) {
    // Demo mode (no Firestore configured): league data lives in a per-browser cookie
    // (written by the create/update/delete actions), so it must be read fresh on every
    // request rather than through the shared process-wide TTL cache below — that cache
    // has a single global key and would otherwise leak one visitor's cookie-based state
    // (or lack thereof) to every other visitor hitting the server in the same window.
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existingCookie = cookieStore.get('mock_leagues')?.value
      if (existingCookie) {
        return JSON.parse(existingCookie) as League[]
      }
      return [...mockLeagues] as League[]
    } catch (error) {
      console.error('Failed to read mock leagues cookie:', error)
      return []
    }
  }

  return fetchWithTTLCache('platform_leagues', async () => {
    const db = getFirestoreDb()
    if (db) {
      try {
        const snapshot = await runWithTimeout(db.collection('leagues').get(), 3000)

        const list = snapshot.docs.map((doc: any) => {
          const data = doc.data()
          return {
            id: doc.id,
            title: data.title || '',
            slug: data.slug || '',
            shortDescription: data.short_description || data.shortDescription || '',
            fullDescription: data.full_description || data.fullDescription || '',
            simulator: data.simulator || 'ac',
            format: data.format || 'sprint',
            classTags: parseClassTags(data.class_tags || data.classTags),
            status: data.status || 'open',
            bannerUrl: data.banner_url || data.bannerUrl || null,
            logoUrl: data.logo_url || data.logoUrl || null,
            startsAt: formatFirestoreValue(data.starts_at || data.startsAt) || new Date().toISOString(),
            endsAt: formatFirestoreValue(data.ends_at || data.endsAt) || new Date().toISOString(),
            featured: Boolean(data.is_featured || data.featured),
            registrationOpen: (data.status || 'open') === 'open',
            registrationMode: (data.registration_mode || data.registrationMode || 'individual') as League['registrationMode'],
            accentColor: data.accent_color || data.accentColor || null,
            slogan: data.slogan || null,
            discordUrl: data.discord_url || data.discordUrl || null,
            youtubeUrl: data.youtube_url || data.youtubeUrl || null,
            rulebookUrl: data.rulebook_url || data.rulebookUrl || null,
            classLimits: data.class_limits || data.classLimits || null,
          }
        })
        return list.sort((a: any, b: any) => (a.startsAt || '').localeCompare(b.startsAt || ''))
      } catch (error) {
        console.error('Failed to get leagues from Firestore:', error)
        return []
      }
    }
    return []
  }, 60)
})

export const getLeagueBySlug = cache(async (slug: string): Promise<League | null> => {
  const leagues = await getLeagues()
  if (!slug) return null

  const decoded = decodeURIComponent(slug).trim()
  const normalized = decoded.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

  return (
    leagues.find((league) => {
      if (!league) return false
      if (league.slug === slug || league.id === slug) return true
      if (league.slug === decoded || league.id === decoded) return true

      const leagueSlugNormalized = (league.slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      if (leagueSlugNormalized && leagueSlugNormalized === normalized) return true

      const leagueIdNormalized = (league.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      if (leagueIdNormalized && leagueIdNormalized === normalized) return true

      const leagueTitleNormalized = (league.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      if (leagueTitleNormalized && leagueTitleNormalized === normalized) return true

      return false
    }) ?? null
  )
})

export const getCircuits = cache(async (): Promise<Circuit[]> => {
  if (!hasFirebase) return DEFAULT_CIRCUITS
  const db = getFirestoreDb()
  if (!db) return DEFAULT_CIRCUITS

  try {
    const snapshot = await db.collection('circuits').orderBy('name', 'asc').get()
    if (snapshot.empty) return DEFAULT_CIRCUITS
    return snapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name || '',
        slug: data.slug || '',
        imageUrl: data.image_url || '',
        isSystem: Boolean(data.is_system),
      }
    })
  } catch (error) {
    console.error('Failed to get circuits from Firestore:', error)
    return DEFAULT_CIRCUITS
  }
})
