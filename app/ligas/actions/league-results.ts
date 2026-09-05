'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getAdminAccessContext, canStewardLeague } from '@/lib/auth'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { getTeamsDashboard } from '@/lib/team-data'

export async function getEventResultsAction(leagueId: string, eventId: string, sessionType: 'qualifying' | 'race' = 'race') {
  return fetchWithTTLCache(`event_results_${eventId}_${sessionType}`, async () => {
    try {
      const rows = await db.leagueResult.findMany({ where: { eventId, sessionType } })
      if (rows.length === 0) return []

      const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)))
      const [{ teams }, profiles, steamAccounts] = await Promise.all([
        getTeamsDashboard(),
        userIds.length > 0 ? db.profile.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
        userIds.length > 0 ? db.steamAccount.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
      ])

      const profilesMap = new Map(profiles.map((p) => [p.userId, p.displayName]))
      const steamMap = new Map(steamAccounts.map((s) => [s.userId, { steamId: s.steamId, name: s.steamDisplayName }]))

      return rows
        .map((row) => {
          const profName = profilesMap.get(row.userId)
          const stm = steamMap.get(row.userId)
          const dName = profName || stm?.name || row.driverName || (row.userId ? `Driver ${row.userId.slice(0, 4)}` : 'Driver')
          const sId = stm?.steamId || row.steamId || ''

          let tName = row.teamName || 'Independent'
          if (!row.teamName) {
            const matchedTeam = teams.find((t: any) => t.members?.some((m: any) => m.userId === row.userId))
            if (matchedTeam) tName = matchedTeam.name
          }

          return {
            id: row.id,
            sessionType: row.sessionType,
            position: row.position ?? 0,
            driverName: dName,
            teamName: tName,
            steamId: sId,
            classTag: (row.classTag || 'GT3').toUpperCase(),
            dorsal: row.dorsal,
            points: row.points ?? 0,
            lapTime: row.lapTime,
            raceTime: row.raceTime,
          }
        })
        .sort((a, b) => a.position - b.position)
    } catch (err) {
      console.error('Failed to load event results:', err)
      return []
    }
  }, 60)
}

export async function updateTeamPointsAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  const isSteward = canStewardLeague(access.platformRole)
  if (!access.canAccessPlatformAdmin && !isSteward) {
    throw new Error('Unauthorized: Only Admins and Stewards can modify team points.')
  }

  const leagueId = String(formData.get('leagueId') || '').trim()
  const classTag = String(formData.get('classTag') || 'GT3').trim().toUpperCase()
  const teamId = String(formData.get('teamId') || '').trim()
  const carNumber = String(formData.get('carNumber') || '').trim()
  const points = Math.max(0, parseInt(String(formData.get('points') || '0'), 10) || 0)
  const slug = String(formData.get('slug') || '')

  if (!leagueId || !teamId) throw new Error('Missing parameters')

  await db.leagueTeamPoints.upsert({
    where: { leagueId_classTag_teamId_carNumber: { leagueId, classTag, teamId, carNumber } },
    create: { leagueId, classTag, teamId, carNumber, points, updatedBy: session.userId },
    update: { points, updatedBy: session.userId },
  })

  if (slug) {
    revalidatePath(`/ligas/${slug}`)
  }
}

export async function updateCarPhotoAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  const isSteward = canStewardLeague(access.platformRole)
  if (!access.canAccessPlatformAdmin && !isSteward) {
    throw new Error('Unauthorized: Only Admins and Stewards can change car photos.')
  }

  const leagueId = String(formData.get('leagueId') || '').trim()
  const classTag = String(formData.get('classTag') || 'GT3').trim().toUpperCase()
  const teamId = String(formData.get('teamId') || '').trim()
  const carNumber = String(formData.get('carNumber') || '').trim()
  const imageUrl = String(formData.get('imageUrl') || '').trim()
  const slug = String(formData.get('slug') || '')

  if (!leagueId || !teamId || !imageUrl) throw new Error('Missing parameters')

  await db.leagueCarPhoto.upsert({
    where: { leagueId_classTag_teamId_carNumber: { leagueId, classTag, teamId, carNumber } },
    create: { leagueId, classTag, teamId, carNumber, imageUrl, updatedBy: session.userId },
    update: { imageUrl, updatedBy: session.userId },
  })

  if (slug) {
    revalidatePath(`/ligas/${slug}`)
  }
}
