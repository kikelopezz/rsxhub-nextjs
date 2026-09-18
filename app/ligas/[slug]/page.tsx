import { notFound } from 'next/navigation'
import { getCurrentUser, getAdminAccessContext, canStewardLeague } from '@/lib/auth'
import { getLeagueBySlug, getLeagueCars, getLeagueEvents, getRegistrations, getEventConfirmations, getTeamPointsOverrides, getCarPhotoOverrides } from '@/lib/platform-data'
import { getTeamsDashboard, getSkinReviewStatusByLeague } from '@/lib/team-data'
import LeagueDetailPageContent from './page-content'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function LigaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [league, session] = await Promise.all([getLeagueBySlug(slug), getCurrentUser()])

  if (!league) return notFound()

  // All of these only depend on `league`/`session` above, not on each other — run concurrently.
  const [access, events, leagueCars, registrations, confirmations, initialPointsOverrides, initialCarPhotos, teamsDashboard, skinReviewStatus] = await Promise.all([
    getAdminAccessContext(session?.userId),
    getLeagueEvents(league.id),
    getLeagueCars(league.id),
    getRegistrations(league.id),
    getEventConfirmations(league.id),
    getTeamPointsOverrides(league.id),
    getCarPhotoOverrides(league.id),
    getTeamsDashboard(session?.userId),
    getSkinReviewStatusByLeague(league.id),
  ])
  const isAdmin = access.canAccessPlatformAdmin
  const isSteward = canStewardLeague(access.platformRole) || access.managedLeagueIds.includes(league.id)
  const canEditPoints = isAdmin || isSteward

  const { teams, myTeamIds } = teamsDashboard
  const managedTeams = teams.filter((team) => myTeamIds.includes(team.id))

  const teamInfoById = new Map<
    string,
    {
      name: string
      primaryColor: string | null
      logoUrl: string | null
      cars?: any[]
      members?: any[]
      skinAssignments?: any[]
    }
  >()

  for (const t of teams) {
    teamInfoById.set(t.id, {
      name: t.name,
      primaryColor: t.primaryColor || null,
      logoUrl: t.logoUrl || null,
      cars: t.cars || [],
      members: t.members || [],
      skinAssignments: t.skinAssignments || [],
    })
  }

  // Map to serializable structures
  const serializableLeague = {
    id: league.id,
    title: league.title,
    slug: league.slug,
    simulator: league.simulator,
    format: league.format,
    classTags: league.classTags || [],
    startsAt: league.startsAt,
    endsAt: league.endsAt,
    classLimits: league.classLimits || null,
    registrationOpen: !!league.registrationOpen,
    fullDescription: league.fullDescription || '',
    status: league.status,
    bannerUrl: league.bannerUrl || null,
    logoUrl: (league as any).logoUrl || null,
    accentColor: (league as any).accentColor || null,
    slogan: (league as any).slogan || null,
    discordUrl: (league as any).discordUrl || null,
    youtubeUrl: (league as any).youtubeUrl || null,
    rulebookUrl: (league as any).rulebookUrl || null,
    driveUrl: (league as any).driveUrl || null,
  }

  const serializableEvents = events.map((e) => ({
    id: e.id,
    leagueId: e.leagueId,
    circuitId: e.circuitId ?? null,
    title: e.title ?? null,
    circuitName: e.circuitName,
    circuitImageUrl: e.circuitImageUrl ?? null,
    serverLink: e.serverLink ?? null,
    hasQualy: e.hasQualy ?? true,
    qualyStartsAt: e.qualyStartsAt ?? null,
    qualyEndsAt: e.qualyEndsAt ?? null,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    status: e.status,
    eventType: e.eventType ?? 'race',
    countryCode: e.countryCode ?? null,
    color: (e as any).color ?? null,
    maxDrivers: (e as any).maxDrivers ?? null,
    classLimits: (e as any).classLimits ?? null,
    qualyCompleted: (e as any).qualyCompleted ?? false,
    completedAt: (e as any).completedAt ?? null,
  }))

  const serializableSession = session
    ? {
        userId: session.userId,
        steamDisplayName: session.steamDisplayName,
      }
    : null

  const serializableRegistrations = registrations
    .filter((r) => !r.teamId || teamInfoById.has(r.teamId))
    .map((r) => ({
      id: r.id,
      leagueId: r.leagueId,
      userId: r.userId,
      teamId: r.teamId || null,
      displayName: r.displayName || '',
      steamId: r.steamId || '',
      classTag: r.classTag || null,
      assignedNumber: r.assignedNumber ?? null,
      status: r.status,
    }))

  const serializableManagedTeams = managedTeams.map((t) => ({
    id: t.id,
    name: t.name,
    logoUrl: t.logoUrl || null,
    status: (t as any).status || 'approved',
    members: t.members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName || (m as any).steamDisplayName || (m as any).steamId || m.userId,
      steamId: (m as any).steamId || (m as any).steam_id || '',
    })),
    cars: (t as any).cars || [],
  }))

  const serializableLeagueCars = leagueCars.map((c) => ({
    id: c.id,
    label: c.label,
    model: c.model,
  }))

  const serializableTeamInfo: Record<string, { name: string; primaryColor: string | null; logoUrl: string | null }> = {}
  teamInfoById.forEach((val, key) => {
    serializableTeamInfo[key] = val
  })

  const serializableConfirmations = confirmations.map((c) => ({
    id: c.id,
    eventId: c.eventId,
    leagueId: c.leagueId,
    teamId: c.teamId,
    classTag: c.classTag,
    carNumber: c.carNumber,
    carModel: c.carModel || '',
    driverUserIds: c.driverUserIds || [],
    status: c.status,
  }))

  return (
    <LeagueDetailPageContent
      league={serializableLeague}
      initialEvents={serializableEvents}
      isAdmin={isAdmin}
      isSteward={isSteward}
      canEditPoints={canEditPoints}
      session={serializableSession}
      initialRegistrations={serializableRegistrations}
      myManagedTeams={serializableManagedTeams}
      leagueCars={serializableLeagueCars}
      teamInfo={serializableTeamInfo}
      initialConfirmations={serializableConfirmations}
      initialPointsOverrides={initialPointsOverrides}
      initialCarPhotos={initialCarPhotos}
      skinReviewStatus={skinReviewStatus}
    />
  )
}
