/**
 * Cliente HTTP hacia el bot de soporte, que ahora corre como proceso aparte (carpeta
 * `rsx ticket`, hermana de este repo) en vez de estar integrado en el Hub. Solo lo que de verdad
 * necesita tocar Discord (crear canales, publicar el panel, ciclo de vida de tickets, estado de
 * conexión) pasa por aquí — el resto (listado de tickets, notas, configuración del guild) sigue
 * leyendo/escribiendo la misma base de datos directamente, ver lib/support-config.ts.
 *
 * Nombres de función iguales a los que antes exportaba lib/discord-bot/* para que el resto del
 * Hub (app/soporte/actions.ts y páginas) apenas tuviera que cambiar el import.
 */

import type { GuildDetails, GuildSummary } from './support-types'

export type { GuildDetails, GuildSummary } from './support-types'

export type BotStatus = {
  configured: boolean
  ready: boolean
  tag: string | null
  guildCount: number
  applicationId: string | null
  lastError: string | null
  guilds: GuildSummary[]
}

export type CreatedChannel = { id: string; name: string; parentId: string | null; kind: 'text' | 'category' }
export type Staff = { userId?: string; name: string }

const BASE_URL = process.env.SUPPORT_BOT_URL?.replace(/\/+$/, '')
const API_KEY = process.env.SUPPORT_BOT_API_KEY

const UNREACHABLE_STATUS: BotStatus = {
  configured: false,
  ready: false,
  tag: null,
  guildCount: 0,
  applicationId: null,
  lastError: 'El bot de soporte no está configurado en el Hub (falta SUPPORT_BOT_URL/SUPPORT_BOT_API_KEY).',
  guilds: [],
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL || !API_KEY) throw new Error('SUPPORT_BOT_URL / SUPPORT_BOT_API_KEY no configurados en el Hub.')
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}`, ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || `El bot respondió con un error (${res.status}).`)
  return body as T
}

/**
 * A diferencia de las demás funciones, esta nunca lanza: las páginas de /soporte la usan para
 * pintar el estado (incluido "no se pudo contactar con el bot"), no tiene sentido tirarlas abajo
 * con un error 500 solo porque el proceso del bot esté reiniciándose.
 */
export async function getBotStatus(): Promise<BotStatus> {
  if (!BASE_URL || !API_KEY) return UNREACHABLE_STATUS
  try {
    return await call<BotStatus>('/status')
  } catch (err) {
    return { ...UNREACHABLE_STATUS, lastError: err instanceof Error ? err.message : 'No se pudo contactar con el bot.' }
  }
}

export async function getGuildDetails(guildId: string): Promise<GuildDetails | null> {
  try {
    return await call<GuildDetails>(`/guilds/${guildId}`)
  } catch {
    return null
  }
}

export function publishPanel(guildId: string) {
  return call<{ updated: boolean; messageId: string }>(`/guilds/${guildId}/panel/publish`, { method: 'POST' })
}

export function createChannel(guildId: string, input: { name: string; kind: 'text' | 'category'; staffOnly?: boolean }) {
  return call<CreatedChannel>(`/guilds/${guildId}/channels`, { method: 'POST', body: JSON.stringify(input) })
}

export function claimTicket(guildId: string, ticketId: string, staff: Staff) {
  return call(`/tickets/${ticketId}/claim`, { method: 'POST', body: JSON.stringify({ guildId, staff }) })
}

export function unclaimTicket(guildId: string, ticketId: string) {
  return call(`/tickets/${ticketId}/unclaim`, { method: 'POST', body: JSON.stringify({ guildId }) })
}

export function closeTicket(guildId: string, ticketId: string, staff: Staff, reason?: string) {
  return call(`/tickets/${ticketId}/close`, { method: 'POST', body: JSON.stringify({ guildId, staff, reason }) })
}

export function reopenTicket(guildId: string, ticketId: string, staff: Staff) {
  return call(`/tickets/${ticketId}/reopen`, { method: 'POST', body: JSON.stringify({ guildId, staff }) })
}

export function mergeTicket(guildId: string, ticketId: string, targetTicketId: string, staff: Staff) {
  return call(`/tickets/${ticketId}/merge`, { method: 'POST', body: JSON.stringify({ guildId, targetTicketId, staff }) })
}

export function deleteTicket(guildId: string, ticketId: string) {
  return call(`/tickets/${ticketId}`, { method: 'DELETE', body: JSON.stringify({ guildId }) })
}
