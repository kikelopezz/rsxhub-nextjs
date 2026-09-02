import { db } from '@/lib/db'
import { getRegistrations, getLeagues, getLeagueEvents, getTeamPointsOverrides } from '@/lib/platform-data'
import type { TeamStats, TeamPilot, LeagueParticipation, RecentResult, PendingApplication } from './team-utils'

export type TeamProfileData = {
  teamPilots: TeamPilot[]
  pendingApplications: PendingApplication[]
  inviteCandidates: Array<{ userId: string; label: string }>
  recentResults: RecentResult[]
  leagueParticipation: LeagueParticipation[]
  stats: TeamStats
}

export async function fetchTeamProfileData(
  team: { id: string; ownerUserId?: string | null; members: Array<{ userId: string; role: string; displayName?: string; steamDisplayName?: string; steamId?: string }>; cars?: any[] },
): Promise<TeamProfileData> {
  const memberUserIds = team.members.map((member) => member.userId)
  let pendingApplications: PendingApplication[] = []
  const inviteCandidates: Array<{ userId: string; label: string }> = []
  const teamPilots: TeamPilot[] = []
  const recentResults: RecentResult[] = []
  const leagueParticipation: LeagueParticipation[] = []

  let stats: TeamStats = {
    leagues: 0, activeLeagues: 0, approvedEntries: 0, pendingEntries: 0,
    upcomingEvents: 0, wins: 0, podiums: 0, racesRun: 0, dnf: 0, dsq: 0,
  }

  try {
    const [memberSteamRows, memberProfiles, otherSteamAccounts] = await Promise.all([
      memberUserIds.length > 0 ? db.steamAccount.findMany({ where: { userId: { in: memberUserIds } } }) : Promise.resolve([]),
      memberUserIds.length > 0 ? db.profile.findMany({ where: { userId: { in: memberUserIds } } }) : Promise.resolve([]),
      db.steamAccount.findMany({ where: { userId: { notIn: memberUserIds } }, take: 200 }),
    ])

    const steamByUserId = new Map(memberSteamRows.map((row) => [row.userId, row]))
    const memberProfileByUserId = new Map(memberProfiles.map((row) => [row.userId, row]))

    for (const account of otherSteamAccounts) {
      const displayName = account.steamDisplayName || account.userId || 'Driver'
      inviteCandidates.push({ userId: account.userId, label: `${displayName} (${account.steamId || account.userId})` })
    }

    for (const member of team.members) {
      const profile = memberProfileByUserId.get(member.userId)
      const steam = steamByUserId.get(member.userId)
      teamPilots.push({
        userId: member.userId,
        role: member.role,
        name: profile?.displayName || steam?.steamDisplayName || member.displayName || member.steamDisplayName || member.steamId || member.userId || 'Driver',
        avatarUrl: profile?.avatarUrl || steam?.steamAvatarUrl || (member as any).avatarUrl || null,
        steamId: steam?.steamId || member.steamId || '',
      })
    }

    let teamRegRows: Array<{ leagueId: string; userId: string; status: string; classTag: string; assignedNumber: number }> = (
      await db.leagueRegistration.findMany({ where: { teamId: team.id } })
    ).map((r) => ({ leagueId: r.leagueId, userId: r.userId, status: r.status, classTag: r.classTag || '', assignedNumber: r.assignedNumber || 0 }))

    if (teamRegRows.length === 0) {
      const allRegs = await getRegistrations()
      teamRegRows = allRegs
        .filter((r) => r.teamId === team.id)
        .map((r) => ({ leagueId: r.leagueId, userId: r.userId, status: r.status, classTag: r.classTag || '', assignedNumber: r.assignedNumber || 0 }))
    }

    const carLeagueIds = (team.cars || []).map((c: any) => c.leagueId).filter(Boolean)
    const leagueIds = Array.from(new Set([...teamRegRows.map((row) => row.leagueId), ...carLeagueIds]))

    if (leagueIds.length > 0) {
      const allLeagues = await getLeagues()
      const relevantLeagues = allLeagues.filter((l) => leagueIds.includes(l.id) || leagueIds.includes(l.slug))

      for (const lg of relevantLeagues) {
        const lgRows = teamRegRows.filter((r) => r.leagueId === lg.id || r.leagueId === lg.slug)
        const approvedCount = lgRows.filter((r) => r.status === 'approved').length
        const pendingCount = lgRows.filter((r) => r.status === 'pending').length

        const carDriverUserIds = (team.cars || [])
          .filter((c: any) => !c.leagueId || c.leagueId === lg.id || c.leagueId === lg.slug)
          .flatMap((c: any) => {
            const byLeague = c.driverUserIdsByLeague || {}
            const list = byLeague[lg.id] || byLeague[lg.slug] || c.driverUserIds || []
            return Array.isArray(list) ? list : []
          })
          .filter(Boolean)

        const regDriverUserIds = lgRows.map((r) => r.userId).filter((u) => u && u !== team.ownerUserId && !u.startsWith('unassigned'))

        const driverUserIds = Array.from(new Set([...regDriverUserIds, ...carDriverUserIds]))
        const events = await getLeagueEvents(lg.id)
        const nowStr = new Date().toISOString()
        const upcomingEvents = events.filter((e) => e.startsAt >= nowStr).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        const pointsMap = await getTeamPointsOverrides(lg.id)

        const teamCarsInLeague = (team.cars || []).filter((c: any) => !c.leagueId || c.leagueId === lg.id || c.leagueId === lg.slug)

        const classTagsSet = new Set<string>([
          ...lgRows.map((r) => String(r.classTag || '').toUpperCase()).filter(Boolean),
          ...teamCarsInLeague.map((c: any) => String(c.category || '').toUpperCase()).filter(Boolean),
        ])

        const categories = Array.from(classTagsSet).map((tag) => {
          const points = pointsMap[`${tag}_${team.id}`] ?? 0
          const categoryCars = teamCarsInLeague.filter((c: any) => String(c.category || '').toUpperCase() === tag)
          const categoryRegs = lgRows.filter((r) => String(r.classTag || '').toUpperCase() === tag)

          const catDrivers = new Set<string>([
            ...categoryRegs.map((r) => r.userId).filter((u) => u && u !== team.ownerUserId && !u.startsWith('unassigned')),
            ...categoryCars
              .flatMap((c: any) => {
                const byLeague = c.driverUserIdsByLeague || {}
                const list = byLeague[lg.id] || byLeague[lg.slug] || c.driverUserIds || []
                return Array.isArray(list) ? list : []
              })
              .filter(Boolean),
          ])

          return {
            classTag: tag,
            points,
            carsCount: Math.max(categoryCars.length, categoryRegs.length, 1),
            driversCount: catDrivers.size,
          }
        })

        leagueParticipation.push({
          leagueId: lg.id, title: lg.title || '', bannerUrl: lg.bannerUrl || null,
          status: lg.status || 'open', simulator: lg.simulator || 'ac',
          teamDriversInLeague: driverUserIds.length,
          approvedEntries: Math.max(approvedCount > 0 ? approvedCount : lgRows.length, 1),
          pendingEntries: pendingCount, nextEventAt: upcomingEvents[0]?.startsAt || null,
          categories,
        })
      }

      stats = {
        leagues: leagueParticipation.length,
        activeLeagues: leagueParticipation.filter((l) => l.status === 'open' || l.status === 'ongoing').length,
        approvedEntries: leagueParticipation.reduce((sum, l) => sum + l.approvedEntries, 0),
        pendingEntries: leagueParticipation.reduce((sum, l) => sum + l.pendingEntries, 0),
        upcomingEvents: leagueParticipation.filter((l) => Boolean(l.nextEventAt)).length,
        wins: 0, podiums: 0, racesRun: 0, dnf: 0, dsq: 0,
      }
    }

    if (memberUserIds.length > 0 && leagueIds.length > 0) {
      const allResults = await db.leagueResult.findMany({
        where: { userId: { in: memberUserIds }, leagueId: { in: leagueIds } },
        orderBy: { createdAt: 'desc' },
      })

      if (allResults.length > 0) {
        const normalizedResults = allResults
          .map((row) => ({
            id: row.id, leagueId: row.leagueId, eventId: row.eventId, userId: row.userId,
            position: row.position ?? 0, points: row.points, at: row.createdAt.toISOString(),
            status: row.status,
          }))
          .filter((row) => row.position > 0 && teamRegRows.some((r) => r.leagueId === row.leagueId && r.userId === row.userId))

        const resultLeagueIds = Array.from(new Set(normalizedResults.map((r) => r.leagueId)))
        const resultEventIds = Array.from(new Set(normalizedResults.map((r) => r.eventId)))

        const [resultLeagues, resultEvents] = await Promise.all([
          resultLeagueIds.length > 0 ? db.league.findMany({ where: { id: { in: resultLeagueIds } } }) : Promise.resolve([]),
          resultEventIds.length > 0 ? db.leagueEvent.findMany({ where: { id: { in: resultEventIds } } }) : Promise.resolve([]),
        ])

        const leagueNameById = new Map(resultLeagues.map((r) => [r.id, r.title]))
        const eventNameById = new Map(resultEvents.map((r) => [r.id, r.title || r.circuitName]))

        for (const row of normalizedResults.slice(0, 8)) {
          recentResults.push({
            id: row.id,
            leagueTitle: leagueNameById.get(row.leagueId) || 'League',
            eventTitle: eventNameById.get(row.eventId) || 'Event',
            position: row.position, points: row.points, at: row.at,
          })
        }

        const uniqueRaceIds = new Set(normalizedResults.map((r) => r.eventId))
        stats.wins = normalizedResults.filter((r) => r.position === 1).length
        stats.podiums = normalizedResults.filter((r) => r.position <= 3).length
        stats.dnf = allResults.filter((r) => r.status === 'dnf').length
        stats.dsq = allResults.filter((r) => r.status === 'dsq').length
        stats.racesRun = uniqueRaceIds.size
      }
    }

    const applications = await db.marketApplication.findMany({ where: { teamId: team.id, status: 'pending' } })
    pendingApplications = applications.map((a) => ({
      id: a.id,
      userId: a.userId,
      userName: a.userName || 'Driver',
      userAvatar: a.userAvatar,
      contactInfo: a.contactInfo || 'Discord / Steam',
      message: a.message || '',
      createdAt: a.createdAt.toISOString(),
    }))
  } catch (error) {
    console.error('Failed to load team profile details:', error)
  }

  return {
    teamPilots,
    pendingApplications,
    inviteCandidates,
    recentResults,
    leagueParticipation,
    stats,
  }
}
