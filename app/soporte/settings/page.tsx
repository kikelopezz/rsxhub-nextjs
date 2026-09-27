import { getBotGuildIds, getGuildDetails } from '@/lib/discord-bot/guild-info'
import { hasDiscordBot } from '@/lib/discord-bot/client'
import { ensureGuildConfig } from '@/lib/discord-bot/config'
import { TicketSettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export default async function SoporteSettingsPage({ searchParams }: { searchParams: Promise<{ guild?: string }> }) {
  const params = await searchParams

  if (!hasDiscordBot) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        El bot de soporte no está configurado (falta <code className="text-slate-300">DISCORD_BOT_TOKEN</code>).
      </div>
    )
  }

  const guildIds = getBotGuildIds()
  const guildId = guildIds.includes(params.guild || '') ? (params.guild as string) : guildIds[0]

  if (!guildId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        El bot todavía no está en ningún servidor de Discord, o se está conectando. Invítalo y recarga esta página.
      </div>
    )
  }

  const guild = await getGuildDetails(guildId)
  if (!guild) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
        No se pudo leer la información de ese servidor de Discord.
      </div>
    )
  }

  const config = await ensureGuildConfig(guildId, guild.name)

  return <TicketSettingsForm guild={guild} config={config} />
}
