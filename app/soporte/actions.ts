'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { guardTicketAccess } from '@/lib/ticket-access'
import { guardPlatformAdmin } from '@/app/admin/actions/admin-league'
import { updateGuildConfig, type SettingsInput } from '@/lib/support-config'
import * as bot from '@/lib/support-bot-client'
import type { CreatedChannel } from '@/lib/support-bot-client'

const GUILD_ID = /^\d{5,25}$/
const STEAM_ID = /^\d{10,20}$/

function staffName(session: { steamDisplayName: string }) {
  return session.steamDisplayName
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function backTo(formData: FormData, params: Record<string, string>): never {
  const status = String(formData.get('returnStatus') || '')
  const guild = String(formData.get('guildId') || '')
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(GUILD_ID.test(guild) ? { guild } : {}), ...params })
  redirect(`/soporte?${qs.toString()}`)
}

async function runTicketAction(
  formData: FormData,
  okKey: string,
  run: (ctx: { guildId: string; ticketId: string; name: string; reason: string }) => Promise<unknown>
): Promise<never> {
  const { session } = await guardTicketAccess()

  const guildId = String(formData.get('guildId') || '')
  const ticketId = String(formData.get('ticketId') || '')
  if (!GUILD_ID.test(guildId) || !ticketId) backTo(formData, { error: 'Datos de ticket no válidos.' })

  let error: string | null = null
  try {
    await run({ guildId, ticketId, name: staffName(session), reason: String(formData.get('reason') || '').trim() })
  } catch (e) {
    error = errorMessage(e, 'Error inesperado.')
  }

  revalidatePath('/soporte')
  backTo(formData, error ? { error } : { ok: okKey })
}

export async function claimTicketAction(formData: FormData) {
  await runTicketAction(formData, 'claimed', ({ guildId, ticketId, name }) => bot.claimTicket(guildId, ticketId, { name }))
}

export async function unclaimTicketAction(formData: FormData) {
  await runTicketAction(formData, 'unclaimed', ({ guildId, ticketId }) => bot.unclaimTicket(guildId, ticketId))
}

export async function closeTicketAction(formData: FormData) {
  await runTicketAction(formData, 'closed', ({ guildId, ticketId, name, reason }) => bot.closeTicket(guildId, ticketId, { name }, reason || undefined))
}

export async function reopenTicketAction(formData: FormData) {
  await runTicketAction(formData, 'reopened', ({ guildId, ticketId, name }) => bot.reopenTicket(guildId, ticketId, { name }))
}

export async function mergeTicketAction(formData: FormData) {
  const targetTicketId = String(formData.get('targetTicketId') || '')
  await runTicketAction(formData, 'merged', ({ guildId, ticketId, name }) => {
    if (!targetTicketId) throw new Error('Elige el ticket principal con el que fusionar.')
    return bot.mergeTicket(guildId, ticketId, targetTicketId, { name })
  })
}

export async function deleteTicketAction(formData: FormData) {
  await runTicketAction(formData, 'deleted', ({ guildId, ticketId }) => bot.deleteTicket(guildId, ticketId))
}

export async function saveTicketNotesAction(formData: FormData) {
  // No toca Discord para nada, así que se escribe directo en la base de datos (no hace falta
  // pasar por la API del bot, a diferencia del resto de acciones de esta lista).
  await runTicketAction(formData, 'notes', async ({ guildId, ticketId }) => {
    const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.guildId !== guildId) throw new Error('Ticket no encontrado.')
    await db.supportTicket.update({ where: { id: ticketId }, data: { internalNotes: String(formData.get('notes') || '').slice(0, 4000) } })
  })
}

type ActionResult = { ok: boolean; message: string }

export async function saveTicketSettingsAction(guildId: string, settings: SettingsInput): Promise<ActionResult> {
  await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return { ok: false, message: 'Servidor no válido.' }
  try {
    await updateGuildConfig(guildId, settings)
    revalidatePath('/soporte/settings')
    return { ok: true, message: 'Configuración guardada.' }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'No se pudo guardar la configuración.') }
  }
}

