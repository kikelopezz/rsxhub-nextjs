export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ClearStatusQuery } from '@/components/clear-status-query'
import { StatusBanner } from '@/components/status-banner'
import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { getLeagues, getRegistrations, getLeagueEvents, getTeamPointsOverrides } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { profileStatusMessage, hexToRgba } from './team-utils'
import type { TeamStats, TeamPilot, LeagueParticipation, RecentResult, PendingApplication } from './team-utils'
import type { LeagueOption } from '@/components/team-cars-editor'
import { fetchTeamProfileData } from './team-profile-data'
import { TeamBannerStats } from './components/team-banner-stats'
import { TeamDriversSection } from './components/team-drivers-section'
import { TeamVehiclesSection } from './components/team-vehicles-section'
import { TeamLeaguesSection } from './components/team-leagues-section'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export default async function TeamProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ updated?: string; invite?: string; memberRemoved?: string; roleUpdated?: string; error?: string }>
}) {
  const { id } = await params
  const qs = await searchParams
  const dict = getDictionary(await getLocale())
  const tr = dict.equipos.profile
  const [leagues, session] = await Promise.all([getLeagues(), getCurrentUser()])
  const [{ teams, myTeamIds }, access] = await Promise.all([
    getTeamsDashboard(session?.userId),
    getAdminAccessContext(session?.userId),
  ])
  const team = teams.find((item) => item.id === id)

  if (!team) return notFound()

  // ── Taken dorsals (other teams) ────────────────────────────────────────────
  const takenDorsals: Array<{ teamId: string; teamName: string; category: string; dorsal: string; leagueId?: string | null }> = []
  for (const t of teams) {
    if (t.id !== team.id && Array.isArray(t.cars)) {
      for (const c of t.cars) {
        if (c && c.dorsal) {
          takenDorsals.push({
            teamId: t.id,
            teamName: t.name || tr.otherTeamFallback,
            category: c.category || '',
            dorsal: String(c.dorsal).trim(),
            leagueId: c.leagueId || null,
          })
        }
      }
    }
  }

  const leaguesOptions: LeagueOption[] = leagues.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    classTags: l.classTags || [],
  }))

  const isPlatformAdmin = access.canAccessPlatformAdmin

  const canManage = Boolean(
    session?.userId && (
      myTeamIds.includes(team.id) ||
      team.ownerUserId === session.userId ||
      isPlatformAdmin ||
      team.members.some((m) => m.userId === session.userId && (m.role === 'owner' || m.role === 'manager'))
    )
  )
  const canDelete = Boolean(
    session?.userId && (
      team.ownerUserId === session.userId ||
      isPlatformAdmin
    )
  )

  const message = profileStatusMessage(qs, dict.equipos.profileMessages)
  const ownerMember =
    team.members.find((member) => member.role === 'owner') ||
    team.members.find((member) => member.userId === team.ownerUserId)
  const ownerDisplayName =
    ownerMember?.displayName || ownerMember?.steamDisplayName || ownerMember?.steamId || ownerMember?.userId || tr.notAvailable
  const existingMemberUserIds = new Set(team.members.map((member) => member.userId))
  const memberUserIds = team.members.map((member) => member.userId)

  const {
    teamPilots,
    pendingApplications,
    inviteCandidates,
    recentResults,
    leagueParticipation,
    stats,
  } = await fetchTeamProfileData(team)

  // `team` comes from the platform-wide dashboard, whose pending invites (invited SteamID + the
  // private invite message) must not be serialized into the page for visitors who can't manage
  // this team — no client component reads them for anyone else.
  const clientTeam = canManage ? team : { ...team, invites: [] }

  // ── Derived values ─────────────────────────────────────────────────────────
  const accent = team.accentColor || team.primaryColor || '#1274de'
  const accentSoft = hexToRgba(accent, 0.28)
  const accentHard = hexToRgba(accent, 0.62)

  const coOwners = (teamPilots.length > 0 ? teamPilots : team.members.map((member: any) => ({
    name: member.displayName || member.steamDisplayName || member.steamId || member.userId,
    role: member.role,
  })))
    .filter((p: any) => p.role === 'manager')
    .map((p: any) => p.name)

  const teamMembersOptions = (teamPilots.length > 0 ? teamPilots : team.members.map((member: any) => ({
    userId: member.userId,
    name: member.displayName || member.steamDisplayName || member.steamId || member.userId,
    steamId: member.steamId || '',
  }))).map((p: any) => ({
    userId: p.userId,
    name: p.name,
    steamId: p.steamId || '',
  }))

  return (
    <div className="space-y-4 text-white">
      <ClearStatusQuery />

      {qs.error === 'lineup-locked-qualy-day' && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">
          {tr.lineupLockedQualyDay}
        </div>
      )}
      {qs.error === 'lineup-rate-limited' && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">
          {tr.lineupRateLimited}
        </div>
      )}

      {/* Banner + top stats */}
      <TeamBannerStats
        team={clientTeam}
        canManage={canManage}
        canDelete={canDelete}
        ownerDisplayName={ownerDisplayName}
        coOwners={coOwners}
        teamPilots={teamPilots}
        stats={stats}
        accentSoft={accentSoft}
        accentHard={accentHard}
      />

      {/* Status message */}
      <StatusBanner message={message} />

      {/* Performance stats row */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-5">
        {[
          { label: tr.wins, value: stats.wins },
          { label: tr.podiums, value: stats.podiums },
          { label: tr.dnf, value: stats.dnf },
          { label: tr.dsq, value: stats.dsq },
          { label: tr.racesRun, value: stats.racesRun },
        ].map((item) => (
          <div key={item.label} className="bg-[#0f0f12] p-4 text-center">
            <p className="font-display-league text-4xl leading-none text-white">{item.value}</p>
            <p className="mt-2 font-mono-data text-[10px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
          </div>
        ))}
      </section>

      {/* Drivers + Vehicles */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <TeamDriversSection
          team={clientTeam}
          canManage={canManage}
          teamPilots={teamPilots}
          pendingApplications={pendingApplications}
          inviteCandidates={inviteCandidates}
          accentSoft={accentSoft}
          accentHard={accentHard}
        />
        <TeamVehiclesSection
          team={clientTeam}
          canManage={canManage}
          isAdmin={isPlatformAdmin}
          accentHard={accentHard}
          takenDorsals={takenDorsals}
          leaguesOptions={leaguesOptions}
          teamMembersOptions={teamMembersOptions}
          leagues={leagues}
        />
      </section>

      {/* Leagues + Results */}
      <TeamLeaguesSection
        leagueParticipation={leagueParticipation}
        recentResults={recentResults}
        accentHard={accentHard}
      />

      <div>
        <Link href="/equipos" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-display-condensed text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10">
          {tr.backToTeams}
        </Link>
      </div>
    </div>
  )
}
