/**
 * lib/data/registrations.ts
 *
 * Registration, member, event-confirmation, team-points, and driver-fetching functions
 * extracted from lib/platform-data.ts.
 */

import { cache } from 'react'
import { mockRegistrations } from '@/data/mock'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { formatFirestoreValue } from '@/lib/firestore-utils'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { getTeamsDashboard } from '@/lib/team-data'
import type { LeagueMember, LeagueRegistration } from '@/types'
import { getLeagues } from './leagues'

export const getRegistrations = cache(async (leagueId?: string): Promise<LeagueRegistration[]> => {
  return fetchWithTTLCache(`registrations_${leagueId || 'all'}`, async () => {
    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        try {
          let query = db.collection('league_registrations')
          let snapshot
          if (leagueId) {
            snapshot = await query.where('league_id', '==', leagueId).get()
          } else {
            snapshot = await query.get()
          }

        if (snapshot.empty) return []

        const registrations = snapshot.docs.map((doc: any) => {
          const data = doc.data()
          return {
            id: doc.id,
            leagueId: data.league_id || '',
            userId: data.user_id || '',
            teamId: data.team_id || null,
            displayName: data.display_name || '',
            steamId: data.steam_id || '',
            classTag: data.class_tag || null,
            assignedNumber: data.assigned_number != null ? String(data.assigned_number) : null,
            createdAt: formatFirestoreValue(data.created_at) || '',
            status: data.status || 'pending',
          }
        })
        const { teams } = await getTeamsDashboard()

        const steamIdByUserId = new Map<string, string>()
        for (const t of teams) {
          for (const m of t.members || []) {
            if (m.userId && m.steamId) {
              steamIdByUserId.set(m.userId, m.steamId)
            }
          }
        }

        const unmappedUserIds = Array.from(
          new Set(
            registrations
              .map((r: any) => r.userId)
              .filter((uid: string) => uid && !steamIdByUserId.has(uid) && !uid.startsWith('steam_'))
          )
        )

        if (unmappedUserIds.length > 0) {
          try {
            const chunks = []
            for (let i = 0; i < unmappedUserIds.length; i += 10) {
              chunks.push(unmappedUserIds.slice(i, i + 10))
            }
            const [steamSnapsByUserId, steamSnapsByName] = await Promise.all([
              Promise.all(
                chunks.map((chunk: any) =>
                  runWithTimeout(db.collection('steam_accounts').where('user_id', 'in', chunk).get(), 3000).catch(() => ({ docs: [] }))
                )
              ),
              Promise.all(
                chunks.map((chunk: any) =>
                  runWithTimeout(db.collection('steam_accounts').where('__name__', 'in', chunk).get(), 3000).catch(() => ({ docs: [] }))
                )
              ),
            ])

            const allSteamDocs = [
              ...steamSnapsByUserId.flatMap((s: any) => s.docs || []),
              ...steamSnapsByName.flatMap((s: any) => s.docs || []),
            ]

            for (const doc of allSteamDocs) {
              const data = doc.data()
              const uid = data.user_id || doc.id
              const sId = data.steam_id || data.steamId || (uid.startsWith('steam_') ? uid.replace('steam_', '') : (doc.id.startsWith('steam_') ? doc.id.replace('steam_', '') : ''))
              if (uid && sId) steamIdByUserId.set(uid, sId)
              if (doc.id && sId) steamIdByUserId.set(doc.id, sId)
            }
          } catch (err) {
            console.error('Failed to fetch steam accounts for registrations:', err)
          }
        }

        const enrichedRegistrations = registrations.map((r: any) => {
          let sId = r.steamId || steamIdByUserId.get(r.userId) || ''
          if (!sId && r.userId && r.userId.startsWith('steam_')) {
            sId = r.userId.replace('steam_', '')
          }
          return {
            ...r,
            steamId: sId,
          }
        })

        const activeRegistrations = enrichedRegistrations.filter((r: LeagueRegistration) => {
          if (!r.teamId) return true
          const team = teams.find((t) => t.id === r.teamId)
          if (!team) return false
          const isOwnerOrMember =
            (team.ownerUserId && team.ownerUserId === r.userId) ||
            (Array.isArray(team.members) && team.members.some((m: any) => m.userId === r.userId)) ||
            r.userId === team.id ||
            !r.userId
          if (!isOwnerOrMember) return false
          const car = (team.cars || []).find((c: any) => {
            const sameClass = !r.classTag || String(c.category || '').toUpperCase() === String(r.classTag || '').toUpperCase()
            const sameDorsal = !r.assignedNumber || String(c.dorsal || '') === String(r.assignedNumber || '') || Number(c.dorsal) === Number(r.assignedNumber)
            const carLeagueId = c.leagueId || c.league_id
            const sameLeague = !carLeagueId || carLeagueId === r.leagueId
            const drivers = Array.isArray(c.driverUserIds)
              ? c.driverUserIds
              : Array.isArray(c.driver_user_ids)
              ? c.driver_user_ids
              : []
            return sameClass && sameDorsal && sameLeague && (drivers.length === 0 || drivers.includes(r.userId) || r.userId === team.ownerUserId || r.userId === team.id)
          })
          return Boolean(car) || (team.cars || []).length === 0
        })

        return activeRegistrations.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
      } catch (error) {
        console.error('Failed to get registrations from Firestore:', error)
        return []
      }
    }
  }

  let list = mockRegistrations
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const override = cookieStore.get('mock_registrations')?.value
    if (override) list = JSON.parse(override)
  } catch (e) {}

  const leagues = await getLeagues()
  if (leagues.length === 0) return []
  const filteredList = leagueId ? list.filter((item) => item.leagueId === leagueId) : list

  try {
    const { teams } = await getTeamsDashboard()
    return filteredList.filter((r: any) => {
      if (!r.teamId) return true
      const team = teams.find((t) => t.id === r.teamId)
      if (!team) return false
      const isOwnerOrMember =
        (team.ownerUserId && team.ownerUserId === r.userId) ||
        (Array.isArray(team.members) && team.members.some((m: any) => m.userId === r.userId)) ||
        r.userId === team.id ||
        !r.userId
      if (!isOwnerOrMember) return false
      const car = (team.cars || []).find((c: any) => {
        const sameClass = !r.classTag || String(c.category || '').toUpperCase() === String(r.classTag || '').toUpperCase()
        const sameDorsal = !r.assignedNumber || String(c.dorsal || '') === String(r.assignedNumber || '') || Number(c.dorsal) === Number(r.assignedNumber)
        const carLeagueId = c.leagueId || c.league_id
        const sameLeague = !carLeagueId || carLeagueId === r.leagueId
        const drivers = Array.isArray(c.driverUserIds)
          ? c.driverUserIds
          : Array.isArray(c.driver_user_ids)
          ? c.driver_user_ids
          : []
        return sameClass && sameDorsal && sameLeague && (drivers.length === 0 || drivers.includes(r.userId) || r.userId === team.ownerUserId || r.userId === team.id)
      })
      return Boolean(car) || (team.cars || []).length === 0
    })
  } catch {
    return filteredList
  }
  }, 60)
})

