import { getBotStatus, getGuildDetails } from '@/lib/support-bot-client'
import { ensureGuildConfig } from '@/lib/support-config'
import { BotConnectionCard } from './bot-connection-card'
import { TicketSettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export default async function SoporteSettingsPage({ searchParams }: { searchParams: Promise<{ guild?: string }> }) {
  const params = await searchParams
  const status = await getBotStatus()
  const connectionCard = <BotConnectionCard status={status} />

  if (!status.ready) {
    return (
      <div className="space-y-5">
        {connectionCard}
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
          {status.configured ? 'Conectando con Discord…' : 'El bot de soporte no responde. Revisa que esté desplegado y accesible desde el Hub.'}
        </div>
      </div>
    )
  }

  const guildIds = status.guilds.map((g) => g.id)
  const guildId = guildIds.includes(params.guild || '') ? (params.guild as string) : guildIds[0]

  if (!guildId) {
    return (
      <div className="space-y-5">
        {connectionCard}
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
          El bot está conectado pero todavía no está en ningún servidor de Discord. Invítalo con el enlace de arriba.
        </div>
      </div>
    )
  }

  const guild = await getGuildDetails(guildId)
  if (!guild) {
    return (
      <div className="space-y-5">
        {connectionCard}
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
          No se pudo leer la información de ese servidor de Discord.
        </div>
      </div>
    )
  }

  const config = await ensureGuildConfig(guildId, guild.name)

  return (
    <div className="space-y-5">
      {connectionCard}
      <TicketSettingsForm guild={guild} config={config} />
    </div>
  )
}
