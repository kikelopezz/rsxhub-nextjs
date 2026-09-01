export const dynamic = 'force-dynamic'

import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { getLeagues, getRegistrations } from '@/lib/platform-data'
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
  const [leagues, registrations] = await Promise.all([getLeagues(), getRegistrations()])

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
    shortDescription: league.shortDescription || '',
    fullDescription: league.fullDescription || '',
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
