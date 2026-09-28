import { createSanctionAction, deleteSanctionAction } from '../actions/admin-sanctions'
import { AdminSanctionsTable } from './admin-sanctions-table'

type League = { id: string; title: string }
type EventRow = { id: string; leagueId: string; title?: string | null; circuitName?: string | null }
type TeamRow = { id: string; name: string; leagueId: string | null }
type SanctionRow = {
  id: string
  leagueId: string
  eventId: string | null
  teamId: string | null
  driverName: string | null
  teamNameSnapshot: string | null
  sanctionType: string
  reason: string
  createdByName: string
  createdAt: Date
  event: { title: string | null; circuitName: string } | null
  league: { title: string }
}

type Props = {
  records: SanctionRow[]
  leagues: League[]
  events: EventRow[]
  teams: TeamRow[]
}

export function AdminSanctionsTab({ records, leagues, events, teams }: Props) {
  const dtoRecords = records.map((r) => ({
    id: r.id,
    leagueId: r.leagueId,
    leagueTitle: r.league.title,
    eventId: r.eventId,
    eventTitle: r.event ? r.event.title || r.event.circuitName : null,
    teamId: r.teamId,
    driverName: r.driverName,
    teamNameSnapshot: r.teamNameSnapshot,
    sanctionType: r.sanctionType,
    reason: r.reason,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
      <div className="border-b border-shell-line pb-3">
        <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Sanciones</h2>
        <p className="text-xs text-slate-400">Registro de sanciones de los comisarios (race directors), por campeonato, exportable a Excel.</p>
      </div>

      <AdminSanctionsTable
        records={dtoRecords}
        leagues={leagues}
        events={events.map((e) => ({ id: e.id, leagueId: e.leagueId, label: e.title || e.circuitName || 'Evento' }))}
        teams={teams}
        createAction={createSanctionAction}
        deleteAction={deleteSanctionAction}
      />
    </section>
  )
}
