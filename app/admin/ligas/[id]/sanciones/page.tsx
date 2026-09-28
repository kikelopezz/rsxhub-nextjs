import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { canAccessPlatformAdmin, canManageLeague, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { getLeagueEvents, getLeagues } from '@/lib/platform-data'
import { db } from '@/lib/db'
import { createSanctionAction, deleteSanctionAction } from '../../../actions/admin-sanctions'
import { SANCTION_TYPES, SANCTION_TYPE_LABELS, type SanctionType } from '@/lib/sanctions'

export default async function AdminLeagueSanctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  const session = await getCurrentUser()
  const { id: leagueId } = await params
  const qs = await searchParams
  if (!session) redirect('/perfil')

  const [platformRole, leagueRole] = await Promise.all([getPlatformRole(session.userId), getLeagueRole(leagueId, session.userId)])
  const isPlatformAdmin = canAccessPlatformAdmin(platformRole)
  const canReview = isPlatformAdmin || canStewardLeague(leagueRole) || canManageLeague(leagueRole)
  if (!canReview) redirect('/admin')

  const leagues = await getLeagues()
  const league = leagues.find((item) => item.id === leagueId)
  if (!league) notFound()

  const [events, teams, records] = await Promise.all([
    getLeagueEvents(leagueId),
    db.team.findMany({ where: { leagueId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.sanctionRecord.findMany({
      where: { leagueId },
      include: { event: { select: { title: true, circuitName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const errorMessages: Record<string, string> = {
    '1': 'Faltan datos obligatorios (tipo de sanción y motivo).',
    'missing-target': 'Indica al menos un piloto o un equipo.',
    'save-failed': 'No se pudo guardar la sanción.',
  }

  return (
    <div className="space-y-4 text-white">
      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display-condensed text-lg font-bold uppercase tracking-wide text-white">Sanciones — {league.title}</h1>
            <p className="text-xs text-slate-400">Registro de sanciones de los comisarios de este campeonato, exportable a Excel.</p>
          </div>
          <div className="flex gap-2">
            <a href={`/admin/ligas/${leagueId}/sanciones/export`} className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 rounded-lg">
              Exportar a Excel
            </a>
            <Link href={`/admin/ligas/${leagueId}`} className="border border-shell-line bg-white/5 px-3 py-2 text-xs font-semibold text-white rounded-lg">Volver</Link>
          </div>
        </div>

        {qs.created === '1' && <div className="mt-3 border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 rounded-lg">Sanción registrada.</div>}
        {qs.error && <div className="mt-3 border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 rounded-lg">{errorMessages[qs.error] || 'No se pudo completar la acción.'}</div>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Nueva sanción</h2>
        <form action={createSanctionAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="hidden" name="leagueId" value={leagueId} />

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Piloto</label>
            <input name="driverName" type="text" placeholder="Nombre del piloto" className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Equipo</label>
            <select name="teamId" defaultValue="" className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30">
              <option value="">— Sin equipo / a título individual —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input name="teamNameSnapshot" type="text" placeholder="O escribe el nombre del equipo si no está en la lista de arriba" className="mt-1.5 w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Carrera (opcional)</label>
            <select name="eventId" defaultValue="" className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30">
              <option value="">— General / fuera de carrera —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.title || e.circuitName}</option>
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
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Historial ({records.length})</h2>
        {records.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Todavía no hay ninguna sanción registrada en este campeonato.</p>
        ) : (
          <div className="overflow-x-auto border border-shell-line bg-black/10">
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead>
                <tr className="border-b border-shell-line bg-black/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="p-2.5">Fecha</th>
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
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2.5 whitespace-nowrap text-slate-400">{r.createdAt.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="p-2.5 font-bold text-white">{r.driverName || '—'}</td>
                    <td className="p-2.5">{r.teamNameSnapshot || '—'}</td>
                    <td className="p-2.5">{r.event ? (r.event.title || r.event.circuitName) : '—'}</td>
                    <td className="p-2.5">
                      <span className="inline-block px-1.5 py-0.5 border border-rose-500/40 bg-rose-500/10 text-rose-300 text-[9px] font-extrabold uppercase tracking-wider">
                        {SANCTION_TYPE_LABELS[r.sanctionType as SanctionType] || r.sanctionType}
                      </span>
                    </td>
                    <td className="p-2.5 max-w-[320px]">{r.reason}</td>
                    <td className="p-2.5 text-slate-400">{r.createdByName}</td>
                    <td className="p-2.5 text-right">
                      <form action={deleteSanctionAction}>
                        <input type="hidden" name="leagueId" value={leagueId} />
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
      </section>
    </div>
  )
}
