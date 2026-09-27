import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type BaseMessageOptions,
} from 'discord.js'
import { discordClient } from './client'
import { getGuildConfig, setPanelMessage, type ButtonColor, type GuildConfigDTO } from './config'

export const PANEL_SELECT_ID = 'support:panel:select'
export const PANEL_BUTTON_PREFIX = 'support:panel:btn:'

const COLOR_TO_STYLE: Record<ButtonColor, ButtonStyle> = {
  blue: ButtonStyle.Primary,
  gray: ButtonStyle.Secondary,
  green: ButtonStyle.Success,
  red: ButtonStyle.Danger,
}

/** Un emoji de Discord válido, o undefined si el texto guardado no sirve como emoji (nunca tira la petición abajo). */
export function safeEmoji(raw: string | null | undefined): string | undefined {
  const value = (raw || '').trim()
  return value ? value : undefined
}

export function buildPanelMessage(config: GuildConfigDTO): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setTitle(config.panelTitle || 'Soporte')
    .setDescription(config.panelDescription || null)
    .setColor(parseInt(config.embedColor.replace('#', ''), 16) || 0x1274de)

  if (config.ticketTypes.length === 0) {
    return { embeds: [embed], components: [] }
  }

  if (config.panelStyle === 'buttons') {
    const rows: ActionRowBuilder<ButtonBuilder>[] = []
    for (let i = 0; i < config.ticketTypes.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>()
      for (const type of config.ticketTypes.slice(i, i + 5)) {
        const button = new ButtonBuilder()
          .setCustomId(`${PANEL_BUTTON_PREFIX}${type.id}`)
          .setLabel(type.label.slice(0, 80))
          .setStyle(COLOR_TO_STYLE[type.color] ?? ButtonStyle.Primary)
        const emoji = safeEmoji(type.emoji)
        if (emoji) button.setEmoji(emoji)
        row.addComponents(button)
      }
      rows.push(row)
    }
    return { embeds: [embed], components: rows }
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(PANEL_SELECT_ID)
    .setPlaceholder('Elige una categoría')
    .addOptions(
      config.ticketTypes.slice(0, 25).map((type) => ({
        label: type.label.slice(0, 100),
        value: type.id,
        description: type.description ? type.description.slice(0, 100) : undefined,
        emoji: safeEmoji(type.emoji),
      }))
    )
  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] }
}

/** Publica (o actualiza si ya existe) el mensaje del panel en su canal configurado. */
export async function publishPanel(guildId: string): Promise<{ updated: boolean; messageId: string }> {
  const config = await getGuildConfig(guildId)
  if (!config) throw new Error('Configuración de servidor no encontrada')
  if (!config.panelChannelId) throw new Error('Elige antes un canal para el panel')

  const guild = await discordClient.guilds.fetch(guildId)
  const channel = await guild.channels.fetch(config.panelChannelId)
  if (!channel?.isTextBased()) throw new Error('El canal configurado no es un canal de texto válido')

  const payload = buildPanelMessage(config)

  if (config.panelMessageId) {
    try {
      const existing = await channel.messages.fetch(config.panelMessageId)
      await existing.edit(payload)
      return { updated: true, messageId: existing.id }
    } catch {
      // El mensaje ya no existe (lo borraron a mano): se publica uno nuevo abajo.
    }
  }

  const sent = await channel.send(payload)
  await setPanelMessage(guildId, channel.id, sent.id)
  return { updated: false, messageId: sent.id }
}
