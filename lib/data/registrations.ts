/**
 * lib/data/registrations.ts
 *
 * Registration, member, event-confirmation, team-points, and driver-fetching functions
 * extracted from lib/platform-data.ts.
 */

import { cache } from 'react'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { getTeamsDashboard } from '@/lib/team-data'
import type { LeagueMember, LeagueRegistration } from '@/types'

export const getRegistrations = cache(async (leagueId?: string): Promise<LeagueRegistration[]> => {
  return fetchWithTTLCache(`registrations_${leagueId || 'all'}`, async () => {
    try {
      const rows = await db.leagueRegistration.findMany({
        where: leagueId ? { leagueId } : undefined,
        orderBy: { createdAt: 'desc' },
      })

      const registrations: LeagueRegistration[] = rows.map((data) => ({
        id: data.id,
        leagueId: data.leagueId,
        userId: data.userId,
        teamId: data.teamId,
        displayName: data.displayName,
        steamId: data.steamId || '',
        classTag: data.classTag,
        assignedNumber: data.assignedNumber,
        createdAt: data.createdAt.toISOString(),
        status: data.status,
      }))

      // Fill in missing steamId for rows written before it was denormalized.
      const missingSteamUserIds = Array.from(
        new Set(registrations.filter((r) => !r.steamId && r.userId && !r.userId.startsWith('steam_')).map((r) => r.userId))
      )

      // Independent of each other — run together instead of one after the other.
      const [{ teams }, steamAccounts] = await Promise.all([
        getTeamsDashboard(),
        missingSteamUserIds.length > 0
          ? db.steamAccount.findMany({ where: { userId: { in: missingSteamUserIds } } }).catch((err) => {
              console.error('Failed to backfill steam accounts for registrations:', err)
              return []
            })
          : Promise.resolve([]),
      ])

      if (steamAccounts.length > 0) {
        const steamIdByUserId = new Map(steamAccounts.map((s) => [s.userId, s.steamId]))
        for (const r of registrations) {
          if (!r.steamId) {
            r.steamId = steamIdByUserId.get(r.userId) || (r.userId.startsWith('steam_') ? r.userId.replace('steam_', '') : '')
          }
        }
      }

      // A registration only counts as "active" if the referencing team still has a
      // matching car (same class + dorsal + the driver is actually on that car).
      return registrations.filter((r) => {
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
          const drivers = Array.isArray(c.driverUserIds) ? c.driverUserIds : []
          return sameClass && sameDorsal && sameLeague && (drivers.length === 0 || drivers.includes(r.userId) || r.userId === team.ownerUserId || r.userId === team.id)
        })
        return Boolean(car) || (team.cars || []).length === 0
      })
    } catch (error) {
      console.error('Failed to get registrations:', error)
      return []
    }
  }, 60)
})

export const getLeagueMembers = cache(async (leagueId: string): Promise<LeagueMember[]> => {
  try {
    const members = await db.leagueMember.findMany({ where: { leagueId }, orderBy: { createdAt: 'asc' } })
    if (members.length === 0) return []

    const userIds = Array.from(new Set(members.map((m) => m.userId)))
    const [profiles, steamAccounts] = await Promise.all([
      db.profile.findMany({ where: { userId: { in: userIds } } }),
      db.steamAccount.findMany({ where: { userId: { in: userIds } } }),
    ])

    const displayNameByUserId = new Map(profiles.map((p) => [p.userId, p.displayName]))
    const steamByUserId = new Map(steamAccounts.map((s) => [s.userId, { steamId: s.steamId, steamDisplayName: s.steamDisplayName }]))

    return members.map((m): LeagueMember => {
      const steam = steamByUserId.get(m.userId)
      return {
        id: m.id,
        leagueId: m.leagueId,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        steamId: steam?.steamId,
        steamDisplayName: steam?.steamDisplayName,
        displayName: displayNameByUserId.get(m.userId) || '',
      }
    })
  } catch (error) {
    console.error('Failed to get league members:', error)
    return []
  }
})

