'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardTicketAccess, guardTicketSuperAdmin } from '@/lib/ticket-access'
import * as ticketsApi from '@/lib/tickets-api'
import type { GuildConfig } from '@/lib/tickets-api'

const GUILD_ID = /^\d{5,25}$/
const STEAM_ID = /^\d{10,20}$/

async function staffName(session: { userId: string; steamDisplayName: string }) {
  const profile = await db.profile.findUnique({ where: { userId: session.userId } }).catch(() => null)
  return profile?.displayName || session.steamDisplayName
}

function errorMessage(error: unknown) {
  return error instanceof ticketsApi.TicketApiError ? error.message : 'Error inesperado al hablar con el bot de tickets.'
}

function backTo(formData: FormData, params: Record<string, string>): never {
  const status = String(formData.get('returnStatus') || '')
  const guild = String(formData.get('guildId') || '')
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(GUILD_ID.test(guild) ? { guild } : {}), ...params })
  redirect(`/admin/tickets?${qs.toString()}`)
}

async function runTicketAction(
  formData: FormData,
  okKey: string,
  run: (ctx: { guildId: string; ticketId: number; name: string; reason: string }) => Promise<unknown>
): Promise<never> {
  const { session } = await guardTicketAccess()

  const guildId = String(formData.get('guildId') || '')
  const ticketId = Number(formData.get('ticketId'))
  if (!GUILD_ID.test(guildId) || !Number.isInteger(ticketId)) backTo(formData, { error: 'Datos de ticket no válidos.' })

  let error: string | null = null
  try {
    await run({
      guildId,
      ticketId,
      name: await staffName(session),
      reason: String(formData.get('reason') || '').trim(),
    })
  } catch (e) {
    error = errorMessage(e)
  }

  revalidatePath('/admin/tickets')
  backTo(formData, error ? { error } : { ok: okKey })
}

export async function claimTicketAction(formData: FormData) {
  await runTicketAction(formData, 'claimed', (c) => ticketsApi.claimTicket(c.guildId, c.ticketId, c.name))
}

export async function unclaimTicketAction(formData: FormData) {
  await runTicketAction(formData, 'unclaimed', (c) => ticketsApi.unclaimTicket(c.guildId, c.ticketId))
}

export async function closeTicketAction(formData: FormData) {
  await runTicketAction(formData, 'closed', (c) => ticketsApi.closeTicket(c.guildId, c.ticketId, c.name, c.reason || undefined))
}

export async function deleteTicketAction(formData: FormData) {
  await runTicketAction(formData, 'deleted', (c) => ticketsApi.deleteTicket(c.guildId, c.ticketId))
}

type ActionResult = { ok: boolean; message: string }

export async function saveTicketSettingsAction(guildId: string, settings: Partial<GuildConfig>): Promise<ActionResult> {
  await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return { ok: false, message: 'Servidor no válido.' }
  try {
    await ticketsApi.saveSettings(guildId, settings)
    revalidatePath('/admin/tickets/settings')
    return { ok: true, message: 'Configuración guardada.' }
  } catch (e) {
    return { ok: false, message: errorMessage(e) }
  }
}

export async function publishTicketPanelAction(guildId: string): Promise<ActionResult> {
  await guardTicketAccess()
  if (!GUILD_ID.test(guildId)) return { ok: false, message: 'Servidor no válido.' }
  try {
    await ticketsApi.publishPanel(guildId)
    revalidatePath('/admin/tickets/settings')
    return { ok: true, message: 'Panel publicado en Discord.' }
  } catch (e) {
    return { ok: false, message: errorMessage(e) }
  }
}

export async function grantTicketAccessAction(formData: FormData) {
  const session = await guardTicketSuperAdmin()

  const steamId = String(formData.get('steamId') || '').trim()
  if (!STEAM_ID.test(steamId)) redirect('/admin/tickets/access?error=invalid-steamid')

  try {
    const profile = await db.profile.findUnique({ where: { userId: session.userId } })
    const grantedByName = profile?.displayName || session.steamDisplayName
    await db.ticketAccessGrant.upsert({
      where: { steamId },
      create: { steamId, grantedByUserId: session.userId, grantedByName },
      update: { grantedByUserId: session.userId, grantedByName },
    })
  } catch (error) {
    console.error('Failed to grant ticket access:', error)
    redirect('/admin/tickets/access?error=grant-failed')
  }

  invalidateCache(['ticket_access_steam_ids'])
  revalidatePath('/admin/tickets/access')
  redirect('/admin/tickets/access?ok=granted')
}

export async function revokeTicketAccessAction(formData: FormData) {
  await guardTicketSuperAdmin()

  const steamId = String(formData.get('steamId') || '').trim()
  if (!STEAM_ID.test(steamId)) redirect('/admin/tickets/access?error=invalid-steamid')

  try {
    await db.ticketAccessGrant.delete({ where: { steamId } })
  } catch (error) {
    console.error('Failed to revoke ticket access:', error)
  }

  invalidateCache(['ticket_access_steam_ids'])
  revalidatePath('/admin/tickets/access')
  redirect('/admin/tickets/access?ok=revoked')
}
