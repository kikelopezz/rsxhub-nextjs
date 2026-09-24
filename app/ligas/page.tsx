export const dynamic = 'force-dynamic'

import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { getLeagues, getRegistrations, getTeamPointsOverrides } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { db } from '@/lib/db'
import LigasPageContent from './ligas-content'
import { getSimulators } from '@/lib/data/simulators'

interface Props {
  searchParams: Promise<{
    simulator?: string
    status?: string
    format?: string
    q?: string
  }>
}

export default async function LigasPage({ searchParams }: Props) {
  const session = await getCurrentUser()
  const access = await getAdminAccessContext(session?.userId)
  const isAdmin = access.canAccessPlatformAdmin

  const params = await searchParams
  const [leagues, registrations, teamsDashboard, teamIdRows] = await Promise.all([
    getLeagues(),
    getRegistrations(),
    getTeamsDashboard(),
    db.team.findMany({ select: { id: true } }).catch((e) => {
      console.error('Failed to fetch valid team ids:', e)
      return []
    }),
  ])
  const teamById = new Map(teamsDashboard.teams.map((team) => [team.id, team]))

  // Get all valid team IDs in the system to filter out orphan registrations
  const validTeamIds = new Set<string>(teamIdRows.map((t) => t.id))

  // Compute registered counts for leagues (unique teams/drivers per category)
  const registeredByLeague: Record<string, number> = {}
  const countedKeysByLeague = new Map<string, Set<string>>()

  for (const registration of registrations) {
    if (registration.status === 'rejected') continue
    if (registration.teamId && !validTeamIds.has(registration.teamId)) {
      continue
    }
    
    const leagueId = registration.leagueId
    if (!countedKeysByLeague.has(leagueId)) {
      countedKeysByLeague.set(leagueId, new Set<string>())
    }
    const countedKeys = countedKeysByLeague.get(leagueId)!
    
    // Grouping key: teamId or userId, and classTag
    const key = `${registration.teamId || registration.userId}_${registration.classTag || 'default'}`
    if (!countedKeys.has(key)) {
      countedKeys.add(key)
      registeredByLeague[leagueId] = (registeredByLeague[leagueId] || 0) + 1
    }
  }

  // Current points leader per league, for the season-directory card preview.
  // Leader is computed off the league's first class tag (the same one its
  // standings panel opens on) so the card and the detail page agree.
  const leaderByLeague = new Map<string, { name: string; logoUrl: string | null; points: number } | null>()
  await Promise.all(
    leagues.map(async (league) => {
      const primaryClass = (league.classTags || [])[0]
      if (!primaryClass) {
        leaderByLeague.set(league.id, null)
        return
      }
      const pointsMap = await getTeamPointsOverrides(league.id)
      // Dedupe per car (team + dorsal), not per team — a team can field more than one car
      // in the same class, and the real standings ladder ranks cars independently. Deduping
      // by team alone kept only whichever car happened to register first, so a team's actual
      // best-scoring car could lose the "leader" comparison to its own weaker entry.
      const seenCars = new Set<string>()
      let best: { name: string; logoUrl: string | null; points: number } | null = null
      for (const reg of registrations) {
        if (reg.leagueId !== league.id || reg.status === 'rejected') continue
        if (reg.classTag && reg.classTag !== primaryClass) continue
        if (!reg.teamId || !validTeamIds.has(reg.teamId)) continue
        const dorsal = reg.assignedNumber != null ? String(reg.assignedNumber) : ''
        const carKey = `${reg.teamId}_${dorsal}`
        if (seenCars.has(carKey)) continue
        seenCars.add(carKey)
        const points = pointsMap[`${primaryClass.toUpperCase()}_${reg.teamId}_${dorsal}`] || 0
        const team = teamById.get(reg.teamId)
        if (!team) continue
        if (!best || points > best.points) {
          best = { name: team.name, logoUrl: team.logoUrl || null, points }
        }
      }
      leaderByLeague.set(league.id, best)
    }),
  )

  // Map leagues to serializable structures
  const serializableLeagues = leagues.map((league) => ({
    id: league.id,
    title: league.title,
    slug: league.slug,
    simulator: league.simulator,
    format: league.format,
    classTags: league.classTags || [],
    startsAt: league.startsAt,
    endsAt: league.endsAt,
    registrationOpen: !!league.registrationOpen,
    status: league.status,
    bannerUrl: league.bannerUrl || null,
    logoUrl: league.logoUrl || null,
    accentColor: league.accentColor || null,
    shortDescription: league.shortDescription || '',
    fullDescription: league.fullDescription || '',
    leader: leaderByLeague.get(league.id) || null,
  }))

  return (
    <LigasPageContent
      simulators={await getSimulators()}
      initialLeagues={serializableLeagues}
      registeredByLeague={registeredByLeague}
      isAdmin={isAdmin}
      searchParams={params}
    />
  )
}