export const getLeagueMembers = cache(async (leagueId: string): Promise<LeagueMember[]> => {
  if (!hasFirebase) return []
  const db = getFirestoreDb()
  if (!db) return []

  try {
    const snapshot = await db
      .collection('league_members')
      .where('league_id', '==', leagueId)
      .get()

    if (snapshot.empty) return []

    const members = snapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        id: doc.id,
        leagueId: data.league_id || '',
        userId: data.user_id || '',
        role: (data.role || 'driver') as LeagueMember['role'],
        createdAt: formatFirestoreValue(data.created_at) || '',
      }
    })

    const userIds = Array.from(new Set(members.map((item: any) => item.userId)))
    if (userIds.length === 0) return []

    const profilesSnapshot = await db.collection('profiles').where('user_id', 'in', userIds).get()
    const steamSnapshot = await db.collection('steam_accounts').where('user_id', 'in', userIds).get()

    const profileByUserId = new Map<string, string>(
      profilesSnapshot.docs.map((doc: any) => {
        const data = doc.data()
        return [data.user_id, data.display_name || '']
      })
    )

    const steamByUserId = new Map<string, { steamId: string; steamDisplayName: string }>(
      steamSnapshot.docs.map((doc: any) => {
        const data = doc.data()
        return [data.user_id, { steamId: data.steam_id || '', steamDisplayName: data.steam_display_name || '' }]
      })
    )

    return members.map((item: any) => {
      const steam = steamByUserId.get(item.userId)
      return {
        id: item.id, leagueId: item.leagueId, userId: item.userId, role: item.role,
        createdAt: item.createdAt, steamId: steam?.steamId, steamDisplayName: steam?.steamDisplayName,
        displayName: profileByUserId.get(item.userId) || '',
      }
    }).sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt))
  } catch (error) {
    console.error('Failed to get league members from Firestore:', error)
    return []
  }
})

