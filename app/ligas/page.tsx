export const dynamic = 'force-dynamic'

import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { getLeagues, getRegistrations, getTeamPointsOverrides } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import LigasPageContent from './ligas-content'

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
  const [leagues, registrations, teamsDashboard] = await Promise.all([
    getLeagues(),
    getRegistrations(),
    getTeamsDashboard(),
  ])
  const teamById = new Map(teamsDashboard.teams.map((team) => [team.id, team]))

  // Get all valid team IDs in the system to filter out orphan registrations
  const { getFirestoreDb, hasFirebase } = await import('@/lib/firebase')
  const validTeamIds = new Set<string>()
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const teamsSnap = await db.collection('teams').select('id').get()
        teamsSnap.docs.forEach((doc: any) => validTeamIds.add(doc.id))
      } catch (e) {
        console.error('Failed to fetch valid teams in Firebase:', e)
      }
    }
  } else {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_teams')?.value
      const allMockTeams: any[] = existing ? JSON.parse(existing) : []
      allMockTeams.forEach((t) => validTeamIds.add(t.id))
    } catch (e) {
      console.error('Failed to fetch valid mock teams:', e)
    }
  }

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
      const seenTeams = new Set<string>()
      let best: { name: string; logoUrl: string | null; points: number } | null = null
      for (const reg of registrations) {
        if (reg.leagueId !== league.id || reg.status === 'rejected') continue
        if (reg.classTag && reg.classTag !== primaryClass) continue
        if (!reg.teamId || seenTeams.has(reg.teamId) || !validTeamIds.has(reg.teamId)) continue
        seenTeams.add(reg.teamId)
        const points = pointsMap[`${primaryClass.toUpperCase()}_${reg.teamId}`] || 0
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
      initialLeagues={serializableLeagues}
      registeredByLeague={registeredByLeague}
      isAdmin={isAdmin}
      searchParams={params}
    />
  )
}
