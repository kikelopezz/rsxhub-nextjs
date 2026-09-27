import { EmbedBuilder, OverwriteType, type TextChannel } from 'discord.js'
import { db } from '@/lib/db'
import type { SupportTicket } from '@prisma/client'
import { discordClient, ensureDiscordLogin } from './client'
import { getGuildConfig } from './config'
import { saveTranscript } from './transcript'

export class TicketActionError extends Error {}

export type Staff = { userId?: string; name: string }

/** Canal de Discord del ticket, o null si el bot no está disponible o el canal ya no existe (no lanza). */
async function tryGetChannel(channelId: string): Promise<TextChannel | null> {
  try {
    await ensureDiscordLogin()
    const channel = await discordClient.channels.fetch(channelId)
    return channel?.isTextBased() && 'send' in channel ? (channel as TextChannel) : null
  } catch (err) {
    console.error('[support] no se pudo obtener el canal del ticket:', err)
    return null
  }
}

async function findTicket(guildId: string, ticketId: string): Promise<SupportTicket> {
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } })
  if (!ticket || ticket.guildId !== guildId) throw new TicketActionError('Ticket no encontrado.')
  return ticket
}

async function postNote(channel: TextChannel | null, text: string) {
  if (!channel) return
  try {
    await channel.send({ embeds: [new EmbedBuilder().setDescription(text).setColor(0x1274de)] })
  } catch (err) {
    console.error('[support] no se pudo avisar en el canal del ticket:', err)
  }
}

// El tipo va siempre explícito (ver el mismo comentario en create-ticket.ts): sin él, discord.js
// intenta adivinarlo buscando a la persona en caché y falla si no la tiene.
async function lockChannel(channel: TextChannel | null, openerId: string) {
  if (!channel) return
  try {
    await channel.permissionOverwrites.edit(openerId, { SendMessages: false }, { type: OverwriteType.Member })
  } catch (err) {
    console.error('[support] no se pudo bloquear el canal del ticket:', err)
  }
}

async function unlockChannel(channel: TextChannel | null, openerId: string) {
  if (!channel) return
  try {
    await channel.permissionOverwrites.edit(openerId, { SendMessages: true }, { type: OverwriteType.Member })
  } catch (err) {
    console.error('[support] no se pudo reabrir el canal del ticket:', err)
  }
}

export async function claimTicket(guildId: string, ticketId: string, staff: Staff) {
  const ticket = await findTicket(guildId, ticketId)
  if (ticket.status === 'closed' || ticket.status === 'merged') throw new TicketActionError('Este ticket ya está cerrado.')
  if (ticket.claimedBy && ticket.claimedBy !== staff.userId) {
    // Se puede reclamar igualmente (p. ej. el otro staff ya no está disponible); solo se avisa en Discord.
  }
  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'claimed', claimedBy: staff.userId || `hub:${staff.name}`, claimedByTag: staff.name, claimedAt: new Date() },
  })
  await postNote(await tryGetChannel(ticket.channelId), `🧑‍🔧 **${staff.name}** ha reclamado este ticket.`)
  return updated
}

export async function unclaimTicket(guildId: string, ticketId: string) {
  const ticket = await findTicket(guildId, ticketId)
  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'open', claimedBy: null, claimedByTag: null, claimedAt: null },
  })
  await postNote(await tryGetChannel(ticket.channelId), '↩️ Este ticket ha vuelto a quedar sin reclamar.')
  return updated
}

export async function closeTicket(guildId: string, ticketId: string, staff: Staff, reason?: string) {
  const ticket = await findTicket(guildId, ticketId)
  if (ticket.status === 'closed') return ticket

  const channel = await tryGetChannel(ticket.channelId)
  const transcriptUrl = channel ? await saveTranscript(guildId, ticketId, ticket.code, channel).catch(() => null) : null

  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'closed', closedAt: new Date(), closedBy: staff.userId || `hub:${staff.name}`, closedByTag: staff.name, closeReason: reason || null, transcriptUrl },
  })

  await lockChannel(channel, ticket.openerId)
  await postNote(
    channel,
    `🔒 **${staff.name}** ha cerrado este ticket.${reason ? `\nMotivo: ${reason}` : ''}${transcriptUrl ? `\n[Ver transcripción](${transcriptUrl})` : ''}`
  )

  const config = await getGuildConfig(guildId)
  if (config?.logChannelId) {
    const logChannel = await tryGetChannel(config.logChannelId)
    await postNote(logChannel, `🔒 Ticket **${ticket.code}** cerrado por **${staff.name}**.${transcriptUrl ? ` [Transcripción](${transcriptUrl})` : ''}`)
  }

  return updated
}

export async function reopenTicket(guildId: string, ticketId: string, staff: Staff) {
  const ticket = await findTicket(guildId, ticketId)
  if (ticket.status !== 'closed') throw new TicketActionError('Este ticket no está cerrado.')
  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'open', closedAt: null, closedBy: null, closedByTag: null, closeReason: null },
  })
  const channel = await tryGetChannel(ticket.channelId)
  await unlockChannel(channel, ticket.openerId)
  await postNote(channel, `🔓 **${staff.name}** ha reabierto este ticket.`)
  return updated
}

export async function mergeTicket(guildId: string, ticketId: string, targetTicketId: string, staff: Staff) {
  if (ticketId === targetTicketId) throw new TicketActionError('No puedes fusionar un ticket consigo mismo.')
  const ticket = await findTicket(guildId, ticketId)
  const target = await findTicket(guildId, targetTicketId)

  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'merged', mergedIntoId: target.id },
  })

  const channel = await tryGetChannel(ticket.channelId)
  await lockChannel(channel, ticket.openerId)
  await postNote(channel, `🔀 **${staff.name}** ha fusionado este ticket con **${target.code}**.`)
  return updated
}

export async function deleteTicket(guildId: string, ticketId: string) {
  const ticket = await findTicket(guildId, ticketId)
  const channel = await tryGetChannel(ticket.channelId)
  if (channel) {
    try {
      await channel.delete('Ticket eliminado desde el Hub')
    } catch (err) {
      console.error('[support] no se pudo borrar el canal del ticket:', err)
    }
  }
  await db.supportTicket.delete({ where: { id: ticketId } })
}

export async function saveTicketNotes(guildId: string, ticketId: string, notes: string) {
  await findTicket(guildId, ticketId)
  return db.supportTicket.update({ where: { id: ticketId }, data: { internalNotes: notes.slice(0, 4000) } })
}
