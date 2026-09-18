import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, FileText } from 'lucide-react'
import { guardTicketAccess } from '@/lib/ticket-access'
import * as ticketsApi from '@/lib/tickets-api'
import type { TicketRow, TicketStatus } from '@/lib/tickets-api'
import { ConfirmForm } from '@/components/confirm-form'
import { AutoRefresh } from './auto-refresh'
import { claimTicketAction, unclaimTicketAction, closeTicketAction, deleteTicketAction } from './actions'

export const dynamic = 'force-dynamic'

const OK_MESSAGES: Record<string, string> = {
  claimed: 'Ticket reclamado.',
  unclaimed: 'Ticket liberado.',
  closed: 'Ticket cerrado y transcripción generada.',
  deleted: 'Canal del ticket eliminado.',
}

const FILTERS: Array<{ key: 'all' | TicketStatus; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'open', label: 'Sin reclamar' },
  { key: 'claimed', label: 'Reclamados' },
  { key: 'closed', label: 'Cerrados' },
]

const STAGES: TicketStatus[] = ['open', 'claimed', 'closed']

// sqlite guarda datetime('now') en UTC sin zona: "YYYY-MM-DD HH:MM:SS"
function parseDbDate(value: string) {
  return new Date(value.replace(' ', 'T') + 'Z')
}

