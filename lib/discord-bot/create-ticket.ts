import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  OverwriteType,
  PermissionsBitField,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { db } from '@/lib/db'
import { discordClient } from './client'
import { PANEL_BUTTON_PREFIX, PANEL_SELECT_ID, safeEmoji } from './panel'
import { getGuildConfig, nextCounter, type Campeonato, type GuildConfigDTO } from './config'
import { channelNameFor, ticketCode } from './naming'

const OVERWRITE = PermissionsBitField.Flags
const CAMPEONATO_SELECT_PREFIX = 'support:campeonato:'
const GENERAL_CAMPEONATO_VALUE = '__general__'

// Evita que un doble clic (o dos respuestas casi simultáneas al selector de campeonato) cree dos
// canales para la misma persona mientras la primera petición todavía se está resolviendo.
const inFlight = new Set<string>()

async function withLock(guildId: string, userId: string, onBusy: () => Promise<unknown>, fn: () => Promise<void>) {
  const key = `${guildId}:${userId}`
  if (inFlight.has(key)) {
    await onBusy()
    return
  }
  inFlight.add(key)
  try {
    await fn()
  } finally {
    inFlight.delete(key)
  }
}

async function countOpenTickets(guildId: string, openerId: string) {
  return db.supportTicket.count({ where: { guildId, openerId, status: { in: ['open', 'claimed'] } } })
}

export function isPanelInteraction(customId: string) {
  return customId === PANEL_SELECT_ID || customId.startsWith(PANEL_BUTTON_PREFIX)
}

export function isCampeonatoInteraction(customId: string) {
  return customId.startsWith(CAMPEONATO_SELECT_PREFIX)
}

export async function handlePanelInteraction(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const typeId = interaction.isStringSelectMenu() ? interaction.values[0] : interaction.customId.slice(PANEL_BUTTON_PREFIX.length)
  if (!interaction.guildId) return

  await interaction.deferReply({ ephemeral: true })

  const config = await getGuildConfig(interaction.guildId)
  if (!config) {
    await interaction.editReply('Este servidor no tiene el soporte configurado todavía.')
    return
  }

  await withLock(
    interaction.guildId,
    interaction.user.id,
    () => interaction.editReply('Ya se está creando tu ticket, espera un momento.'),
    async () => {
      const openCount = await countOpenTickets(interaction.guildId!, interaction.user.id)
      if (openCount >= (config.maxOpenTickets || 1)) {
        await interaction.editReply(`Ya tienes ${openCount} ticket(s) abierto(s). Cierra el anterior antes de abrir uno nuevo.`)
        return
      }

      // Con campeonatos configurados, elegir uno es obligatorio: el canal no se crea todavía.
      if (config.campeonatos.length > 0) {
        await promptCampeonato(interaction, typeId, config.campeonatos)
        return
      }

      await finishCreateTicket(interaction, config, typeId, null)
    }
  )
}

