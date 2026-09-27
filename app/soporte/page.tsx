import Link from 'next/link'
import { ChevronDown, ExternalLink, Ticket as TicketIcon } from 'lucide-react'
import { db } from '@/lib/db'
import { getBotGuildIds, getGuildSummary } from '@/lib/discord-bot/guild-info'
import { isDiscordConfigured } from '@/lib/discord-bot/client'
import { ensureBotStarted } from '@/lib/discord-bot'
import { TicketActions } from './ticket-actions'
import type { SupportTicketStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const STATUS_TABS: Array<{ key: SupportTicketStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'open', label: 'Abiertos' },
  { key: 'claimed', label: 'Reclamados' },
  { key: 'closed', label: 'Cerrados' },
  { key: 'merged', label: 'Fusionados' },
]

const STATUS_STYLE: Record<string, string> = {
  open: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  claimed: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
  closed: 'border-white/15 bg-white/5 text-slate-400',
  merged: 'border-[#4ea1ff]/40 bg-[#4ea1ff]/10 text-[#4ea1ff]',
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ guild?: string; status?: string; ok?: string; error?: string }>
}) {
  const params = await searchParams

  if (!(await isDiscordConfigured())) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        El bot de soporte no está configurado todavía.{' '}
        <Link href="/soporte/settings" className="text-[#4ea1ff] hover:underline">
          Configúralo en Ajustes
        </Link>
        .
      </div>
    )
  }

  // Se espera aquí mismo a que intente conectar (no basta con lo que haga el layout: en el App
  // Router layout y página se resuelven en paralelo, así que si solo se fía del layout la primera
  // visita puede leer "sin servidores" un instante antes de que el login termine).
  await ensureBotStarted()

  const guildIds = getBotGuildIds()
  const guildId = guildIds.includes(params.guild || '') ? (params.guild as string) : guildIds[0]

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        El bot todavía no está en ningún servidor de Discord, o se está conectando. Invítalo y recarga esta página.
      </div>
    )
  }

  const statusFilter = STATUS_TABS.some((t) => t.key === params.status) && params.status !== 'all' ? (params.status as SupportTicketStatus) : null

  const [tickets, counts, guilds] = await Promise.all([
    db.supportTicket.findMany({ where: { guildId, ...(statusFilter ? { status: statusFilter } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.supportTicket.groupBy({ by: ['status'], where: { guildId }, _count: { _all: true } }),
    Promise.resolve(guildIds.map((id) => getGuildSummary(id)).filter((g): g is NonNullable<typeof g> => Boolean(g))),
  ])

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))
  const total = counts.reduce((sum, c) => sum + c._count._all, 0)
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'claimed')

  const buildUrl = (next: Partial<{ guild: string; status: string }>) => {
    const qs = new URLSearchParams({ guild: next.guild ?? guildId, ...(next.status && next.status !== 'all' ? { status: next.status } : {}) })
    return `/soporte?${qs.toString()}`
  }

  return (
    <div className="space-y-4">
      {params.ok && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-200">Hecho.</div>
      )}
      {params.error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-200">{params.error}</div>
      )}

      {guilds.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {guilds.map((g) => (
            <Link
              key={g.id}
              href={buildUrl({ guild: g.id, status: params.status })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${g.id === guildId ? 'border-[#4ea1ff] text-[#4ea1ff]' : 'border-white/10 text-slate-400 hover:text-white'}`}
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
        {STATUS_TABS.map((tab) => {
          const active = (params.status || 'all') === tab.key
          const count = tab.key === 'all' ? total : countByStatus[tab.key] || 0
          return (
            <Link
              key={tab.key}
              href={buildUrl({ status: tab.key })}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                active ? 'border-[#4ea1ff] bg-[#4ea1ff]/10 text-[#4ea1ff]' : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
              <span className="font-mono-data text-[10px] text-slate-500">{count}</span>
            </Link>
          )
        })}
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
          <TicketIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
          No hay tickets con este filtro.
        </div>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
          {tickets.map((ticket) => (
            <details key={ticket.id} className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                <span className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLE[ticket.status]}`}>
                  {ticket.status}
                </span>
                <span className="font-bold text-white">{ticket.code}</span>
                {ticket.campeonatoLabel && <span className="text-xs text-slate-400">{ticket.campeonatoLabel}</span>}
                <span className="text-xs text-slate-500">{ticket.openerTag || ticket.openerId}</span>
                {ticket.claimedByTag && <span className="text-[10px] uppercase text-amber-400">Reclamado por {ticket.claimedByTag}</span>}
                <span className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
                  {formatDate(ticket.createdAt)}
                  <a
                    href={`discord://discord.com/channels/${guildId}/${ticket.channelId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-slate-500 hover:text-[#4ea1ff]"
                    title="Abrir el canal en Discord"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </span>
              </summary>
              <TicketActions
                ticket={{ id: ticket.id, status: ticket.status, internalNotes: ticket.internalNotes }}
                guildId={guildId}
                returnStatus={params.status || ''}
                mergeTargets={openTickets.filter((t) => t.id !== ticket.id).map((t) => ({ id: t.id, code: t.code, status: t.status }))}
                initialNotes={ticket.internalNotes || ''}
              />
              {ticket.transcriptUrl && (
                <div className="border-t border-white/10 bg-black/20 px-4 py-2">
                  <a href={ticket.transcriptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4ea1ff] hover:underline">
                    Ver transcripción →
                  </a>
                </div>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
