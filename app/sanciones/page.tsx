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

  const [records, allTeams, teamCars, registrations] = await Promise.all([
    db.sanctionRecord.findMany({
      where: { leagueId: { in: visibleLeagueIds } },
      include: { event: { select: { title: true, circuitName: true } }, league: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    db.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    // El dorsal de un equipo es el de SU coche (TeamCar, lo que se configura en la ficha del
    // equipo) — no el número individual de inscripción del piloto, que es otra cosa.
    db.teamCar.findMany({ select: { dorsal: true, category: true, teamId: true, leagueId: true } }),
    // Qué equipos compiten en cada campeonato (Team.leagueId no se usa en la práctica — la
    // relación real sale de quién está inscrito, igual que en la ficha del equipo) y, de paso,
    // para intentar rellenar el nombre del piloto cuando coincide con el dorsal del coche.
    db.leagueRegistration.findMany({
      where: { leagueId: { in: visibleLeagueIds } },
      select: { leagueId: true, teamId: true, assignedNumber: true, displayName: true },
    }),
  ])

  const teamNameById = new Map(allTeams.map((t) => [t.id, t.name]))
  const driverByDorsal = new Map(
    registrations.filter((r) => r.assignedNumber != null).map((r) => [`${r.leagueId}|${r.assignedNumber}`, r.displayName])
  )

  // Qué ligas conoce cada equipo, a partir de sus pilotos inscritos — necesario para los coches
  // "por defecto" (sin liga propia) que valen para cualquier liga en la que compita el equipo.
  const leaguesByTeam = new Map<string, Set<string>>()
  for (const r of registrations) {
    if (!r.teamId) continue
    if (!leaguesByTeam.has(r.teamId)) leaguesByTeam.set(r.teamId, new Set())
    leaguesByTeam.get(r.teamId)!.add(r.leagueId)
  }

  const carEntries: { leagueId: string; dorsal: string; teamId: string; teamName: string; category: string; driverName: string | null }[] = []
  for (const c of teamCars) {
    if (!c.dorsal.trim()) continue
    const teamName = teamNameById.get(c.teamId)
    if (!teamName) continue
    const leagueIds = c.leagueId ? [c.leagueId] : Array.from(leaguesByTeam.get(c.teamId) || [])
    for (const leagueId of leagueIds) {
      if (!visibleLeagueIds.includes(leagueId)) continue
      carEntries.push({
        leagueId,
        dorsal: c.dorsal.trim(),
        teamId: c.teamId,
        teamName,
        category: c.category,
        driverName: driverByDorsal.get(`${leagueId}|${Number(c.dorsal)}`) || null,
      })
    }
  }

  // Equipos visibles por campeonato, para el desplegable manual — un equipo puede aparecer en
  // varios campeonatos, así que se repite una fila por cada uno (igual que hacen los coches).
  const teams: { id: string; name: string; leagueId: string }[] = []
  for (const [teamId, leagueIds] of leaguesByTeam) {
    const name = teamNameById.get(teamId)
    if (!name) continue
    for (const leagueId of leagueIds) {
      if (visibleLeagueIds.includes(leagueId)) teams.push({ id: teamId, name, leagueId })
    }
  }
  teams.sort((a, b) => a.name.localeCompare(b.name, 'es'))

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
