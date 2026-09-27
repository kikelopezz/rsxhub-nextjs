'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { guardTicketAccess } from '@/lib/ticket-access'
import { guardPlatformAdmin } from '@/app/admin/actions/admin-league'
import * as lifecycle from '@/lib/discord-bot/lifecycle'
import { publishPanel } from '@/lib/discord-bot/panel'
import { updateGuildConfig, type SettingsInput } from '@/lib/discord-bot/config'
import { createChannel, type CreatedChannel } from '@/lib/discord-bot/channels'
import { discordClient, disconnectDiscordBot } from '@/lib/discord-bot/client'
import { startDiscordBot } from '@/lib/discord-bot'
import { getBotStatus, type BotStatus } from '@/lib/discord-bot/status'
import { clearStoredToken, saveStoredToken } from '@/lib/discord-bot/token-store'

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
  await runTicketAction(formData, 'claimed', ({ guildId, ticketId, name }) =>
    lifecycle.claimTicket(guildId, ticketId, { name })
  )
}

export async function unclaimTicketAction(formData: FormData) {
  await runTicketAction(formData, 'unclaimed', ({ guildId, ticketId }) => lifecycle.unclaimTicket(guildId, ticketId))
}

export async function closeTicketAction(formData: FormData) {
  await runTicketAction(formData, 'closed', ({ guildId, ticketId, name, reason }) =>
    lifecycle.closeTicket(guildId, ticketId, { name }, reason || undefined)
  )
}

export async function reopenTicketAction(formData: FormData) {
  await runTicketAction(formData, 'reopened', ({ guildId, ticketId, name }) => lifecycle.reopenTicket(guildId, ticketId, { name }))
}

export async function mergeTicketAction(formData: FormData) {
  const targetTicketId = String(formData.get('targetTicketId') || '')
  await runTicketAction(formData, 'merged', ({ guildId, ticketId, name }) => {
    if (!targetTicketId) throw new Error('Elige el ticket principal con el que fusionar.')
    return lifecycle.mergeTicket(guildId, ticketId, targetTicketId, { name })
  })
}

export async function deleteTicketAction(formData: FormData) {
  await runTicketAction(formData, 'deleted', ({ guildId, ticketId }) => lifecycle.deleteTicket(guildId, ticketId))
}

export async function saveTicketNotesAction(formData: FormData) {
  await runTicketAction(formData, 'notes', ({ guildId, ticketId }) => lifecycle.saveTicketNotes(guildId, ticketId, String(formData.get('notes') || '')))
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

// ---------------------------------------------------------------- Bot de Discord (conexión)

const TOKEN_SHAPE = /^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/

export async function getDiscordBotStatusAction(): Promise<BotStatus> {
  await guardTicketAccess()
  return getBotStatus()
}

/**
 * Guarda el token del bot (cifrado, ver token-store.ts) y lo conecta al momento. Solo un admin de
 * la plataforma puede hacerlo: es una credencial global del bot, no algo de un servidor de
 * Discord concreto, así que pedir solo acceso a Soporte se quedaría corto.
 */
export async function saveDiscordBotTokenAction(formData: FormData): Promise<ActionResult> {
  await guardPlatformAdmin()
  if (process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, message: 'El token ya está fijado por una variable de entorno del servidor: no se puede cambiar desde aquí.' }
  }
  const token = String(formData.get('token') || '').trim()
  if (!TOKEN_SHAPE.test(token)) return { ok: false, message: 'Eso no tiene forma de token de bot de Discord.' }

  await saveStoredToken(token)
  try {
    await startDiscordBot()
    revalidatePath('/soporte')
    revalidatePath('/soporte/settings')
    return { ok: true, message: `Conectado como ${discordClient.user?.tag ?? 'el bot'}.` }
  } catch (e) {
    // Sin esto quedaría guardado un token que no funciona, y ni la web ni el aviso de "sin
    // configurar" volverían a dejar intentarlo con claridad.
    await clearStoredToken()
    return { ok: false, message: errorMessage(e, 'No se pudo conectar con ese token. Comprueba que sea correcto y no haya caducado.') }
  }
}

export async function disconnectDiscordBotAction(): Promise<ActionResult> {
  await guardPlatformAdmin()
  if (process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, message: 'No se puede desconectar: el token está fijado por una variable de entorno del servidor.' }
  }
  await clearStoredToken()
  disconnectDiscordBot()
  revalidatePath('/soporte')
  revalidatePath('/soporte/settings')
  return { ok: true, message: 'Token eliminado. El bot se ha desconectado.' }
}

export async function publishTicketPanelAction(guildId: string): Promise<ActionResult> {
  await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return { ok: false, message: 'Servidor no válido.' }
  try {
    await publishPanel(guildId)
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
    const channel = await createChannel(guildId, input)
    revalidatePath('/soporte/settings')
    return { ok: true, message: 'Creado.', channel }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'No se pudo crear en Discord.') }
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