export const getEventConfirmations = cache(async (leagueId: string): Promise<any[]> => {
  return fetchWithTTLCache(`event_confirmations_${leagueId}`, async () => {
    try {
      const rows = await db.leagueEventConfirmation.findMany({
        where: { leagueId },
        include: { drivers: true },
      })
      if (rows.length === 0) return []

      const rawConfirmations = rows.map((data) => ({
        id: data.id,
        eventId: data.eventId,
        leagueId: data.leagueId,
        teamId: data.teamId,
        classTag: data.classTag,
        carNumber: data.carNumber,
        carModel: data.carModel || '',
        driverUserIds: data.drivers.map((d) => d.userId),
        status: 'confirmed',
        confirmedAt: data.confirmedAt.toISOString(),
      }))

      const [{ teams }, leagueRegs] = await Promise.all([getTeamsDashboard(), getRegistrations(leagueId)])

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
          const drivers = Array.isArray(carObj.driverUserIds) ? carObj.driverUserIds.filter(Boolean) : []
          const byLeague = carObj.driverUserIdsByLeague || {}
          const leagueDrivers = (byLeague[leagueId] || []).filter(Boolean)
          const hasDrivers = drivers.length > 0 || leagueDrivers.length > 0
          return sameClass && sameDorsal && hasDrivers
        })
        return Boolean(car)
      })
    } catch (error) {
      console.error('Failed to get event confirmations:', error)
      return []
    }
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
    try {
      const [profiles, roles, teams, members, steamAccounts] = await Promise.all([
        db.profile.findMany(),
        db.platformRole.findMany(),
        db.team.findMany({ where: { status: 'approved' } }),
        db.teamMember.findMany(),
        db.steamAccount.findMany(),
      ])

      const steamByUserId = new Map(steamAccounts.map((s) => [s.userId, s.steamId]))

      const rolesMap = new Map<string, string>()
      roles.forEach((r) => rolesMap.set(r.userId, r.role))

      const ownerUserIds = new Set<string>()
      members.forEach((m) => {
        if (m.role === 'owner' || m.role === 'manager') ownerUserIds.add(m.userId)
      })

      const teamsMap = new Map(teams.map((t) => [t.id, { id: t.id, name: t.name, logoUrl: t.logoUrl }]))
      const userTeamsMap = new Map<string, { id: string; name: string; logoUrl: string | null }>()
      members.forEach((m) => {
        if (teamsMap.has(m.teamId)) userTeamsMap.set(m.userId, teamsMap.get(m.teamId)!)
      })

      const users: PlatformDriverUser[] = profiles.map((p) => {
        const team = userTeamsMap.get(p.userId)
        const isTeamOwner = ownerUserIds.has(p.userId)
        let role = (rolesMap.get(p.userId) || 'user') as PlatformDriverUser['role']
        if (role === 'user' && isTeamOwner) role = 'team_manager'

        return {
          userId: p.userId,
          displayName: p.displayName || 'Driver',
          avatarUrl: p.avatarUrl,
          steamId: steamByUserId.get(p.userId) || '',
          role,
          teamId: team?.id || null,
          teamName: team?.name || null,
          teamLogo: team?.logoUrl || null,
          isTeamOwner,
          createdAt: p.createdAt.toISOString(),
        }
      })

      return users.sort((a, b) => a.displayName.localeCompare(b.displayName))
    } catch (err) {
      console.error('Failed to get registered drivers:', err)
      return []
    }
  }, 60)
})

// Keyed by `${classTag}_${teamId}_${carNumber}` — points belong to a specific car, not the
// team as a whole, so a team running two cars in the same class scores them independently.
export const getTeamPointsOverrides = cache(async (leagueId: string): Promise<Record<string, number>> => {
  const pointsMap: Record<string, number> = {}
  try {
    const rows = await db.leagueTeamPoints.findMany({ where: { leagueId } })
    for (const row of rows) {
      pointsMap[`${row.classTag.toUpperCase()}_${row.teamId}_${row.carNumber}`] = row.points
    }
  } catch (err) {
    console.error('Failed to get team points:', err)
  }
  return pointsMap
})

// Keyed the same way as getTeamPointsOverrides — the standings ladder's uploaded car
// side-profile photo belongs to a specific car, not the team as a whole.
export const getCarPhotoOverrides = cache(async (leagueId: string): Promise<Record<string, string>> => {
  const photoMap: Record<string, string> = {}
  try {
    const rows = await db.leagueCarPhoto.findMany({ where: { leagueId } })
    for (const row of rows) {
      photoMap[`${row.classTag.toUpperCase()}_${row.teamId}_${row.carNumber}`] = row.imageUrl
    }
  } catch (err) {
    console.error('Failed to get car photos:', err)
  }
  return photoMap
})
