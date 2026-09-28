import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { getBotStatus } from '@/lib/support-bot-client'
import { SubmitButton } from '@/components/submit-button'
import { StatusSteps } from '../../status-steps'
import { addCrmNoteAction, deleteCrmNoteAction } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function CrmProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ discordId: string }>
  searchParams: Promise<{ guild?: string }>
}) {
  const { discordId } = await params
  const sp = await searchParams
  const status = await getBotStatus()
  const guildIds = status.guilds.map((g) => g.id)
  const guildId = guildIds.includes(sp.guild || '') ? (sp.guild as string) : guildIds[0]

  if (!guildId) {
    return <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">El bot no está conectado.</div>
  }

  const [tickets, notes] = await Promise.all([
    db.supportTicket.findMany({ where: { guildId, openerId: discordId }, orderBy: { createdAt: 'desc' } }),
    db.supportNote.findMany({ where: { guildId, targetDiscordId: discordId }, orderBy: { createdAt: 'desc' } }),
  ])

  const tag = tickets[0]?.openerTag || discordId

  return (
    <div className="space-y-5">
      <Link href={`/soporte/crm?guild=${guildId}`} className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al CRM
      </Link>

      <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5">
        <h2 className="font-display-condensed text-2xl font-bold uppercase text-white">{tag}</h2>
        <p className="font-mono-data text-xs text-slate-500">{discordId}</p>
        <p className="mt-1 text-xs text-slate-400">
          {tickets.length} ticket{tickets.length === 1 ? '' : 's'} · {notes.length} nota{notes.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Historial de tickets</h3>
          {tickets.length === 0 ? (
            <p className="text-xs text-slate-500">Sin tickets todavía.</p>
          ) : (
            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
              {tickets.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-2 p-3">
                  <span className="font-bold text-white">
                    {t.status === 'closed' ? '✅ ' : ''}
                    {t.code}
                  </span>
                  {t.campeonatoLabel && <span className="text-xs text-slate-400">{t.campeonatoLabel}</span>}
                  <StatusSteps ticket={t} mode="compact" />
                  <span className="ml-auto text-[10px] text-slate-500">
                    {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(t.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Notas internas</h3>
          <form action={addCrmNoteAction} className="space-y-2 rounded-2xl border border-white/10 bg-[#0a0a0c] p-3">
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="targetDiscordId" value={discordId} />
            <input type="hidden" name="targetTag" value={tag} />
            <textarea
              name="body"
              rows={2}
              maxLength={2000}
              placeholder="Escribe una nota privada sobre este piloto…"
              className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]"
            />
            <SubmitButton
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase text-slate-200 hover:bg-white/10"
              label="Añadir nota"
              pendingLabel="Guardando…"
            />
          </form>

          {notes.length === 0 ? (
            <p className="text-xs text-slate-500">Sin notas todavía.</p>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-xs text-slate-200">{n.body}</p>
                    <form action={deleteCrmNoteAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="targetDiscordId" value={discordId} />
                      <button type="submit" className="shrink-0 text-slate-600 hover:text-rose-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    {n.authorName} · {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
