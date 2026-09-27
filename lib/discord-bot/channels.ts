import { ChannelType, OverwriteType, PermissionsBitField } from 'discord.js'
import { discordClient, ensureDiscordLogin } from './client'

const OVERWRITE = PermissionsBitField.Flags

export type CreatedChannel = { id: string; name: string; parentId: string | null; kind: 'text' | 'category' }

/** Crea un canal de texto o una categoría desde Ajustes, sin salir de la web. */
export async function createChannel(
  guildId: string,
  input: { name: string; kind: 'text' | 'category'; staffOnly?: boolean }
): Promise<CreatedChannel> {
  await ensureDiscordLogin()
  const guild = await discordClient.guilds.fetch(guildId)
  const name = String(input.name || '').trim().slice(0, 90) || (input.kind === 'category' ? 'CATEGORIA' : 'canal')

  const channel = await guild.channels.create({
    name,
    type: input.kind === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText,
    // Sin la propia del bot, se quedaría fuera de un canal que oculta a @everyone y él mismo acaba de crear.
    permissionOverwrites: input.staffOnly
      ? [
          { id: guild.roles.everyone.id, deny: [OVERWRITE.ViewChannel], type: OverwriteType.Role },
          { id: discordClient.user!.id, allow: [OVERWRITE.ViewChannel, OVERWRITE.SendMessages], type: OverwriteType.Member },
        ]
      : undefined,
  })

  return { id: channel.id, name: channel.name, parentId: 'parentId' in channel ? channel.parentId : null, kind: input.kind }
}
