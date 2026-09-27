import Link from 'next/link'
import { Users, Search } from 'lucide-react'
import { db } from '@/lib/db'
import { getBotGuildIds } from '@/lib/discord-bot/guild-info'

export const dynamic = 'force-dynamic'

/**
 * Directorio de CRM: se agrupa por identidad de Discord (quien abre un ticket no tiene por qué
 * tener cuenta en el Hub), con su número de tickets y notas. No hay una tabla de "contactos"
 * aparte — se calcula a partir de los tickets y notas ya guardados.
 */
export default async function SoporteCrmPage({ searchParams }: { searchParams: Promise<{ guild?: string; q?: string }> }) {
  const params = await searchParams
  const guildIds = getBotGuildIds()
  const guildId = guildIds.includes(params.guild || '') ? (params.guild as string) : guildIds[0]

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        El bot todavía no está en ningún servidor de Discord.
      </div>
    )
  }

  const [tickets, notes] = await Promise.all([
    db.supportTicket.findMany({ where: { guildId }, select: { openerId: true, openerTag: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    db.supportNote.groupBy({ by: ['targetDiscordId'], where: { guildId }, _count: { _all: true } }),
  ])

  const notesCountById = new Map(notes.map((n) => [n.targetDiscordId, n._count._all]))

  type Contact = { discordId: string; tag: string; total: number; open: number; lastAt: Date; notes: number }
  const byId = new Map<string, Contact>()
  for (const t of tickets) {
    const existing = byId.get(t.openerId)
    if (existing) {
      existing.total += 1
      if (t.status === 'open' || t.status === 'claimed') existing.open += 1
    } else {
      byId.set(t.openerId, {
        discordId: t.openerId,
        tag: t.openerTag || t.openerId,
        total: 1,
        open: t.status === 'open' || t.status === 'claimed' ? 1 : 0,
        lastAt: t.createdAt,
        notes: notesCountById.get(t.openerId) || 0,
      })
    }
  }
  // Alguien puede tener notas sin haber abierto ningún ticket (staff apuntó algo a mano).
  for (const [discordId, count] of notesCountById) {
    if (!byId.has(discordId)) byId.set(discordId, { discordId, tag: discordId, total: 0, open: 0, lastAt: new Date(0), notes: count })
  }

  const q = (params.q || '').trim().toLowerCase()
  const contacts = [...byId.values()]
    .filter((c) => !q || c.tag.toLowerCase().includes(q) || c.discordId.includes(q))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())

  return (
    <div className="space-y-4">
      <form className="flex items-center gap-2">
        <input type="hidden" name="guild" value={guildId} />
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Buscar por nombre o ID de Discord…"
            className="w-full rounded-lg border border-shell-line bg-black/40 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-[#4ea1ff]"
          />
        </div>
      </form>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Nadie ha abierto un ticket todavía en este servidor.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c]">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
                <th className="p-3">Piloto (Discord)</th>
                <th className="p-3 text-center">Tickets</th>
                <th className="p-3 text-center">Abiertos</th>
                <th className="p-3 text-center">Notas</th>
                <th className="p-3 text-right">Última actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contacts.map((c) => (
                <tr key={c.discordId} className="hover:bg-white/[0.03]">
                  <td className="p-3">
                    <Link href={`/soporte/crm/${c.discordId}?guild=${guildId}`} className="font-bold text-white hover:text-[#4ea1ff]">
                      {c.tag}
                    </Link>
                    <p className="font-mono-data text-[10px] text-slate-500">{c.discordId}</p>
                  </td>
                  <td className="p-3 text-center font-bold text-white">{c.total}</td>
                  <td className="p-3 text-center">{c.open > 0 ? <span className="text-emerald-400">{c.open}</span> : <span className="text-slate-600">0</span>}</td>
                  <td className="p-3 text-center">{c.notes > 0 ? <span className="text-amber-400">{c.notes}</span> : <span className="text-slate-600">0</span>}</td>
                  <td className="p-3 text-right text-slate-400">{c.lastAt.getTime() > 0 ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(c.lastAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
