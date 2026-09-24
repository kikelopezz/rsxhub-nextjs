/**
 * lib/data/events.ts
 *
 * League-event and league-car data-fetching functions extracted from lib/platform-data.ts.
 */

import { cache } from 'react'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import type { LeagueCar, LeagueEvent, LeagueResult } from '@/types'
import { getCircuits } from './leagues'

export const getLeagueEvents = cache(async (leagueId?: string): Promise<LeagueEvent[]> => {
  return fetchWithTTLCache(`league_events_${leagueId || 'all'}`, async () => {
    try {
      const [events, classLimits, circuits] = await Promise.all([
        db.leagueEvent.findMany({
          where: leagueId ? { leagueId } : undefined,
          orderBy: { startsAt: 'asc' },
        }),
        db.leagueClassLimit.findMany({ where: { eventId: { not: null } } }),
        getCircuits(),
      ])

      const circuitsById = new Map(circuits.map((circuit) => [circuit.id, circuit]))
      const limitsByEvent = new Map<string, Record<string, number>>()
      for (const limit of classLimits) {
        if (!limit.eventId) continue
        const bucket = limitsByEvent.get(limit.eventId) || {}
        bucket[limit.classTag] = limit.maxCars
        limitsByEvent.set(limit.eventId, bucket)
      }

      return events.map((data): LeagueEvent => {
        const linkedCircuit = data.circuitId ? circuitsById.get(data.circuitId) : null
        return {
          id: data.id,
          leagueId: data.leagueId,
          circuitId: data.circuitId,
          title: data.title ?? '',
          circuitName: linkedCircuit?.name || data.circuitName,
          circuitImageUrl: linkedCircuit?.imageUrl || data.circuitImageUrl,
          serverLink: data.serverLink,
          hasQualy: data.hasQualy,
          qualyStartsAt: data.qualyStartsAt?.toISOString() ?? null,
          qualyEndsAt: data.qualyEndsAt?.toISOString() ?? null,
          startsAt: data.startsAt.toISOString(),
          endsAt: data.endsAt.toISOString(),
          status: data.status,
          eventType: data.eventType,
          countryCode: data.countryCode,
          color: data.color,
          maxDrivers: data.maxDrivers,
          classLimits: limitsByEvent.get(data.id) || null,
          qualyCompleted: data.qualyCompleted,
          completedAt: data.completedAt?.toISOString() ?? null,
          skinsDeadline: data.skinsDeadline?.toISOString() ?? null,
          entriesDeadline: data.entriesDeadline?.toISOString() ?? null,
        }
      })
    } catch (error) {
      console.error('Failed to get league events:', error)
      return []
    }
  }, 30)
})

export const getLeagueCars = cache(async (leagueId: string): Promise<LeagueCar[]> => {
  try {
    const cars = await db.leagueCar.findMany({
      where: { leagueId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return cars.map((data) => ({
      id: data.id,
      leagueId: data.leagueId,
      label: data.label,
      model: data.model,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    }))
  } catch (error) {
    console.error('Failed to get league cars:', error)
    return []
  }
})

export const getLeagueResults = cache(async (leagueId: string): Promise<LeagueResult[]> => {
  try {
    const results = await db.leagueResult.findMany({
      where: { leagueId },
      orderBy: { position: 'asc' },
    })
    return results.map((data) => ({
      id: data.id,
      leagueId: data.leagueId,
      eventId: data.eventId,
      userId: data.userId,
      position: data.position ?? 0,
      points: data.points,
      createdAt: data.createdAt.toISOString(),
    }))
  } catch (error) {
    console.error('Failed to get league results:', error)
    return []
  }
})
