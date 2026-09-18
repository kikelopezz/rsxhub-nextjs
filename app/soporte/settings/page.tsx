import { AlertTriangle } from 'lucide-react'
import { guardTicketAccess } from '@/lib/ticket-access'
import * as ticketsApi from '@/lib/tickets-api'
import { TicketSettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export default async function TicketSettingsPage({ searchParams }: { searchParams: Promise<{ guild?: string }> }) {
  await guardTicketAccess()
  const params = await searchParams

  try {
    const { guilds } = await ticketsApi.listGuilds()
    const guildId = guilds.find((g) => g.id === params.guild)?.id || guilds[0]?.id
    if (!guildId) {
      return <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-6 text-sm text-slate-300">El bot no está en ningún servidor todavía.</div>
    }
    const { guild, config } = await ticketsApi.getOverview(guildId)
    return <TicketSettingsForm key={guild.id} guild={guild} config={config} />
  } catch (e) {
    const message = e instanceof ticketsApi.TicketApiError ? e.message : 'No se pudo cargar la configuración.'
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-100">
        <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> No se pudo conectar con el bot</p>
        <p className="mt-1 text-xs text-rose-200/80">{message}</p>
      </div>
    )
  }
}
