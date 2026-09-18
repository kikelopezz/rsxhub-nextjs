import { fetchWithTTLCache } from '@/lib/ttl-cache'

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
  type_id: string | null
  code: string | null
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

export type TicketType = { id: string; emoji?: string; label: string; description?: string; welcome?: string }

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

export class TicketApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

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
      // Si el bot no contesta, mejor fallar pronto y mostrar el error que dejar la pagina colgada.
      signal: AbortSignal.timeout(6000),
    })
  } catch (error) {
    console.error(`[tickets-api] ${init?.method || 'GET'} ${path} falló:`, error)
    throw new TicketApiError('No se pudo conectar con el bot de tickets. ¿Está encendido y es accesible desde el Hub?')
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await rawCall(path, init)
  const data = await res.json().catch(() => null)
  // Una versión antigua del bot responde a rutas que no conoce con una página HTML (no JSON): se trata como "no existe".
  if (data === null) throw new TicketApiError('El bot respondió algo inesperado (¿versión antigua del bot?).', 404)
  if (!res.ok || !data?.ok) throw new TicketApiError(data?.error || `El bot respondió con error ${res.status}.`, res.status)
  return data as T
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body ?? {}) })

// El bot casi nunca cambia de servidores: se cachea un minuto para no repetir esta llamada en cada refresco.
export async function listGuilds() {
  return fetchWithTTLCache('ticket_bot_guilds', () => call<{ botReady: boolean; guilds: GuildSummary[] }>('/guilds'), 60)
}

export async function getOverview(guildId: string) {
  return call<{ guild: GuildDetails; config: GuildConfig; stats: TicketStats }>(`/guilds/${guildId}/overview`)
}

/** Estadisticas + tickets en una sola llamada (sin Discord). Con un bot antiguo, que aun no la tiene, cae a las dos llamadas de antes. */
export async function getDashboard(guildId: string, status?: TicketStatus) {
  try {
    const qs = status ? `?status=${status}` : ''
    const { stats, tickets } = await call<{ stats: TicketStats; tickets: TicketRow[] }>(`/guilds/${guildId}/dashboard${qs}`)
    return { stats, tickets }
  } catch (error) {
    if (!(error instanceof TicketApiError) || error.status !== 404) throw error
    const [overview, tickets] = await Promise.all([getOverview(guildId), listTickets(guildId, status)])
    return { stats: overview.stats, tickets }
  }
}

export async function listTickets(guildId: string, status?: TicketStatus) {
  const qs = status ? `?status=${status}` : ''
  return (await call<{ tickets: TicketRow[] }>(`/guilds/${guildId}/tickets${qs}`)).tickets
}

export const saveSettings = (guildId: string, settings: Partial<GuildConfig>) =>
  call(`/guilds/${guildId}/settings`, { method: 'PUT', body: JSON.stringify(settings) })

export const publishPanel = (guildId: string) => call(`/guilds/${guildId}/panel/publish`, post())

export type CreatedChannel = { id: string; name: string; parentId: string | null; kind: 'text' | 'category' }

export async function createChannel(
  guildId: string,
  input: { name: string; kind: 'text' | 'category'; staffOnly?: boolean },
  staffName: string
) {
  const data = await call<{ channel: CreatedChannel }>(
    `/guilds/${guildId}/channels`,
    post({ ...input, staff: { name: staffName } })
  )
  return data.channel
}

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
