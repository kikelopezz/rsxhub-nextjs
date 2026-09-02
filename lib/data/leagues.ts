/**
 * lib/data/leagues.ts
 *
 * League-related data-fetching functions extracted from lib/platform-data.ts.
 * All existing imports from '@/lib/platform-data' continue to work via the barrel re-export.
 */

import { cache } from 'react'
import { DEFAULT_CIRCUITS } from '@/lib/circuit-catalog'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import type { Circuit, League } from '@/types'

export const getLeagues = cache(async (): Promise<League[]> => {
  return fetchWithTTLCache('platform_leagues', async () => {
    try {
      const [leagues, classLimits] = await Promise.all([
        db.league.findMany({ orderBy: { startsAt: 'asc' } }),
        db.leagueClassLimit.findMany({ where: { eventId: null } }),
      ])

      const limitsByLeague = new Map<string, Record<string, number>>()
      for (const limit of classLimits) {
        const bucket = limitsByLeague.get(limit.leagueId) || {}
        bucket[limit.classTag] = limit.maxCars
        limitsByLeague.set(limit.leagueId, bucket)
      }

      return leagues.map((data): League => ({
        id: data.id,
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription,
        simulator: data.simulator,
        format: data.format,
        classTags: data.classTags,
        status: data.status,
        bannerUrl: data.bannerUrl ?? '',
        logoUrl: data.logoUrl,
        startsAt: (data.startsAt ?? new Date()).toISOString(),
        endsAt: (data.endsAt ?? new Date()).toISOString(),
        featured: data.isFeatured,
        registrationOpen: data.status === 'open',
        registrationMode: data.registrationMode,
        accentColor: data.accentColor,
        slogan: data.slogan,
        discordUrl: data.discordUrl,
        youtubeUrl: data.youtubeUrl,
        rulebookUrl: data.rulebookUrl,
        classLimits: limitsByLeague.get(data.id) || null,
      }))
    } catch (error) {
      console.error('Failed to get leagues:', error)
      return []
    }
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
  try {
    const circuits = await db.circuit.findMany({ orderBy: { name: 'asc' } })
    if (circuits.length === 0) return DEFAULT_CIRCUITS
    return circuits.map((data) => ({
      id: data.id,
      name: data.name,
      slug: data.slug,
      imageUrl: data.imageUrl,
      isSystem: data.isSystem,
    }))
  } catch (error) {
    console.error('Failed to get circuits:', error)
    return DEFAULT_CIRCUITS
  }
})