export const getEventConfirmations = cache(async (leagueId: string): Promise<any[]> => {
  return fetchWithTTLCache(`event_confirmations_${leagueId}`, async () => {
    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        try {
          const snapshot = await db
            .collection('league_event_confirmations')
            .where('league_id', '==', leagueId)
            .get()
        if (snapshot.empty) return []
        const rawConfirmations = snapshot.docs.map((doc: any) => {
          const data = doc.data()
          return {
            id: doc.id, eventId: data.event_id || '', leagueId: data.league_id || '',
            teamId: data.team_id || '', classTag: data.class_tag || '',
            carNumber: Number(data.car_number || 0), carModel: data.car_model || '',
            driverUserIds: Array.isArray(data.driver_user_ids) ? data.driver_user_ids : [],
            status: data.status || 'confirmed',
            confirmedAt: formatFirestoreValue(data.confirmed_at) || '',
          }
        })

        const { teams } = await getTeamsDashboard()
        const leagueRegs = await getRegistrations(leagueId)

        return rawConfirmations.filter((c: any) => {
          const isReg = leagueRegs.some(
            (r) => r.status === 'approved' && ((c.teamId && r.teamId === c.teamId) || (c.userId && r.userId === c.userId))
          )
          if (!isReg && leagueRegs.length > 0) return false

          const team = teams.find((t) => t.id === c.teamId)
          if (!team) return false
          const car = (team.cars || []).find((carObj: any) => {
            const sameClass = String(carObj.category || '').toUpperCase() === String(c.classTag || '').toUpperCase()
            const sameDorsal = String(carObj.dorsal ?? '').trim() === String(c.carNumber ?? '').trim() || Number(carObj.dorsal) === Number(c.carNumber)
            const drivers = Array.isArray(carObj.driverUserIds)
              ? carObj.driverUserIds.filter(Boolean)
              : Array.isArray(carObj.driver_user_ids)
              ? carObj.driver_user_ids.filter(Boolean)
              : []
            const byLeague = carObj.driverUserIdsByLeague || carObj.driver_user_ids_by_league || {}
            const leagueDrivers = (byLeague[leagueId] || []).filter(Boolean)
            const hasDrivers = drivers.length > 0 || leagueDrivers.length > 0
            return sameClass && sameDorsal && hasDrivers
          })
          return Boolean(car)
        })
      } catch (error) {
        console.error('Failed to get event confirmations from Firestore:', error)
        return []
      }
    }
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const raw = cookieStore.get('mock_event_confirmations')?.value
    if (raw) {
      const list = JSON.parse(raw).filter((c: any) => c.leagueId === leagueId)
      const { teams } = await getTeamsDashboard()
      const leagueRegs = await getRegistrations(leagueId)

      return list.filter((c: any) => {
        const isReg = leagueRegs.some(
          (r) => r.status === 'approved' && ((c.teamId && r.teamId === c.teamId) || (c.userId && r.userId === c.userId))
        )
        if (!isReg && leagueRegs.length > 0) return false

        const team = teams.find((t) => t.id === c.teamId)
        if (!team) return false
        const car = (team.cars || []).find((carObj: any) => {
          const sameClass = String(carObj.category || '').toUpperCase() === String(c.classTag || '').toUpperCase()
          const sameDorsal = String(carObj.dorsal ?? '').trim() === String(c.carNumber ?? '').trim() || Number(carObj.dorsal) === Number(c.carNumber)
          const drivers = Array.isArray(carObj.driverUserIds)
            ? carObj.driverUserIds.filter(Boolean)
            : Array.isArray(carObj.driver_user_ids)
            ? carObj.driver_user_ids.filter(Boolean)
            : []
          const byLeague = carObj.driverUserIdsByLeague || carObj.driver_user_ids_by_league || {}
          const leagueDrivers = (byLeague[leagueId] || []).filter(Boolean)
          const hasDrivers = drivers.length > 0 || leagueDrivers.length > 0
          return sameClass && sameDorsal && hasDrivers
        })
        return Boolean(car)
      })
    }
  } catch (e) {
    console.error('Failed to get mock event confirmations:', e)
  }
  return []
  }, 60)
})

export type PlatformDriverUser = {
  userId: string
  displayName: string
  avatarUrl: string | null
  steamId: string
  role: 'user' | 'team_manager' | 'steward' | 'platform_admin' | 'super_admin'
  teamId: string | null
  teamName: string | null
  teamLogo: string | null
  isTeamOwner: boolean
  createdAt: string
}

