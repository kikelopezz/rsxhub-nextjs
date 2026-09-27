import { ChannelType } from 'discord.js'
import { discordClient, isDiscordReady } from './client'

export type GuildSummary = { id: string; name: string; icon: string | null; memberCount: number }
export type GuildDetails = GuildSummary & {
  categories: Array<{ id: string; name: string }>
  textChannels: Array<{ id: string; name: string; parentId: string | null }>
  roles: Array<{ id: string; name: string; color: string }>
}

/** Servidores donde está el bot ahora mismo (vacío si todavía no ha terminado de conectar). */
export function getBotGuildIds(): string[] {
  return isDiscordReady() ? [...discordClient.guilds.cache.keys()] : []
}

export function getGuildSummary(guildId: string): GuildSummary | null {
  const guild = discordClient.guilds.cache.get(guildId)
  if (!guild) return null
  return { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 64 }), memberCount: guild.memberCount }
}

/**
 * Categorías, canales de texto y roles de un servidor, para los desplegables de Ajustes.
 * Se leen de la caché del propio gateway (Discord avisa de cada cambio); solo se pide por API
 * si la caché está vacía, para no golpear el rate limit de Discord en cada carga de la página.
 */
export async function getGuildDetails(guildId: string): Promise<GuildDetails | null> {
  const guild = discordClient.guilds.cache.get(guildId)
  if (!guild) return null

  const channels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch()

  const categories = [...channels.values()]
    .filter((c) => c && c.type === ChannelType.GuildCategory)
    .map((c) => ({ id: c!.id, name: c!.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const textChannels = [...channels.values()]
    .filter((c) => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
    .map((c) => ({ id: c!.id, name: c!.name, parentId: 'parentId' in c! ? c.parentId : null }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 64 }),
    memberCount: guild.memberCount,
    categories,
    textChannels,
    roles,
  }
}
