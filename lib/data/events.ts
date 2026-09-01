/**
 * lib/data/events.ts
 *
 * League-event and league-car data-fetching functions extracted from lib/platform-data.ts.
 */

import { cache } from 'react'
import { leagueEvents as mockLeagueEvents } from '@/data/mock'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { formatFirestoreValue } from '@/lib/firestore-utils'
import type { LeagueCar, LeagueEvent, LeagueResult } from '@/types'
import { getCircuits, getLeagues } from './leagues'

export const getLeagueEvents = cache(async (leagueId?: string): Promise<LeagueEvent[]> => {
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        let query = db.collection('league_events')
        let snapshot: any
        if (leagueId) {
          snapshot = await query.where('league_id', '==', leagueId).get()
        } else {
          snapshot = await query.get()
        }
        if (snapshot.empty) return []

        const circuits = await getCircuits()
        const circuitsById = new Map(circuits.map((circuit: any) => [circuit.id, circuit]))

        const events = snapshot.docs.map((doc: any) => {
          const data = doc.data()
          const linkedCircuit = data.circuit_id || data.circuitId ? circuitsById.get((data.circuit_id || data.circuitId) as string) : null
          return {
            id: doc.id,
            leagueId: data.league_id || data.leagueId || '',
            circuitId: data.circuit_id || data.circuitId || null,
            title: data.title || null,
            circuitName: linkedCircuit?.name || data.circuit_name || data.circuitName || '',
            circuitImageUrl: linkedCircuit?.imageUrl || data.circuit_image_url || data.circuitImageUrl || null,
            serverLink: data.server_link || data.serverLink || null,
            hasQualy: data.has_qualy ?? data.hasQualy ?? true,
            qualyStartsAt: formatFirestoreValue(data.qualy_starts_at || data.qualyStartsAt) || null,
            qualyEndsAt: formatFirestoreValue(data.qualy_ends_at || data.qualyEndsAt) || null,
            startsAt: formatFirestoreValue(data.starts_at || data.startsAt) || '',
            endsAt: formatFirestoreValue(data.ends_at || data.endsAt) || '',
            status: data.status || 'scheduled',
            eventType: data.event_type || data.eventType || undefined,
            countryCode: data.country_code || data.countryCode || null,
          }
        })
        return events.sort((a: any, b: any) => (a.startsAt || '').localeCompare(b.startsAt || ''))
      } catch (error) {
        console.error('Failed to get league events from Firestore:', error)
        return []
      }
    }
  }

  const leagues = await getLeagues()
  if (leagues.length === 0) return []

  let events = mockLeagueEvents
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const override = cookieStore.get('mock_league_events')?.value
    if (override) events = JSON.parse(override)
  } catch (e) {}
  return leagueId ? events.filter((event) => event.leagueId === leagueId) : events
})

export const getLeagueCars = cache(async (leagueId: string): Promise<LeagueCar[]> => {
  if (!hasFirebase) return []
  const db = getFirestoreDb()
  if (!db) return []

  try {
    const snapshot = await db
      .collection('league_cars')
      .where('league_id', '==', leagueId)
      .where('is_active', '==', true)
      .get()

    if (snapshot.empty) return []

    const cars = snapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        id: doc.id,
        leagueId: data.league_id || '',
        label: data.label || '',
        model: data.model || '',
        sortOrder: data.sort_order ? Number(data.sort_order) : 0,
        isActive: data.is_active !== false,
      }
    })
    return cars.sort((a: any, b: any) => a.sortOrder - b.sortOrder)
  } catch (error) {
    console.error('Failed to get league cars from Firestore:', error)
    return []
  }
})

export const getLeagueResults = cache(async (leagueId: string): Promise<LeagueResult[]> => {
  if (!hasFirebase) return []
  const db = getFirestoreDb()
  if (!db) return []

  try {
    const snapshot = await db
      .collection('league_results')
      .where('league_id', '==', leagueId)
      .get()

    if (snapshot.empty) return []

    const results = snapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        id: doc.id,
        leagueId: data.league_id || '',
        eventId: data.event_id || '',
        userId: data.user_id || '',
        position: data.position ? Number(data.position) : 0,
        points: data.points != null ? Number(data.points) : null,
        createdAt: formatFirestoreValue(data.created_at) || '',
      }
    })
    return results.sort((a: any, b: any) => a.position - b.position)
  } catch (error) {
    console.error('Failed to get league results from Firestore:', error)
    return []
  }
})