function formatDate(value: string) {
  return parseDbDate(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' })
}

function ageInfo(ticket: TicketRow) {
  const hours = (Date.now() - parseDbDate(ticket.created_at).getTime()) / 3600000
  const label = hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} d`
  // Solo urge mientras nadie lo ha reclamado: verde → ámbar → rojo.
  const tone = ticket.status !== 'open' ? 'text-slate-500' : hours >= 12 ? 'text-rose-400' : hours >= 2 ? 'text-amber-400' : 'text-emerald-400'
  return { label, tone }
}

function StageTracker({ status }: { status: TicketStatus }) {
  const current = STAGES.indexOf(status)
  const isFinal = current === STAGES.length - 1
  return (
    <div className="flex items-center gap-1" aria-label={`Fase: ${status}`}>
      {STAGES.map((stage, i) => {
        const done = i < current || isFinal
        const active = i === current && !isFinal
        return (
          <div key={stage} className="flex items-center gap-1">
            <span
              className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-emerald-500' : active ? 'bg-[#4ea1ff] shadow-[0_0_8px_rgba(78,161,255,.9)]' : 'bg-slate-700'}`}
            />
            {i < STAGES.length - 1 && <span className={`h-px w-3 ${done ? 'bg-emerald-500/60' : 'bg-slate-700'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function StatusPill({ ticket }: { ticket: TicketRow }) {
  if (ticket.status === 'open') {
    return <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">Sin reclamar</span>
  }
  if (ticket.status === 'claimed') {
    return (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
        Reclamado · {ticket.claimed_by_tag || ticket.claimed_by}
      </span>
    )
  }
  return <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-300">Cerrado</span>
}

function Hidden({ guildId, ticketId, returnStatus }: { guildId: string; ticketId: number; returnStatus: string }) {
  return (
    <>
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="returnStatus" value={returnStatus} />
    </>
  )
}

const btn = 'rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer'

function RowActions({ ticket, guildId, returnStatus }: { ticket: TicketRow; guildId: string; returnStatus: string }) {
  const hidden = <Hidden guildId={guildId} ticketId={ticket.id} returnStatus={returnStatus} />
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {ticket.status === 'open' && (
        <form action={claimTicketAction}>
          {hidden}
          <button type="submit" className={`${btn} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25`}>Reclamar</button>
        </form>
      )}
      {ticket.status === 'claimed' && (
        <form action={unclaimTicketAction}>
          {hidden}
          <button type="submit" className={`${btn} border-white/10 text-slate-300 hover:bg-white/5`}>Liberar</button>
        </form>
      )}
      {ticket.status !== 'closed' && (
        <ConfirmForm action={closeTicketAction} confirmMessage={`¿Cerrar «${ticket.code || `#${ticket.number}`}»? Se generará la transcripción.`} className="flex items-center gap-1">
          {hidden}
          <input
            type="text"
            name="reason"
            maxLength={300}
            placeholder="Motivo (opcional)"
            className="w-32 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white outline-none focus:border-[#4ea1ff]"
          />
          <button type="submit" className={`${btn} border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/25`}>Cerrar</button>
        </ConfirmForm>
      )}
      {ticket.status === 'closed' && ticket.transcript_file && (
        <a
          href={`/soporte/transcripts/${encodeURIComponent(ticket.transcript_file)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} flex items-center gap-1 border-[#4ea1ff]/40 bg-[rgba(78,161,255,.08)] text-[#4ea1ff] hover:bg-[rgba(78,161,255,.18)]`}
        >
          <FileText className="h-3 w-3" /> Transcripción
        </a>
      )}
      {ticket.status === 'closed' && (
        <ConfirmForm action={deleteTicketAction} confirmMessage={`¿Eliminar el canal de «${ticket.code || `#${ticket.number}`}» en Discord? No se puede deshacer.`}>
          {hidden}
          <button type="submit" className={`${btn} border-white/10 text-slate-400 hover:bg-white/5`}>Eliminar canal</button>
        </ConfirmForm>
      )}
    </div>
  )
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; guild?: string; ok?: string; error?: string }>
}) {
  await guardTicketAccess()
  const params = await searchParams

  const filter = (['open', 'claimed', 'closed'] as const).find((s) => s === params.status)

  let loadError: string | null = null
  let guilds: ticketsApi.GuildSummary[] = []
  let guildId = ''
  let stats: ticketsApi.TicketStats | null = null
  let tickets: TicketRow[] = []
  let botReady = true

  try {
    const list = await ticketsApi.listGuilds()
    guilds = list.guilds
    botReady = list.botReady
    guildId = guilds.find((g) => g.id === params.guild)?.id || guilds[0]?.id || ''
    if (guildId) {
      const [overview, rows] = await Promise.all([ticketsApi.getOverview(guildId), ticketsApi.listTickets(guildId, filter)])
      stats = overview.stats
      tickets = rows
    }
  } catch (e) {
    loadError = e instanceof ticketsApi.TicketApiError ? e.message : 'No se pudieron cargar los tickets.'
  }

  const returnStatus = filter || ''
  const filterHref = (key: string) => {
    const qs = new URLSearchParams({ ...(key !== 'all' ? { status: key } : {}), ...(guildId ? { guild: guildId } : {}) })
    return `/soporte${qs.size ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <AutoRefresh />

      {params.ok && OK_MESSAGES[params.ok] && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          <CheckCircle2 className="h-4 w-4" /> {OK_MESSAGES[params.ok]}
        </div>
      )}
      {params.error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">
          <AlertTriangle className="h-4 w-4" /> {params.error}
        </div>
      )}

      {loadError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-100">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> No se pudo conectar con el bot</p>
          <p className="mt-1 text-xs text-rose-200/80">{loadError}</p>
        </div>
      ) : !guildId ? (
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-6 text-sm text-slate-300">
          El bot no está en ningún servidor todavía{botReady ? '' : ' (aún está conectando a Discord)'}.
        </div>
      ) : (
        <>
          {guilds.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {guilds.map((g) => (
                <Link
                  key={g.id}
                  href={`/soporte?guild=${g.id}`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${g.id === guildId ? 'border-[#4ea1ff] text-[#4ea1ff]' : 'border-white/10 text-slate-400 hover:text-white'}`}
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Total', value: stats.total, tone: 'text-white' },
                { label: 'Sin reclamar', value: stats.open, tone: 'text-emerald-300' },
                { label: 'Reclamados', value: stats.claimed, tone: 'text-amber-300' },
                { label: 'Cerrados', value: stats.closed, tone: 'text-slate-300' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                  <p className={`font-mono-data mt-1 text-3xl font-black ${s.tone}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap border border-shell-line bg-black/40 p-1 rounded-lg w-fit gap-1">
            {FILTERS.map((f) => {
              const active = (filter || 'all') === f.key
              return (
                <Link
                  key={f.key}
                  href={filterHref(f.key)}
                  className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wide rounded-lg transition-colors ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {f.label}
                </Link>
              )
            })}
          </div>

          <section className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0a0a0c]">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-shell-line bg-black/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Abierto por</th>
                  <th className="p-3">Fase</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Creado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center italic text-slate-500">No hay tickets en esta vista.</td>
                  </tr>
                ) : (
                  tickets.map((ticket) => {
                    const age = ageInfo(ticket)
                    return (
                      <tr key={ticket.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="p-3 font-mono-data font-black text-[#4ea1ff]">{ticket.code || `#${ticket.number}`}</td>
                        <td className="p-3">{ticket.type_label || '—'}</td>
                        <td className="p-3 font-semibold text-white">{ticket.opener_tag || ticket.opener_id}</td>
                        <td className="p-3"><StageTracker status={ticket.status} /></td>
                        <td className="p-3"><StatusPill ticket={ticket} /></td>
                        <td className="p-3">
                          <span className="block font-mono text-[11px] text-slate-400">{formatDate(ticket.created_at)}</span>
                          <span className={`block text-[10px] font-bold ${age.tone}`}>hace {age.label}</span>
                        </td>
                        <td className="p-3"><RowActions ticket={ticket} guildId={guildId} returnStatus={returnStatus} /></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </section>

          {stats && stats.topStaff.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Staff con más tickets reclamados</h2>
              <ul className="space-y-1.5">
                {stats.topStaff.map((s) => (
                  <li key={s.staffId} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{s.staffTag || s.staffId.replace(/^hub:/, '')}</span>
                    <span className="font-mono-data text-[#4ea1ff]">{s.handled}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <ExternalLink className="h-3 w-3" /> Se actualiza solo cada 10 segundos. Las acciones se reflejan también dentro del canal de Discord.
          </p>
        </>
      )}
    </div>
  )
}
