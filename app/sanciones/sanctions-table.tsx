'use client'

import { useEffect, useMemo, useState } from 'react'
import { SANCTION_CODES, SANCTION_CODE_MEANINGS, SANCTION_RULEBOOK, formatSanctionType, type SanctionCode } from '@/lib/sanctions'

type League = { id: string; title: string }
type EventOption = { id: string; leagueId: string; label: string }
type TeamOption = { id: string; name: string; leagueId: string | null }
type EntryOption = { leagueId: string; dorsal: number; driverName: string; classTag: string | null; teamId: string | null; teamName: string | null }
type SanctionDTO = {
  id: string
  leagueId: string
  leagueTitle: string
  eventId: string | null
  eventTitle: string | null
  teamId: string | null
  dorsal: number | null
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
  entries: EntryOption[]
  initialLeagueId?: string
  createAction: (formData: FormData) => void | Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
}

export function SanctionsTable({ records, leagues, events, teams, entries, initialLeagueId, createAction, deleteAction }: Props) {
  const [leagueFilter, setLeagueFilter] = useState(initialLeagueId && leagues.some((l) => l.id === initialLeagueId) ? initialLeagueId : 'all')

  const filteredRecords = leagueFilter === 'all' ? records : records.filter((r) => r.leagueId === leagueFilter)
  const leagueEvents = useMemo(() => events.filter((e) => e.leagueId === leagueFilter), [events, leagueFilter])
  const leagueTeams = useMemo(() => teams.filter((t) => t.leagueId === leagueFilter), [teams, leagueFilter])
  const leagueEntries = useMemo(() => entries.filter((e) => e.leagueId === leagueFilter), [entries, leagueFilter])

  // Dorsal -> equipo/piloto
  const [dorsalInput, setDorsalInput] = useState('')
  const [teamId, setTeamId] = useState('')
  const [teamNameSnapshot, setTeamNameSnapshot] = useState('')
  const [driverName, setDriverName] = useState('')
  const dorsalMatches = useMemo(() => {
    const n = parseInt(dorsalInput, 10)
    if (!dorsalInput.trim() || Number.isNaN(n)) return []
    return leagueEntries.filter((e) => e.dorsal === n)
  }, [dorsalInput, leagueEntries])

  // Infracción -> motivo + códigos de sanción sugeridos
  const [articleCode, setArticleCode] = useState('')
  const [reason, setReason] = useState('')
  const [selectedCodes, setSelectedCodes] = useState<SanctionCode[]>([])

  // Al cambiar de campeonato, se limpia todo lo relativo al formulario anterior.
  useEffect(() => {
    setDorsalInput('')
    setTeamId('')
    setTeamNameSnapshot('')
    setDriverName('')
    setArticleCode('')
    setReason('')
    setSelectedCodes([])
  }, [leagueFilter])

  // Cuando el dorsal identifica a un único coche, se autorrellena el equipo y el piloto (siguen
  // siendo editables después, por si el comisario necesita corregirlos).
  useEffect(() => {
    if (dorsalMatches.length !== 1) return
    const match = dorsalMatches[0]
    setTeamId(match.teamId || '')
    setTeamNameSnapshot(match.teamName || '')
    setDriverName(match.driverName || '')
  }, [dorsalMatches])

  const applyArticle = (code: string) => {
    setArticleCode(code)
    if (!code) return
    for (const chapter of SANCTION_RULEBOOK) {
      const article = chapter.articles.find((a) => a.code === code)
      if (article) {
        setReason(`Art. ${article.code} — ${article.action}`)
        setSelectedCodes(article.sanction)
        return
      }
    }
  }

  const toggleCode = (code: SanctionCode) => {
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  const exportHref = leagueFilter === 'all' ? '/sanciones/export' : `/sanciones/export?leagueId=${leagueFilter}`

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
            <option value="all">Todos tus campeonatos</option>
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
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="teamNameSnapshot" value={teamNameSnapshot} />
          <input type="hidden" name="sanctionType" value={selectedCodes.join(' + ')} />

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Dorsal</label>
            <input
              name="dorsal"
              type="number"
              min={0}
              value={dorsalInput}
              onChange={(e) => setDorsalInput(e.target.value)}
              placeholder="Nº de coche"
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            {dorsalInput.trim() && (
              <p className={`mt-1 text-[11px] ${dorsalMatches.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {dorsalMatches.length === 0 && 'No se encontró ningún coche con ese dorsal en este campeonato. Escribe el equipo a mano abajo.'}
                {dorsalMatches.length === 1 && `✓ ${dorsalMatches[0].teamName || 'Sin equipo'} — ${dorsalMatches[0].driverName}${dorsalMatches[0].classTag ? ` (${dorsalMatches[0].classTag})` : ''}`}
                {dorsalMatches.length > 1 && 'Ese dorsal aparece en varias categorías — ajusta el equipo y el piloto a mano abajo.'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Piloto</label>
            <input
              name="driverName"
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Se detecta por el dorsal, o escríbelo a mano"
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Equipo</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="">— Sin equipo / a título individual —</option>
              {leagueTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input
              value={teamNameSnapshot}
              onChange={(e) => setTeamNameSnapshot(e.target.value)}
              type="text"
              placeholder="O escribe el nombre del equipo si no está en la lista de arriba"
              className="mt-1.5 w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            />
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
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Infracción (opcional, autorrellena motivo y sanción)</label>
            <select
              value={articleCode}
              onChange={(e) => applyArticle(e.target.value)}
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="">— Elige un artículo del reglamento —</option>
              {SANCTION_RULEBOOK.map((chapter) => (
                <optgroup key={chapter.chapter} label={chapter.chapter}>
                  {chapter.articles.map((a) => (
                    <option key={a.code} value={a.code}>{a.code} — {a.action}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Sanción (marca una o varias — el comisario puede ajustarla sobre la tabla)</label>
            <div className="flex flex-wrap gap-1.5">
              {SANCTION_CODES.map((code) => {
                const active = selectedCodes.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    title={SANCTION_CODE_MEANINGS[code]}
                    onClick={() => toggleCode(code)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      active
                        ? 'border-rose-500/60 bg-rose-500/20 text-rose-300'
                        : 'border-shell-line bg-black/30 text-slate-400 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {code}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Motivo</label>
            <textarea
              name="reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Qué ha pasado y por qué se sanciona"
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={selectedCodes.length === 0}
              className="border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 rounded-lg transition-colors cursor-pointer"
            >
              Registrar sanción
            </button>
          </div>
        </form>
      )}

      {filteredRecords.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No hay ninguna sanción registrada{leagueFilter !== 'all' ? ' en este campeonato' : ''}.</p>
      ) : (
        <div className="overflow-x-auto border border-shell-line bg-black/10">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr className="border-b border-shell-line bg-black/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="p-2.5">Fecha</th>
                <th className="p-2.5">Campeonato</th>
                <th className="p-2.5">Dorsal</th>
                <th className="p-2.5">Piloto</th>
                <th className="p-2.5">Equipo</th>
                <th className="p-2.5">Carrera</th>
                <th className="p-2.5">Sanción</th>
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
                  <td className="p-2.5 font-mono text-slate-300">{r.dorsal ?? '—'}</td>
                  <td className="p-2.5 font-bold text-white">{r.driverName || '—'}</td>
                  <td className="p-2.5">{r.teamNameSnapshot || '—'}</td>
                  <td className="p-2.5">{r.eventTitle || '—'}</td>
                  <td className="p-2.5">
                    <span className="inline-block px-1.5 py-0.5 border border-rose-500/40 bg-rose-500/10 text-rose-300 text-[9px] font-extrabold uppercase tracking-wider">
                      {formatSanctionType(r.sanctionType)}
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
