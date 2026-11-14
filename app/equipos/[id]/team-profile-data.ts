import { db } from '@/lib/db'
import { getRegistrations, getLeagues, getLeagueEvents, getTeamPointsOverrides } from '@/lib/platform-data'
import type { TeamStats, TeamPilot, LeagueParticipation, RecentResult, PendingApplication, PilotStats } from './team-utils'

export type TeamProfileData = {
  teamPilots: TeamPilot[]
  pendingApplications: PendingApplication[]
  inviteCandidates: Array<{ userId: string; label: string }>
  recentResults: RecentResult[]
  leagueParticipation: LeagueParticipation[]
  stats: TeamStats
  pilotStatsByUserId: Record<string, PilotStats>
}

export async function fetchTeamProfileData(
  team: { id: string; ownerUserId?: string | null; members: Array<{ userId: string; role: string; roleTags?: string[]; displayName?: string; steamDisplayName?: string; steamId?: string }>; cars?: any[] },
): Promise<TeamProfileData> {
  const memberUserIds = team.members.map((member) => member.userId)
  let pendingApplications: PendingApplication[] = []
  const inviteCandidates: Array<{ userId: string; label: string }> = []
  const teamPilots: TeamPilot[] = []
  const recentResults: RecentResult[] = []
  const leagueParticipation: LeagueParticipation[] = []
  const pilotStatsByUserId: Record<string, PilotStats> = {}

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
    inviteCandidates.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))

    for (const member of team.members) {
      const profile = memberProfileByUserId.get(member.userId)
      const steam = steamByUserId.get(member.userId)
      teamPilots.push({
        userId: member.userId,
        role: member.role,
        roleTags: member.roleTags || [],
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
          const categoryCars = teamCarsInLeague.filter((c: any) => String(c.category || '').toUpperCase() === tag)
          const categoryRegs = lgRows.filter((r) => String(r.classTag || '').toUpperCase() === tag)

          // Points belong to a specific car, not the team as a whole — sum every car this
          // team has scored with in this class instead of reading one shared team value.
          const carNumbers = new Set<string>(categoryRegs.map((r) => (r.assignedNumber != null ? String(r.assignedNumber) : '')))
          if (carNumbers.size === 0) carNumbers.add('')
          const points = Array.from(carNumbers).reduce((sum, carNumber) => sum + (pointsMap[`${tag}_${team.id}_${carNumber}`] ?? 0), 0)

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

    // Results are attributed through the locked-in lineup (LeagueEventConfirmation + its
    // drivers), not by matching LeagueResult.userId — a manual results import only resolves a
    // userId when the steamId happens to match, so plenty of real race results would otherwise
    // never reach a driver's stats even though they were confirmed in that car for that race.
    if (leagueIds.length > 0) {
      const confirmations = await db.leagueEventConfirmation.findMany({
        where: { teamId: team.id, leagueId: { in: leagueIds } },
        include: { drivers: true },
      })

      if (confirmations.length > 0) {
        const confirmedEventIds = Array.from(new Set(confirmations.map((c) => c.eventId)))
        const carResults = await db.leagueResult.findMany({
          where: { eventId: { in: confirmedEventIds }, sessionType: 'race' },
        })

        const resultByCarKey = new Map<string, (typeof carResults)[number]>()
        for (const row of carResults) {
          if (!row.position || row.position <= 0 || !row.classTag || !row.dorsal) continue
          const key = `${row.eventId}::${row.classTag.trim().toUpperCase()}::${row.dorsal.trim()}`
          resultByCarKey.set(key, row)
        }

        const resultLeagueIds = Array.from(new Set(carResults.map((r) => r.leagueId)))
        const [resultLeagues, resultEvents] = await Promise.all([
          resultLeagueIds.length > 0 ? db.league.findMany({ where: { id: { in: resultLeagueIds } } }) : Promise.resolve([]),
          db.leagueEvent.findMany({ where: { id: { in: confirmedEventIds } } }),
        ])
        const leagueNameById = new Map(resultLeagues.map((r) => [r.id, r.title]))
        const eventNameById = new Map(resultEvents.map((r) => [r.id, r.title || r.circuitName]))

        type MatchedResult = { id: string; leagueId: string; eventId: string; position: number; points: number | null; status: string; at: string }
        const matchedByUserId = new Map<string, MatchedResult[]>()

        for (const confirmation of confirmations) {
          const key = `${confirmation.eventId}::${confirmation.classTag.trim().toUpperCase()}::${String(confirmation.carNumber).trim()}`
          const result = resultByCarKey.get(key)
          if (!result) continue
          const matched: MatchedResult = {
            id: result.id, leagueId: result.leagueId, eventId: result.eventId,
            position: result.position!, points: result.points, status: result.status,
            at: result.createdAt.toISOString(),
          }
          for (const driver of confirmation.drivers) {
            const list = matchedByUserId.get(driver.userId) || []
            list.push(matched)
            matchedByUserId.set(driver.userId, list)
          }
        }

        // Per-pilot breakdown for the driver roster panel.
        for (const [userId, rows] of matchedByUserId) {
          const sorted = [...rows].sort((a, b) => b.at.localeCompare(a.at))
          pilotStatsByUserId[userId] = {
            wins: rows.filter((r) => r.position === 1).length,
            podiums: rows.filter((r) => r.position <= 3).length,
            racesRun: new Set(rows.map((r) => r.eventId)).size,
            dnf: rows.filter((r) => r.status === 'dnf').length,
            dsq: rows.filter((r) => r.status === 'dsq').length,
            recentResults: sorted.slice(0, 5).map((row) => ({
              id: row.id,
              leagueTitle: leagueNameById.get(row.leagueId) || 'League',
              eventTitle: eventNameById.get(row.eventId) || 'Event',
              position: row.position, points: row.points, at: row.at,
            })),
          }
        }

        // Team-wide totals: dedupe by result id, since a multi-driver car shares one result row
        // across everyone confirmed in it — summing the per-pilot lists would double-count it.
        const uniqueResults = new Map<string, MatchedResult>()
        for (const rows of matchedByUserId.values()) {
          for (const r of rows) uniqueResults.set(r.id, r)
        }
        const uniqueResultsList = Array.from(uniqueResults.values()).sort((a, b) => b.at.localeCompare(a.at))

        for (const row of uniqueResultsList.slice(0, 8)) {
          recentResults.push({
            id: row.id,
            leagueTitle: leagueNameById.get(row.leagueId) || 'League',
            eventTitle: eventNameById.get(row.eventId) || 'Event',
            position: row.position, points: row.points, at: row.at,
          })
        }

        stats.wins = uniqueResultsList.filter((r) => r.position === 1).length
        stats.podiums = uniqueResultsList.filter((r) => r.position <= 3).length
        stats.dnf = uniqueResultsList.filter((r) => r.status === 'dnf').length
        stats.dsq = uniqueResultsList.filter((r) => r.status === 'dsq').length
        stats.racesRun = new Set(uniqueResultsList.map((r) => r.eventId)).size
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
    pilotStatsByUserId,
    recentResults,
    leagueParticipation,
    stats,
  }
}
