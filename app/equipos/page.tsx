export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/auth'
import { getLeagues } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { toPublicTeamListing } from '@/lib/team-privacy'
import { createTeam } from './actions'
import EquiposContent from './equipos-content'
import { ClearStatusQuery } from '@/components/clear-status-query'
import { StatusBanner } from '@/components/status-banner'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import type { Dictionary } from '@/lib/i18n/dictionaries/es'
import type { StatusMessage } from '@/components/status-banner'

function statusMessage(
  params: {
    created?: string
    updated?: string
    invite?: string
    memberRemoved?: string
    error?: string
    mode?: string
  },
  m: Dictionary['equipos']['messages']
): StatusMessage {
  if (params.mode === 'mock') return { kind: 'warn', text: m.demoMode }
  if (params.created === '1') return { kind: 'ok', text: m.teamCreated }
  if (params.updated === '1') return { kind: 'ok', text: m.teamUpdated }
  if (params.invite === '1') return { kind: 'ok', text: m.inviteSent }
  if (params.memberRemoved === '1') return { kind: 'ok', text: m.driverRemoved }
  if (params.error === 'already-member') return { kind: 'warn', text: m.alreadyMember }
  if (params.error === 'already-in-a-team') return { kind: 'warn', text: m.alreadyInATeam }
  if (params.error === 'owner-protected') return { kind: 'warn', text: m.ownerProtected }
  if (params.error) return { kind: 'error', text: m.actionFailed }
  return null
}

export default async function EquiposPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string
    updated?: string
    invite?: string
    memberRemoved?: string
    error?: string
    mode?: string
  }>
}) {
  const params = await searchParams
  const session = await getCurrentUser()
  const [leagues, { teams, myTeamIds }] = await Promise.all([
    getLeagues(),
    getTeamsDashboard(session?.userId),
  ])
  const dict = getDictionary(await getLocale())
  const message = statusMessage(params, dict.equipos.messages)

  const belongsToTeam = session ? teams.some((team: any) =>
    team.ownerUserId === session.userId ||
    (Array.isArray(team.members) && team.members.some((m: any) => m.userId === session.userId))
  ) : false

  // Only admin-approved teams are shown on the public listing; a team the
  // caller owns/belongs to stays visible to them even while pending review.
  const visibleTeams = teams.filter((team: any) => {
    const status = team.status || 'approved'
    if (status === 'approved') return true
    if (!session) return false
    return team.ownerUserId === session.userId || (Array.isArray(team.members) && team.members.some((m: any) => m.userId === session.userId))
  })

  const myPendingTeam = session
    ? teams.find((team: any) => (team.status || 'approved') === 'pending' && (
        team.ownerUserId === session.userId ||
        (Array.isArray(team.members) && team.members.some((m: any) => m.userId === session.userId))
      ))
    : null

  const leaguesOptions = leagues.map((league) => ({
    slug: league.slug,
    title: league.title,
  }))

  return (
    <div className="space-y-4">
      <ClearStatusQuery />
      <StatusBanner message={message} />

      {myPendingTeam && (
        <div className="border border-amber-500/30 bg-amber-500/10 text-amber-100 px-4 py-3 text-sm rounded-lg shadow-md">
          {dict.equipos.messages.teamPendingBanner}
        </div>
      )}

      <EquiposContent
        teams={visibleTeams.map(toPublicTeamListing) as any}
        leagues={leaguesOptions}
        createTeamAction={createTeam}
        session={session}
        hasOwnedTeam={myTeamIds.length > 0}
        belongsToTeam={belongsToTeam}
      />
    </div>
  )
}
