/**
 * Cliente (solo servidor) de la API interna del bot de tickets de Discord.
 * El bot corre como proceso aparte; aqui solo se le llama con la clave compartida.
 */

export type TicketStatus = 'open' | 'claimed' | 'closed'

export type TicketRow = {
  id: number
  guild_id: string
  channel_id: string
  number: number | null
  type_label: string | null
  opener_id: string
  opener_tag: string | null
  claimed_by: string | null
  claimed_by_tag: string | null
  status: TicketStatus
  created_at: string
  claimed_at: string | null
  closed_at: string | null
  closed_by: string | null
  close_reason: string | null
  transcript_file: string | null
}

export type TicketType = { id: string; emoji?: string; label: string; description?: string }

export type GuildConfig = {
  panel_title: string
  panel_description: string
  panel_channel_id: string | null
  panel_message_id: string | null
  category_id: string | null
  transcript_channel_id: string | null
  log_channel_id: string | null
  staff_role_ids: string[]
  ticket_types: TicketType[]
  welcome_message: string
  embed_color: string
  max_open_tickets: number
}

export type GuildDetails = {
  id: string
  name: string
  icon: string | null
  memberCount: number
  categories: Array<{ id: string; name: string }>
  textChannels: Array<{ id: string; name: string; parentId: string | null }>
  roles: Array<{ id: string; name: string; color: string }>
}

export type TicketStats = {
  total: number
  open: number
  claimed: number
  closed: number
  topStaff: Array<{ staffId: string; staffTag: string; handled: number }>
}

export type GuildSummary = { id: string; name: string; icon: string | null; memberCount: number }

export class TicketApiError extends Error {}

async function rawCall(path: string, init?: RequestInit): Promise<Response> {
  const base = process.env.TICKET_API_URL
  const key = process.env.TICKET_API_KEY
  if (!base || !key) {
    throw new TicketApiError('El bot de tickets no está configurado (faltan TICKET_API_URL / TICKET_API_KEY).')
  }
  try {
    return await fetch(`${base.replace(/\/$/, '')}/internal${path}`, {
      ...init,
      headers: { 'x-api-key': key, 'content-type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new TicketApiError('No se pudo conectar con el bot de tickets. ¿Está encendido y es accesible desde el Hub?')
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await rawCall(path, init)
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new TicketApiError(data?.error || `El bot respondió con error ${res.status}.`)
  return data as T
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body ?? {}) })

export async function listGuilds() {
  const data = await call<{ botReady: boolean; guilds: GuildSummary[] }>('/guilds')
  return data
}

export async function getOverview(guildId: string) {
  return call<{ guild: GuildDetails; config: GuildConfig; stats: TicketStats }>(`/guilds/${guildId}/overview`)
}

export async function listTickets(guildId: string, status?: TicketStatus) {
  const qs = status ? `?status=${status}` : ''
  return (await call<{ tickets: TicketRow[] }>(`/guilds/${guildId}/tickets${qs}`)).tickets
}

export const saveSettings = (guildId: string, settings: Partial<GuildConfig>) =>
  call(`/guilds/${guildId}/settings`, { method: 'PUT', body: JSON.stringify(settings) })

export const publishPanel = (guildId: string) => call(`/guilds/${guildId}/panel/publish`, post())

export const claimTicket = (guildId: string, ticketId: number, staffName: string) =>
  call(`/guilds/${guildId}/tickets/${ticketId}/claim`, post({ staff: { name: staffName } }))

export const unclaimTicket = (guildId: string, ticketId: number) =>
  call(`/guilds/${guildId}/tickets/${ticketId}/unclaim`, post())

export const closeTicket = (guildId: string, ticketId: number, staffName: string, reason?: string) =>
  call(`/guilds/${guildId}/tickets/${ticketId}/close`, post({ staff: { name: staffName }, reason }))

export const deleteTicket = (guildId: string, ticketId: number) =>
  call(`/guilds/${guildId}/tickets/${ticketId}/delete`, post())

export async function fetchTranscript(filename: string): Promise<Response> {
  return rawCall(`/transcripts/${encodeURIComponent(filename)}`, { headers: { 'content-type': 'text/html' } })
}