// ---------------------------------------------------------------- Bot de Discord (estado)

export async function getDiscordBotStatusAction() {
  await guardTicketAccess()
  return bot.getBotStatus()
}

export async function publishTicketPanelAction(guildId: string): Promise<ActionResult> {
  await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return { ok: false, message: 'Servidor no válido.' }
  try {
    await bot.publishPanel(guildId)
    revalidatePath('/soporte/settings')
    return { ok: true, message: 'Panel publicado en Discord.' }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'No se pudo publicar el panel.') }
  }
}

export async function createDiscordChannelAction(
  guildId: string,
  input: { name: string; kind: 'text' | 'category'; staffOnly?: boolean }
): Promise<{ ok: boolean; message: string; channel?: CreatedChannel }> {
  await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return { ok: false, message: 'Servidor no válido.' }
  try {
    const channel = await bot.createChannel(guildId, input)
    revalidatePath('/soporte/settings')
    return { ok: true, message: 'Creado.', channel }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'No se pudo crear en Discord.') }
  }
}

// ---------------------------------------------------------------- Chat en vivo del ticket

export async function getTicketMessagesAction(guildId: string, ticketId: string, afterId?: string) {
  await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return []
  return bot.getTicketMessages(guildId, ticketId, afterId)
}

export async function sendTicketMessageAction(guildId: string, ticketId: string, content: string): Promise<ActionResult> {
  const { session } = await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return { ok: false, message: 'Servidor no válido.' }
  try {
    await bot.sendTicketMessage(guildId, ticketId, staffName(session), content)
    return { ok: true, message: 'Enviado.' }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'No se pudo enviar el mensaje.') }
  }
}

// ---------------------------------------------------------------- CRM (notas por Discord ID)

export async function addCrmNoteAction(formData: FormData) {
  const { session } = await guardTicketAccess()
  const guildId = String(formData.get('guildId') || '')
  const targetDiscordId = String(formData.get('targetDiscordId') || '')
  const targetTag = String(formData.get('targetTag') || '') || null
  const body = String(formData.get('body') || '').trim()

  if (GUILD_ID.test(guildId) && targetDiscordId && body) {
    await db.supportNote.create({
      data: { guildId, targetDiscordId, targetTag, body: body.slice(0, 2000), authorUserId: session.userId, authorName: session.steamDisplayName },
    })
  }
  revalidatePath(`/soporte/crm/${targetDiscordId}`)
}

export async function deleteCrmNoteAction(formData: FormData) {
  await guardTicketAccess()
  const id = String(formData.get('id') || '')
  const targetDiscordId = String(formData.get('targetDiscordId') || '')
  if (id) await db.supportNote.delete({ where: { id } }).catch(() => {})
  revalidatePath(`/soporte/crm/${targetDiscordId}`)
}

// ---------------------------------------------------------------- Acceso a Soporte (solo super admins)

export async function grantTicketAccessAction(formData: FormData) {
  const session = await guardPlatformAdmin()
  const steamId = String(formData.get('steamId') || '').trim()
  if (!STEAM_ID.test(steamId)) redirect('/admin?tab=soporte&soporte=invalid-steamid')

  await db.ticketAccessGrant.upsert({
    where: { steamId },
    create: { steamId, grantedByUserId: session.userId, grantedByName: session.steamDisplayName },
    update: { grantedByUserId: session.userId, grantedByName: session.steamDisplayName },
  })
  revalidatePath('/admin')
  redirect('/admin?tab=soporte&granted=1')
}

export async function revokeTicketAccessAction(formData: FormData) {
  await guardPlatformAdmin()
  const steamId = String(formData.get('steamId') || '').trim()
  if (steamId) await db.ticketAccessGrant.delete({ where: { steamId } }).catch(() => {})
  revalidatePath('/admin')
  redirect('/admin?tab=soporte&revoked=1')
}
