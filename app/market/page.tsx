import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { getTeamsDashboard } from '@/lib/team-data'
import { getLeagues } from '@/lib/platform-data'
import { db } from '@/lib/db'
import type { SessionUser } from '@/types'
import MarketPageContent from './market-content'

async function fetchListings(): Promise<any[]> {
  try {
    const [teams, rawListings] = await Promise.all([
      db.team.findMany({ select: { id: true, primaryColor: true } }),
      db.marketListing.findMany({ orderBy: { createdAt: 'desc' } }),
    ])

    const teamsColors = new Map(teams.map((t) => [t.id, t.primaryColor]))
    const existingTeamIds = new Set(teams.map((t) => t.id))

    const posterUserIds = Array.from(new Set(rawListings.map((r) => r.userId).filter(Boolean)))
    const profiles = posterUserIds.length > 0 ? await db.profile.findMany({ where: { userId: { in: posterUserIds } } }) : []
    const profileCountryMap = new Map(profiles.map((p) => [p.userId, p.countryCode]))

    // Filter out listings of deleted teams and delete the orphaned rows.
    const orphanIds: string[] = []
    const validRawListings = rawListings.filter((data) => {
      if (data.type === 'team_seeking_driver' && data.teamId) {
        const exists = existingTeamIds.has(data.teamId)
        if (!exists) orphanIds.push(data.id)
        return exists
      }
      return true
    })
    if (orphanIds.length > 0) {
      db.marketListing.deleteMany({ where: { id: { in: orphanIds } } }).catch(() => null)
    }

    return validRawListings.map((data) => ({
      id: data.id,
      type: data.type,
      user_id: data.userId,
      user_name: data.userName,
      user_avatar: data.userAvatar,
      country_code: data.countryCode || profileCountryMap.get(data.userId) || 'ES',
      team_id: data.teamId,
      team_name: data.teamName,
      team_logo: data.teamLogo,
      team_color: data.teamId ? teamsColors.get(data.teamId) || null : null,
      league_id: data.leagueId,
      league_title: data.leagueTitle,
      title: data.title,
      description: data.description,
      main_sim: data.mainSim,
      class_tag: data.classTag,
      contact_info: data.contactInfo,
      created_at: data.createdAt.toISOString(),
    }))
  } catch (error) {
    console.error('Failed to get market listings:', error)
    return []
  }
}

async function fetchUserTeamStatus(session: SessionUser | null): Promise<{ myTeams: any[]; belongsToTeam: boolean }> {
  let myTeams: any[] = []
  let belongsToTeam = false

  if (session) {
    try {
      const dashboard = await getTeamsDashboard(session.userId)
      if (dashboard && Array.isArray(dashboard.teams)) {
        myTeams = dashboard.teams
          .filter((team) => dashboard.myTeamIds.includes(team.id))
          .map((team) => ({ id: team.id, name: team.name, logoUrl: team.logoUrl || null }))

        belongsToTeam = dashboard.teams.some(
          (team) => team.ownerUserId === session.userId || team.members.some((m) => m.userId === session.userId),
        )
      }
    } catch (error) {
      console.error('Failed to load user teams for marketplace:', error)
    }
  }

  return { myTeams, belongsToTeam }
}

async function fetchMarketAppsAndInvites(session: SessionUser | null): Promise<{ applications: any[]; invites: any[] }> {
  let applications: any[] = []
  let invites: any[] = []

  try {
    const sessUserClean = session ? String(session.userId || '').replace(/^steam_/, '') : ''
    const sessSteamClean = session ? String(session.steamId || '').replace(/^steam_/, '') : ''

    const [appRows, inviteRows] = await Promise.all([
      sessUserClean
        ? db.marketApplication.findMany({ where: { userId: { in: Array.from(new Set([session!.userId, session!.steamId])) } } })
        : Promise.resolve([]),
      db.teamInvite.findMany({ where: { status: 'pending' } }),
    ])

    applications = appRows
      .map((d) => ({
        id: d.id,
        listingId: d.listingId,
        teamId: d.teamId || '',
        userId: d.userId,
        userName: d.userName,
        userAvatar: d.userAvatar,
        contactInfo: d.contactInfo,
        status: d.status,
        message: d.message || '',
        createdAt: d.createdAt.toISOString(),
      }))
      .filter((app) => {
        const appUserClean = String(app.userId || '').replace(/^steam_/, '')
        return appUserClean === sessUserClean || appUserClean === sessSteamClean
      })

    const teamIds = Array.from(new Set(inviteRows.map((i) => i.teamId).filter(Boolean)))
    const teams = teamIds.length > 0 ? await db.team.findMany({ where: { id: { in: teamIds } } }) : []
    const teamDocsMap = new Map(teams.map((t) => [t.id, { name: t.name, logoUrl: t.logoUrl }]))

    invites = inviteRows.map((d) => {
      const teamInfo = teamDocsMap.get(d.teamId)
      return {
        id: d.id,
        listingId: d.listingId || '',
        teamId: d.teamId,
        teamName: teamInfo?.name || 'Team',
        teamLogo: teamInfo?.logoUrl || null,
        invitedUserId: d.invitedUserId || '',
        invitedByUserId: d.invitedByUserId,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      }
    })
  } catch (err) {
    console.error('Failed to fetch market apps/invites:', err)
  }

  return { applications, invites }
}

export default async function MarketPage() {
  const session = await getCurrentUser()

  const [listings, { myTeams, belongsToTeam }, { applications, invites }, leagues, access] = await Promise.all([
    fetchListings(),
    fetchUserTeamStatus(session),
    fetchMarketAppsAndInvites(session),
    getLeagues(),
    getAdminAccessContext(session?.userId),
  ])

  const leagueOptions = leagues.map((l) => ({ id: l.id, title: l.title }))

  const currentUser = session
    ? {
        userId: session.userId,
        steamDisplayName: session.steamDisplayName,
        avatarUrl: session.avatarUrl ?? null,
      }
    : null

  return (
    <div className="space-y-4">
      <MarketPageContent
        listings={listings}
        currentUser={currentUser}
        myTeams={myTeams}
        applications={applications}
        invites={invites}
        belongsToTeam={belongsToTeam}
        leagues={leagueOptions}
        isAdmin={access.canAccessPlatformAdmin}
      />
    </div>
  )
}
