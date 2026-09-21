import { cache } from 'react'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import type { Team, TeamInvite, TeamMember } from '@/types'

type TeamDashboard = Team & {
  leagueTitle?: string
  competitionClassTags?: string[]
  members: TeamMember[]
  invites: TeamInvite[]
  occupiedSlots: number
}

// The team list itself is identical for every viewer — only `myTeamIds` below
// varies per user. Cache it under one shared key instead of once per user, so
// concurrent visitors reuse the same cached fetch instead of each paying for
// their own full copy.
export const getTeamsDashboard = cache(async (currentUserId?: string) => {
  const { teams } = await fetchWithTTLCache('teams_dashboard_base', async () => {
    try {
      const teamRows = await db.team.findMany({
        include: {
          cars: { include: { drivers: true } },
          skinAssignments: true,
          members: true,
          invites: true,
        },
      })

      if (teamRows.length === 0) {
        return { teams: [] as TeamDashboard[] }
      }

      const teamIds = teamRows.map((t) => t.id)
      const leagueIds = Array.from(new Set(teamRows.map((t) => t.leagueId).filter((id): id is string => Boolean(id))))
      const userIds = Array.from(new Set(teamRows.flatMap((t) => t.members.map((m) => m.userId))))

      const [leagues, profiles, steamAccounts, classTagRows] = await Promise.all([
        leagueIds.length > 0 ? db.league.findMany({ where: { id: { in: leagueIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
        userIds.length > 0 ? db.profile.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
        userIds.length > 0 ? db.steamAccount.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
        db.leagueRegistration.findMany({ where: { teamId: { in: teamIds }, classTag: { not: null } }, select: { teamId: true, classTag: true } }),
      ])

      const leagueTitleById = new Map(leagues.map((l) => [l.id, l.title]))
      const profileByUserId = new Map(profiles.map((p) => [p.userId, p]))
      const steamByUserId = new Map(steamAccounts.map((s) => [s.userId, s]))

      const classTagsByTeamId = new Map<string, Set<string>>()
      for (const row of classTagRows) {
        if (!row.teamId || !row.classTag) continue
        const set = classTagsByTeamId.get(row.teamId) || new Set<string>()
        set.add(row.classTag.toUpperCase())
        classTagsByTeamId.set(row.teamId, set)
      }

      const teams: TeamDashboard[] = teamRows.map((t) => {
        const members: TeamMember[] = t.members.map((m) => {
          const profile = profileByUserId.get(m.userId)
          const steam = steamByUserId.get(m.userId)
          const displayName = m.displayName || profile?.displayName || steam?.steamDisplayName || (m.role === 'owner' ? 'Team Leader' : 'Driver')
          return {
            id: m.id,
            teamId: m.teamId,
            userId: m.userId,
            role: m.role,
            roleTags: m.roleTags || [],
            createdAt: m.createdAt.toISOString(),
            displayName,
            avatarUrl: m.avatarUrl || profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`,
            steamId: m.steamId || steam?.steamId || '',
            steamDisplayName: displayName,
          }
        })

        const invites: TeamInvite[] = t.invites
          .map((i): TeamInvite => ({
            id: i.id,
            teamId: i.teamId,
            invitedByUserId: i.invitedByUserId,
            invitedUserId: i.invitedUserId,
            invitedSteamId: i.invitedSteamId || '',
            message: i.message,
            status: i.status,
            createdAt: i.createdAt.toISOString(),
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

        const cars = t.cars.map((car) => {
          const driverUserIdsByLeague: Record<string, string[]> = {}
          const reserveDriverUserIdsByLeague: Record<string, string[]> = {}
          const defaultDrivers: string[] = []
          const defaultReserveDrivers: string[] = []
          for (const d of car.drivers) {
            const byLeague = d.isReserve ? reserveDriverUserIdsByLeague : driverUserIdsByLeague
            const defaultBucket = d.isReserve ? defaultReserveDrivers : defaultDrivers
            if (d.leagueId) {
              ;(byLeague[d.leagueId] ||= []).push(d.userId)
            } else {
              defaultBucket.push(d.userId)
            }
          }
          return {
            id: car.id,
            category: car.category.toUpperCase() as 'GT3' | 'LMP2' | 'HYPERCAR',
            dorsal: car.dorsal,
            modelName: car.modelName || '',
            modelFolder: car.modelFolder || '',
            skinUrl: car.skinUrl || '',
            skinName: car.skinName || '',
            driverUserIds: defaultDrivers,
            driverUserIdsByLeague,
            reserveDriverUserIds: defaultReserveDrivers,
            reserveDriverUserIdsByLeague,
            leagueId: car.leagueId,
          }
        })

        return {
          id: t.id,
          leagueId: t.leagueId,
          leagueTitle: t.leagueId ? leagueTitleById.get(t.leagueId) : undefined,
          name: t.name,
          description: t.description,
          classTags: t.classTags,
          primaryColor: t.primaryColor,
          secondaryColor: t.secondaryColor,
          accentColor: t.accentColor || '#00f0ff',
          slogan: t.slogan,
          discordUrl: t.discordUrl,
          youtubeUrl: t.youtubeUrl,
          instagramUrl: t.instagramUrl,
          twitterUrl: t.twitterUrl,
          twitchUrl: t.twitchUrl,
          tiktokUrl: t.tiktokUrl,
          logoUrl: t.logoUrl,
          bannerUrl: t.bannerUrl,
          carSkinUrls: t.carSkinUrls,
          skinAssignments: t.skinAssignments.map((s) => ({
            leagueSlug: s.leagueSlug,
            skinUrl: s.skinUrl,
            carNumber: s.carNumber ? Number(s.carNumber) : null,
            featured: s.featured,
          })),
          cars: cars as Team['cars'],
          ownerUserId: t.ownerUserId,
          maxSlots: t.maxSlots,
          createdAt: t.createdAt.toISOString(),
          status: t.status,
          members,
          invites,
          occupiedSlots: members.filter((m) => m.role === 'driver' || m.role === 'manager' || m.role === 'owner').length,
          competitionClassTags: Array.from(classTagsByTeamId.get(t.id) || []),
        }
      })

      return { teams }
    } catch (error) {
      console.error('Failed to get teams dashboard:', error)
      return { teams: [] as TeamDashboard[] }
    }
  }, 60)

  const myTeamIds = currentUserId
    ? teams
        .filter((team) => team.ownerUserId === currentUserId || team.members.some((m) => m.userId === currentUserId && (m.role === 'owner' || m.role === 'manager')))
        .map((team) => team.id)
    : []

  return { teams, myTeamIds, mode: 'ok' as const }
})

/**
 * Cheap "does this user already belong to a team?" check. Actions used to load the whole
 * platform-wide teams dashboard (every team, car, driver, member and invite) just to answer this.
 */
export async function userBelongsToTeam(userId: string): Promise<boolean> {
  const team = await db.team.findFirst({
    where: { OR: [{ ownerUserId: userId }, { members: { some: { userId } } }] },
    select: { id: true },
  })
  return Boolean(team)
}

export type SkinReviewDTO = {
  id: string
  teamId: string
  teamName: string
  teamLogoUrl: string | null
  category: string
  dorsal: string
  leagueTitle: string | null
  skinUrl: string
  skinName: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt: string | null
}

// Keyed by the same carLineupKey() composite used everywhere else a car's identity has to
// survive updateTeam()'s delete-and-recreate of TeamCar rows. Powers the "delivered" badge
// on a league's entry list — only an approved skin counts, not just an uploaded one.
export async function getSkinReviewStatusByLeague(leagueId: string): Promise<Record<string, 'pending' | 'approved' | 'rejected'>> {
  try {
    const rows = await db.carSkinReview.findMany({ where: { leagueId }, select: { carKey: true, status: true } })
    return Object.fromEntries(rows.map((r) => [r.carKey, r.status]))
  } catch (error) {
    console.error('Failed to get skin review status for league:', error)
    return {}
  }
}

// Not cached with fetchWithTTLCache like the dashboard above — this only powers the admin
// review queue, which needs to reflect a just-submitted or just-reviewed skin immediately.
export async function getSkinReviewQueue(): Promise<SkinReviewDTO[]> {
  try {
    const rows = await db.carSkinReview.findMany({
      include: { team: { select: { name: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })
    if (rows.length === 0) return []

    const leagueIds = Array.from(new Set(rows.map((r) => r.leagueId).filter((id): id is string => Boolean(id))))
    const leagues = leagueIds.length > 0 ? await db.league.findMany({ where: { id: { in: leagueIds } }, select: { id: true, title: true } }) : []
    const leagueTitleById = new Map(leagues.map((l) => [l.id, l.title]))

    return rows.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      teamName: r.team.name,
      teamLogoUrl: r.team.logoUrl,
      category: r.category,
      dorsal: r.dorsal,
      leagueTitle: r.leagueId ? leagueTitleById.get(r.leagueId) || null : null,
      skinUrl: r.skinUrl,
      skinName: r.skinName,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    }))
  } catch (error) {
    console.error('Failed to get skin review queue:', error)
    return []
  }
}
