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

export const getTeamsDashboard = cache(async (currentUserId?: string) => {
  const cacheKey = currentUserId ? `teams_dashboard_${currentUserId}` : 'teams_dashboard_anon'
  return fetchWithTTLCache(cacheKey, async () => {
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
        return { teams: [] as TeamDashboard[], myTeamIds: [] as string[], mode: 'ok' as const }
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
          const defaultDrivers: string[] = []
          for (const d of car.drivers) {
            if (d.leagueId) {
              ;(driverUserIdsByLeague[d.leagueId] ||= []).push(d.userId)
            } else {
              defaultDrivers.push(d.userId)
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

      const myTeamIds = currentUserId
        ? teams
            .filter((team) => team.ownerUserId === currentUserId || team.members.some((m) => m.userId === currentUserId && (m.role === 'owner' || m.role === 'manager')))
            .map((team) => team.id)
        : []

      return { teams, myTeamIds, mode: 'ok' as const }
    } catch (error) {
      console.error('Failed to get teams dashboard:', error)
      return { teams: [] as TeamDashboard[], myTeamIds: [] as string[], mode: 'ok' as const }
    }
  }, 60)
})
