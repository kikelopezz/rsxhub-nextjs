'use client'

import { useMemo, useState } from 'react'
import { SANCTION_TYPES, SANCTION_TYPE_LABELS, type SanctionType } from '@/lib/sanctions'

type League = { id: string; title: string }
type EventOption = { id: string; leagueId: string; label: string }
type TeamOption = { id: string; name: string; leagueId: string | null }
type SanctionDTO = {
  id: string
  leagueId: string
  leagueTitle: string
  eventId: string | null
  eventTitle: string | null
  teamId: string | null
  driverName: string | null
  teamNameSnapshot: string | null
  sanctionType: string
  reason: string
  createdByName: string
  createdAt: string
}

type Props = {
  records: SanctionDTO[]
  leagues: League[]
  events: EventOption[]
  teams: TeamOption[]
  createAction: (formData: FormData) => void | Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
}

export function AdminSanctionsTable({ records, leagues, events, teams, createAction, deleteAction }: Props) {
  const [leagueFilter, setLeagueFilter] = useState('all')

  const filteredRecords = leagueFilter === 'all' ? records : records.filter((r) => r.leagueId === leagueFilter)
  const leagueEvents = useMemo(() => events.filter((e) => e.leagueId === leagueFilter), [events, leagueFilter])
  const leagueTeams = useMemo(() => teams.filter((t) => t.leagueId === leagueFilter), [teams, leagueFilter])

  const exportHref = leagueFilter === 'all' ? '/admin/sanciones/export' : `/admin/sanciones/export?leagueId=${leagueFilter}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Filtrar por campeonato</label>
          <select
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="rounded-lg border border-shell-line bg-black/45 px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none cursor-pointer focus:border-white/30"
          >
            <option value="all">Todos los campeonatos</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>{league.title}</option>
            ))}
          </select>
        </div>
        <a href={exportHref} className="border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 rounded-lg transition-colors">
          Exportar a Excel {leagueFilter !== 'all' ? '(este campeonato)' : '(todos)'}
        </a>
      </div>

      {leagueFilter === 'all' ? (
        <p className="text-xs text-slate-500 italic">Elige un campeonato arriba para poder registrar una sanción nueva.</p>
      ) : (
        <form action={createAction} className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-shell-line bg-black/20 p-4 rounded-lg">
          <input type="hidden" name="leagueId" value={leagueFilter} />

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Piloto</label>
            <input name="driverName" type="text" placeholder="Nombre del piloto" className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Equipo</label>
            <select name="teamId" defaultValue="" className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30">
              <option value="">— Sin equipo / a título individual —</option>
              {leagueTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input name="teamNameSnapshot" type="text" placeholder="O escribe el nombre del equipo si no está en la lista de arriba" className="mt-1.5 w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Carrera (opcional)</label>
            <select name="eventId" defaultValue="" className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30">
              <option value="">— General / fuera de carrera —</option>
              {leagueEvents.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tipo de sanción</label>
            <select name="sanctionType" defaultValue="warning" required className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30">
              {SANCTION_TYPES.map((type) => (
                <option key={type} value={type}>{SANCTION_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Motivo</label>
            <textarea name="reason" required rows={3} placeholder="Qué ha pasado y por qué se sanciona" className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30" />
          </div>

          <div className="md:col-span-2">
            <button type="submit" className="border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 rounded-lg transition-colors cursor-pointer">
              Registrar sanción
            </button>
          </div>
        </form>
      )}

      {filteredRecords.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No hay ninguna sanción registrada{leagueFilter !== 'all' ? ' en este campeonato' : ''}.</p>
      ) : (
        <div className="overflow-x-auto border border-shell-line bg-black/10">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="border-b border-shell-line bg-black/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="p-2.5">Fecha</th>
                <th className="p-2.5">Campeonato</th>
                <th className="p-2.5">Piloto</th>
                <th className="p-2.5">Equipo</th>
                <th className="p-2.5">Carrera</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Motivo</th>
                <th className="p-2.5">Puesta por</th>
                <th className="p-2.5 text-right">—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {filteredRecords.map((r) => (
                <tr key={r.id}>
                  <td className="p-2.5 whitespace-nowrap text-slate-400">{new Date(r.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="p-2.5 text-slate-400">{r.leagueTitle}</td>
                  <td className="p-2.5 font-bold text-white">{r.driverName || '—'}</td>
                  <td className="p-2.5">{r.teamNameSnapshot || '—'}</td>
                  <td className="p-2.5">{r.eventTitle || '—'}</td>
                  <td className="p-2.5">
                    <span className="inline-block px-1.5 py-0.5 border border-rose-500/40 bg-rose-500/10 text-rose-300 text-[9px] font-extrabold uppercase tracking-wider">
                      {SANCTION_TYPE_LABELS[r.sanctionType as SanctionType] || r.sanctionType}
                    </span>
                  </td>
                  <td className="p-2.5 max-w-[280px]">{r.reason}</td>
                  <td className="p-2.5 text-slate-400">{r.createdByName}</td>
                  <td className="p-2.5 text-right">
                    <form action={deleteAction}>
                      <input type="hidden" name="leagueId" value={r.leagueId} />
                      <input type="hidden" name="id" value={r.id} />
                      <button className="border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-rose-300 rounded transition-colors cursor-pointer">
                        Borrar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
