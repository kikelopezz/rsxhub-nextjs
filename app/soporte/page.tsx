import Link from 'next/link'
import { ChevronDown, ExternalLink, LayoutGrid, List, Ticket as TicketIcon } from 'lucide-react'
import { db } from '@/lib/db'
import { getBotStatus } from '@/lib/support-bot-client'
import { TicketActions } from './ticket-actions'
import { StatusSteps } from './status-steps'
import { TicketBoard } from './ticket-board'
import type { SupportTicketStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const STATUS_TABS: Array<{ key: SupportTicketStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'open', label: 'Abiertos' },
  { key: 'claimed', label: 'Reclamados' },
  { key: 'closed', label: 'Cerrados' },
  { key: 'merged', label: 'Fusionados' },
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ guild?: string; status?: string; ok?: string; error?: string; view?: string }>
}) {
  const params = await searchParams
  const view = params.view === 'board' ? 'board' : 'list'

  const status = await getBotStatus()
  if (!status.ready) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        {status.configured ? (
          'El bot de soporte no está conectado ahora mismo.'
        ) : (
          <>
            El bot de soporte no está configurado todavía.{' '}
            <Link href="/soporte/settings" className="text-[#4ea1ff] hover:underline">
              Revisa Ajustes
            </Link>
            .
          </>
        )}
      </div>
    )
  }

  const guildIds = status.guilds.map((g) => g.id)
  const guildId = guildIds.includes(params.guild || '') ? (params.guild as string) : guildIds[0]

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        El bot todavía no está en ningún servidor de Discord. Invítalo y recarga esta página.
      </div>
    )
  }

  const statusFilter = STATUS_TABS.some((t) => t.key === params.status) && params.status !== 'all' ? (params.status as SupportTicketStatus) : null

  const guilds = status.guilds

  const [tickets, counts] = await Promise.all([
    db.supportTicket.findMany({ where: { guildId, ...(view === 'list' && statusFilter ? { status: statusFilter } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.supportTicket.groupBy({ by: ['status'], where: { guildId }, _count: { _all: true } }),
  ])

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))
  const total = counts.reduce((sum, c) => sum + c._count._all, 0)
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'claimed')

  const buildUrl = (next: Partial<{ guild: string; status: string; view: string }>) => {
    const qs = new URLSearchParams({
      guild: next.guild ?? guildId,
      ...(next.status && next.status !== 'all' ? { status: next.status } : {}),
      ...((next.view ?? view) !== 'list' ? { view: next.view ?? view } : {}),
    })
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

      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-3">
        {view === 'list' &&
          STATUS_TABS.map((tab) => {
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

        <div className="ml-auto flex gap-1 rounded-lg border border-white/10 p-0.5">
          <Link
            href={buildUrl({ view: 'list' })}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              view === 'list' ? 'bg-[#4ea1ff]/10 text-[#4ea1ff]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </Link>
          <Link
            href={buildUrl({ view: 'board' })}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              view === 'board' ? 'bg-[#4ea1ff]/10 text-[#4ea1ff]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Tablero
          </Link>
        </div>
      </div>

      {view === 'board' ? (
        <TicketBoard tickets={tickets} guildId={guildId} />
      ) : tickets.length === 0 ? (
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
                <span className="font-bold text-white">
                  {ticket.status === 'closed' ? '✅ ' : ''}
                  {ticket.code}
                </span>
                {ticket.campeonatoLabel && <span className="text-xs text-slate-400">{ticket.campeonatoLabel}</span>}
                <span className="text-xs text-slate-500">{ticket.openerTag || ticket.openerId}</span>
                {ticket.claimedByTag && ticket.status === 'claimed' && (
                  <span className="text-[10px] uppercase text-amber-400">Reclamado por {ticket.claimedByTag}</span>
                )}
                <StatusSteps ticket={ticket} mode="compact" />
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
              <div className="border-t border-white/10 bg-black/10 px-4 py-4">
                <StatusSteps ticket={ticket} mode="full" />
              </div>
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