export const getAllRegisteredDrivers = cache(async (): Promise<PlatformDriverUser[]> => {
  return fetchWithTTLCache('platform_drivers', async () => {
    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        try {
          const [profilesSnap, rolesSnap, teamsSnap, membersSnap, steamSnap] = await Promise.all([
            runWithTimeout(db.collection('profiles').get(), 3000),
            runWithTimeout(db.collection('platform_roles').get(), 3000),
            runWithTimeout(db.collection('teams').get(), 3000),
            runWithTimeout(db.collection('team_members').get(), 3000),
            runWithTimeout(db.collection('steam_accounts').get(), 3000),
          ])

          const steamByUserId = new Map<string, string>()
          steamSnap.docs.forEach((doc: any) => {
            const data = doc.data()
            const uid = data.user_id || doc.id
            if (data.steam_id) steamByUserId.set(uid, data.steam_id)
          })

          const rolesMap = new Map<string, string>()
          rolesSnap.docs.forEach((doc: any) => {
            const d = doc.data()
            if (d.user_id && d.role) rolesMap.set(d.user_id, d.role)
          })

          const ownerUserIds = new Set<string>()
          membersSnap.docs.forEach((doc: any) => {
            const d = doc.data()
            if ((d.role === 'owner' || d.role === 'manager') && d.user_id) ownerUserIds.add(d.user_id)
          })

          const teamsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>()
          teamsSnap.docs.forEach((doc: any) => {
            const d = doc.data()
            // A pending/rejected team isn't real yet — don't surface its name/logo on the pilots roster.
            if ((d.status || 'approved') !== 'approved') return
            teamsMap.set(doc.id, { id: doc.id, name: d.name || '', logoUrl: d.logo_url || null })
          })

          const userTeamsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>()
          membersSnap.docs.forEach((doc: any) => {
            const d = doc.data()
            if (d.user_id && d.team_id && teamsMap.has(d.team_id)) {
              userTeamsMap.set(d.user_id, teamsMap.get(d.team_id)!)
            }
          })

          const users: PlatformDriverUser[] = profilesSnap.docs.map((doc: any) => {
            const d = doc.data()
            const userId = doc.id
            const team = userTeamsMap.get(userId)
            const isTeamOwner = ownerUserIds.has(userId)
            let role = (rolesMap.get(userId) || 'user') as PlatformDriverUser['role']
            if (role === 'user' && isTeamOwner) role = 'team_manager'

            const rawSteamId = d.steam_id || d.steamId || steamByUserId.get(userId) || (userId.startsWith('steam_') ? userId.replace('steam_', '') : '')
            const steamId = /^\d+$/.test(rawSteamId) ? rawSteamId : (steamByUserId.get(userId) || '')

            return {
              userId, displayName: d.display_name || d.displayName || 'Driver',
              avatarUrl: d.avatar_url || d.avatarUrl || null, steamId, role,
              teamId: team?.id || null, teamName: team?.name || null, teamLogo: team?.logoUrl || null,
              isTeamOwner, createdAt: formatFirestoreValue(d.created_at) || new Date().toISOString(),
            }
          })

          return users.sort((a, b) => a.displayName.localeCompare(b.displayName))
        } catch (err) {
          console.error('Failed to get registered drivers from Firestore:', err)
        }
      }
    }

    try {
      const { getSession } = await import('@/lib/session')
      const { getPlatformRole } = await import('@/lib/auth')
      const session = await getSession()
      const drivers: PlatformDriverUser[] = []
      const { teams } = await getTeamsDashboard()

      if (session) {
        try {
          const userId = session.userId || `steam_${session.steamId}`
          const userTeam = teams.find((t: any) => (t.status || 'approved') === 'approved' && Array.isArray(t.members) && t.members.some((m: any) => m.userId === userId))
          const isTeamOwner = Boolean(userTeam && userTeam.ownerUserId === userId)
          const role = (await getPlatformRole(userId)) || 'user'
          drivers.push({
            userId, displayName: session.steamDisplayName || 'Driver', avatarUrl: session.avatarUrl || null,
            steamId: session.steamId || '', role: (isTeamOwner && role === 'user' ? 'team_manager' : role) as PlatformDriverUser['role'],
            teamId: userTeam?.id || null, teamName: userTeam?.name || null, teamLogo: userTeam?.logoUrl || null,
            isTeamOwner, createdAt: new Date().toISOString(),
          })
        } catch {}
      }
      return drivers
    } catch {
      return []
    }
  }, 60)
})

export const getTeamPointsOverrides = cache(async (leagueId: string): Promise<Record<string, number>> => {
  const pointsMap: Record<string, number> = {}

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const snap = await runWithTimeout(
          db.collection('league_team_points').where('league_id', '==', leagueId).get(),
          3000
        )
        snap.docs.forEach((doc: any) => {
          const d = doc.data()
          if (d.class_tag && d.team_id && typeof d.points === 'number') {
            pointsMap[`${String(d.class_tag).toUpperCase()}_${d.team_id}`] = d.points
          }
        })
      } catch (err) {
        console.error('Failed to get team points from Firestore:', err)
      }
    }
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const cookieKey = `mock_team_points_${leagueId}`
    const existingStr = cookieStore.get(cookieKey)?.value
    if (existingStr) {
      const parsed = JSON.parse(existingStr)
      Object.assign(pointsMap, parsed)
    }
  } catch (e) {}

  return pointsMap
})