async function promptCampeonato(interaction: ButtonInteraction | StringSelectMenuInteraction, typeId: string, campeonatos: Campeonato[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${CAMPEONATO_SELECT_PREFIX}${typeId || 'default'}`)
    .setPlaceholder('Selecciona un campeonato')
    .addOptions([
      ...campeonatos.slice(0, 24).map((c) => ({ label: c.label, value: c.id, emoji: safeEmoji(c.emoji) })),
      // Para lo que no es de ningún campeonato (facturación, dudas generales...)
      { label: 'General', value: GENERAL_CAMPEONATO_VALUE, emoji: safeEmoji('📁') },
    ])

  await interaction.editReply({
    content: '¿De qué campeonato es esto?',
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  })
}

export async function handleCampeonatoInteraction(interaction: StringSelectMenuInteraction) {
  if (!interaction.guildId) return
  const typeIdRaw = interaction.customId.slice(CAMPEONATO_SELECT_PREFIX.length)
  const typeId = typeIdRaw === 'default' ? '' : typeIdRaw

  const config = await getGuildConfig(interaction.guildId)
  if (!config) return

  const isGeneral = interaction.values[0] === GENERAL_CAMPEONATO_VALUE
  const campeonato: Campeonato | null = isGeneral
    ? { id: GENERAL_CAMPEONATO_VALUE, label: 'General', emoji: '', categoryId: null }
    : config.campeonatos.find((c) => c.id === interaction.values[0]) || null

  await interaction.deferUpdate()

  if (!campeonato) {
    await interaction.editReply({ content: 'Ese campeonato ya no está disponible. Vuelve a pulsar "Crear ticket".', components: [] })
    return
  }

  await withLock(
    interaction.guildId,
    interaction.user.id,
    () => interaction.editReply({ content: 'Ya se está creando tu ticket, espera un momento.', components: [] }),
    () => finishCreateTicket(interaction, config, typeId, campeonato)
  )
}

async function finishCreateTicket(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  config: GuildConfigDTO,
  typeId: string,
  campeonato: Campeonato | null
) {
  const openCount = await countOpenTickets(interaction.guildId!, interaction.user.id)
  if (openCount >= (config.maxOpenTickets || 1)) {
    await interaction.editReply({ content: `Ya tienes ${openCount} ticket(s) abierto(s). Cierra el anterior antes de abrir uno nuevo.`, components: [] })
    return
  }

  const type = config.ticketTypes.find((t) => t.id === typeId) || null
  const typeLabel = type?.label || 'Ticket'
  // El campeonato manda sobre la categoría general del servidor: cada uno puede tener la suya.
  const categoryId = campeonato?.categoryId || config.categoryId || null

  const guild = interaction.guild
  if (!guild) return

  const seq = await nextCounter(guild.id, typeId || 'default')
  const code = ticketCode(typeLabel, seq)
  const campeonatoLabel = campeonato && campeonato.id !== '__general__' ? `${campeonato.emoji ? `${campeonato.emoji} ` : ''}${campeonato.label}` : campeonato?.label || null

  // El tipo (rol o miembro) se indica siempre explícito: sin el intent de miembros, un usuario
  // que abre su primer ticket puede no estar en caché todavía, y discord.js necesita saberlo
  // para resolver el overwrite en vez de adivinarlo buscándolo en caché (y fallar si no está).
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [OVERWRITE.ViewChannel], type: OverwriteType.Role },
    {
      id: interaction.user.id,
      allow: [OVERWRITE.ViewChannel, OVERWRITE.SendMessages, OVERWRITE.ReadMessageHistory, OVERWRITE.AttachFiles],
      type: OverwriteType.Member,
    },
    // Sin esto, el propio bot se queda fuera de un canal que él mismo acaba de crear: al ocultarlo
    // a @everyone, si el bot no tiene Administrator necesita su propio permiso explícito para entrar.
    // (Nunca ManageChannels/ManageRoles aquí: Discord no deja concederlos vía overwrite aunque el
    // bot ya los tenga a nivel de servidor — es su protección contra escalado de permisos; como
    // nada los deniega en ningún sitio, el bot los conserva igual sin necesidad de repetirlos.)
    {
      id: discordClient.user!.id,
      allow: [OVERWRITE.ViewChannel, OVERWRITE.SendMessages, OVERWRITE.ReadMessageHistory, OVERWRITE.AttachFiles, OVERWRITE.EmbedLinks],
      type: OverwriteType.Member,
    },
    ...config.staffRoleIds.map((roleId) => ({
      id: roleId,
      allow: [OVERWRITE.ViewChannel, OVERWRITE.SendMessages, OVERWRITE.ReadMessageHistory, OVERWRITE.ManageMessages],
      type: OverwriteType.Role,
    })),
  ]

  let parent: string | undefined
  if (categoryId) {
    const category = await guild.channels.fetch(categoryId).catch(() => null)
    if (category?.type === ChannelType.GuildCategory) parent = category.id
  }

  const channel = await guild.channels.create({
    name: channelNameFor(code),
    type: ChannelType.GuildText,
    parent,
    topic: `${code}${campeonatoLabel ? ` · ${campeonatoLabel}` : ''} · Abierto por ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites: overwrites,
  })

  const ticket = await db.supportTicket.create({
    data: {
      guildId: guild.id,
      channelId: channel.id,
      number: seq,
      code,
      typeId: type?.id || null,
      typeLabel,
      campeonatoId: campeonato?.id === GENERAL_CAMPEONATO_VALUE ? null : campeonato?.id || null,
      campeonatoLabel,
      openerId: interaction.user.id,
      openerTag: interaction.user.tag,
    },
  })

  const welcomeText = (type?.welcome || config.welcomeMessage || '').replace(/\{user\}/g, `<@${interaction.user.id}>`)
  const pingRoleId = type?.pingRoleId || config.pingRoleId
  const embed = new EmbedBuilder()
    .setTitle(code)
    .setDescription(welcomeText || `Gracias por abrir un ticket, <@${interaction.user.id}>.`)
    .setColor(parseInt(config.embedColor.replace('#', ''), 16) || 0x1274de)
    .setFooter({ text: 'Gestiona este ticket desde /soporte en el Hub.' })

  await channel.send({
    content: pingRoleId ? `<@&${pingRoleId}>` : undefined,
    embeds: [embed],
  })

  await interaction.editReply({ content: `Tu ticket se ha creado: <#${channel.id}>`, components: [] })
  void ticket
}
