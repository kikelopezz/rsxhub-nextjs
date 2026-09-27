import { ChannelType, PermissionsBitField } from 'discord.js'
import { discordClient, ensureDiscordLogin } from './client'

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
    permissionOverwrites: input.staffOnly ? [{ id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] }] : undefined,
  })

  return { id: channel.id, name: channel.name, parentId: 'parentId' in channel ? channel.parentId : null, kind: input.kind }
}
