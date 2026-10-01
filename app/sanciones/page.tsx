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

  const [records, teams, teamCars, registrations] = await Promise.all([
    db.sanctionRecord.findMany({
      where: { leagueId: { in: visibleLeagueIds } },
      include: { event: { select: { title: true, circuitName: true } }, league: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    db.team.findMany({ where: { leagueId: { in: visibleLeagueIds } }, select: { id: true, name: true, leagueId: true }, orderBy: { name: 'asc' } }),
    // El dorsal de un equipo es el de SU coche (TeamCar, lo que se configura en la ficha del
    // equipo) — no el número individual de inscripción del piloto, que es otra cosa.
    db.teamCar.findMany({
      where: { team: { leagueId: { in: visibleLeagueIds } } },
      select: { dorsal: true, category: true, teamId: true, leagueId: true, team: { select: { name: true, leagueId: true } } },
    }),
    // Para intentar rellenar también el nombre del piloto cuando coincide con el dorsal del coche.
    db.leagueRegistration.findMany({
      where: { leagueId: { in: visibleLeagueIds }, assignedNumber: { not: null } },
      select: { leagueId: true, assignedNumber: true, displayName: true },
    }),
  ])

  const driverByDorsal = new Map(registrations.map((r) => [`${r.leagueId}|${r.assignedNumber}`, r.displayName]))
  // leagueId null en el coche = coche "por defecto" del equipo, válido para cualquier liga en la
  // que compita; leagueId fijo = coche específico para esa liga (p. ej. otra categoría/dorsal ahí).
  const carEntries = teamCars
    .filter((c) => c.dorsal.trim() && (c.leagueId === null || c.leagueId === c.team.leagueId))
    .map((c) => ({
      leagueId: c.team.leagueId!,
      dorsal: c.dorsal.trim(),
      teamId: c.teamId,
      teamName: c.team.name,
      category: c.category,
      driverName: driverByDorsal.get(`${c.team.leagueId}|${Number(c.dorsal)}`) || null,
    }))
    .filter((c) => c.leagueId)

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
        entries={carEntries}
        initialLeagueId={qs.leagueId}
        createAction={createSanctionAction}
        deleteAction={deleteSanctionAction}
      />
    </section>
  )
}
