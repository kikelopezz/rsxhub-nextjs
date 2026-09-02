export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ClearStatusQuery } from '@/components/clear-status-query'
import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { getLeagues, getRegistrations, getLeagueEvents, getTeamPointsOverrides } from '@/lib/platform-data'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { formatFirestoreValue } from '@/lib/firestore-utils'
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
    !hasFirebase ||
    (session?.userId && (
      myTeamIds.includes(team.id) ||
      team.ownerUserId === session.userId ||
      isPlatformAdmin ||
      team.members.some((m) => m.userId === session.userId && (m.role === 'owner' || m.role === 'manager'))
    ))
  )
  const canDelete = Boolean(
    !hasFirebase ||
    (session?.userId && (
      team.ownerUserId === session.userId ||
      isPlatformAdmin
    ))
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

      {/* Banner + top stats */}
      <TeamBannerStats
        team={team}
        canManage={canManage}
        canDelete={canDelete}
        ownerDisplayName={ownerDisplayName}
        coOwners={coOwners}
        teamPilots={teamPilots}
        stats={stats}
        accentSoft={accentSoft}
        accentHard={accentHard}
        leagueParticipation={leagueParticipation}
      />

      {/* Status message */}
      {message ? (
        <div
          className={`border px-3 py-2 text-sm rounded-lg ${
            message.kind === 'ok'
              ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
              : message.kind === 'warn'
              ? 'border-amber-300/30 bg-amber-500/10 text-amber-100'
              : 'border-red-300/30 bg-red-500/10 text-red-100'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {/* Performance stats row */}
      <section className="grid gap-[1px] overflow-hidden border border-shell-line bg-shell-line md:grid-cols-5 rounded-lg">
        {[
          { label: tr.wins, value: stats.wins },
          { label: tr.podiums, value: stats.podiums },
          { label: tr.dnf, value: stats.dnf },
          { label: tr.dsq, value: stats.dsq },
          { label: tr.racesRun, value: stats.racesRun },
        ].map((item) => (
          <div key={item.label} className="bg-[#0b1320] p-4 rounded-lg">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
            <p className="mt-1 text-4xl font-black italic text-white">{item.value}</p>
          </div>
        ))}
      </section>

      {/* Drivers + Vehicles */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <TeamDriversSection
          team={team}
          canManage={canManage}
          teamPilots={teamPilots}
          pendingApplications={pendingApplications}
          inviteCandidates={inviteCandidates}
          accentSoft={accentSoft}
        />
        <TeamVehiclesSection
          team={team}
          canManage={canManage}
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
        <Link href="/equipos" className="border border-shell-line bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 rounded-lg">
          {tr.backToTeams}
        </Link>
      </div>
    </div>
  )
}
