import { getAdminAccessContext, getCurrentUser } from '@/lib/auth'
import { getLeagueEvents, getLeagues } from '@/lib/platform-data'
import { db } from '@/lib/db'
import { createSanctionAction, deleteSanctionAction } from './actions'
import { SanctionsTable } from './sanctions-table'

export default async function SanctionsPage({ searchParams }: { searchParams: Promise<{ leagueId?: string }> }) {
  // Acceso ya comprobado en el layout — aquí solo hace falta saber qué campeonatos puede ver.
  const session = await getCurrentUser()
  const access = await getAdminAccessContext(session!.userId)
  const isPlatformAdmin = access.canAccessPlatformAdmin

  const qs = await searchParams

  const [allLeagues, allEvents] = await Promise.all([getLeagues(), getLeagueEvents()])
  const visibleLeagues = isPlatformAdmin ? allLeagues : allLeagues.filter((l) => access.managedLeagueIds.includes(l.id))
  const visibleLeagueIds = visibleLeagues.map((l) => l.id)
  const visibleEvents = isPlatformAdmin ? allEvents : allEvents.filter((e) => visibleLeagueIds.includes(e.leagueId))

  const [records, teams, registrations] = await Promise.all([
    db.sanctionRecord.findMany({
      where: { leagueId: { in: visibleLeagueIds } },
      include: { event: { select: { title: true, circuitName: true } }, league: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    db.team.findMany({ where: { leagueId: { in: visibleLeagueIds } }, select: { id: true, name: true, leagueId: true }, orderBy: { name: 'asc' } }),
    // Para poder resolver "dorsal -> equipo/piloto" al registrar una sanción.
    db.leagueRegistration.findMany({
      where: { leagueId: { in: visibleLeagueIds }, assignedNumber: { not: null } },
      select: { leagueId: true, assignedNumber: true, displayName: true, classTag: true, teamId: true, team: { select: { name: true } } },
    }),
  ])

  const dtoRecords = records.map((r) => ({
    id: r.id,
    leagueId: r.leagueId,
    leagueTitle: r.league.title,
    eventId: r.eventId,
    eventTitle: r.event ? r.event.title || r.event.circuitName : null,
    teamId: r.teamId,
    dorsal: r.dorsal,
    driverName: r.driverName,
    teamNameSnapshot: r.teamNameSnapshot,
    sanctionType: r.sanctionType,
    reason: r.reason,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <SanctionsTable
        records={dtoRecords}
        leagues={visibleLeagues}
        events={visibleEvents.map((e) => ({ id: e.id, leagueId: e.leagueId, label: e.title || e.circuitName || 'Evento' }))}
        teams={teams}
        entries={registrations.map((r) => ({
          leagueId: r.leagueId,
          dorsal: r.assignedNumber as number,
          driverName: r.displayName,
          classTag: r.classTag,
          teamId: r.teamId,
          teamName: r.team?.name ?? null,
        }))}
        initialLeagueId={qs.leagueId}
        createAction={createSanctionAction}
        deleteAction={deleteSanctionAction}
      />
    </section>
  )
}
