import { ExternalLink } from 'lucide-react'
import type { SupportTicket } from '@prisma/client'
import { StatusSteps } from './status-steps'

const COLUMNS: Array<{ key: SupportTicket['status']; label: string; dot: string; text: string }> = [
  { key: 'open', label: 'Abierto', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  { key: 'claimed', label: 'Reclamado', dot: 'bg-amber-400', text: 'text-amber-300' },
  { key: 'closed', label: 'Cerrado', dot: 'bg-slate-300', text: 'text-slate-300' },
  { key: 'merged', label: 'Fusionado', dot: 'bg-[#4ea1ff]', text: 'text-[#4ea1ff]' },
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

/** Vista de tablero: una columna por estado, para ver de un vistazo cuántos tickets hay en cada punto del proceso. */
export function TicketBoard({ tickets, guildId }: { tickets: SupportTicket[]; guildId: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = tickets.filter((t) => t.status === col.key)
        return (
          <div key={col.key} className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-[#0f1013] p-3.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <span className={`font-display-condensed text-xs font-bold uppercase tracking-wide ${col.text}`}>{col.label}</span>
              <span className="ml-auto font-mono-data text-[11px] text-slate-500">{items.length}</span>
            </div>

            {items.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-slate-600">Sin tickets</p>
            ) : (
              items.map((t) => (
                <div key={t.id} className="space-y-1.5 rounded-xl border border-white/10 bg-[#151619] p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {t.campeonatoLabel && (
                      <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {t.campeonatoLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-white">
                    {t.status === 'closed' ? '✅ ' : ''}
                    {t.code}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>{t.openerTag || t.openerId}</span>
                    {t.claimedByTag && col.key === 'claimed' && <span className="text-amber-400">· reclamado por {t.claimedByTag}</span>}
                    {t.status === 'merged' && <StatusSteps ticket={t} mode="compact" />}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-600">
                    <span>{formatDate(t.createdAt)}</span>
                    <a
                      href={`discord://discord.com/channels/${guildId}/${t.channelId}`}
                      className="flex items-center gap-1 text-slate-500 hover:text-[#4ea1ff]"
                      title="Abrir el canal en Discord"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
