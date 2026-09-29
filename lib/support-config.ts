import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import type { SupportGuildConfig } from '@prisma/client'

/**
 * Ajustes del servidor de soporte: saneado del formulario, valores por defecto y acceso a la
 * fila de configuración (una por guild). No toca Discord para nada (por eso vive en el Hub y no
 * en el proceso del bot — ver rsx-ticket-bot/src/discord/config.ts, que tiene una copia literal
 * de este mismo archivo porque el bot también la necesita internamente).
 */

const BUTTON_COLORS = ['blue', 'gray', 'green', 'red'] as const
export type ButtonColor = (typeof BUTTON_COLORS)[number]

export type TicketType = {
  id: string
  emoji: string
  label: string
  description: string
  welcome: string
  imageUrl: string | null
  color: ButtonColor
  pingRoleId: string | null
}

export type Campeonato = {
  id: string
  emoji: string
  label: string
  categoryId: string | null
  color: ButtonColor
}

export type GuildConfigDTO = Omit<SupportGuildConfig, 'ticketTypes' | 'campeonatos'> & {
  ticketTypes: TicketType[]
  campeonatos: Campeonato[]
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const isSnowflake = (v: unknown): v is string => typeof v === 'string' && /^\d{5,25}$/.test(v)
const snowflakeOrNull = (v: unknown): string | null => (isSnowflake(v) ? v : null)
const httpUrlOrNull = (v: unknown): string | null => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim()) ? v.trim().slice(0, 500) : null)

function sanitizeTicketTypes(types: unknown): TicketType[] {
  if (!Array.isArray(types)) return []
  const seen = new Set<string>()
  return types
    .map((t): TicketType => {
      const raw = t as Record<string, unknown>
      return {
        id: text(raw?.id, 40) || `t-${randomBytes(4).toString('hex')}`,
        emoji: text(raw?.emoji, 8),
        label: text(raw?.label, 60),
        description: text(raw?.description, 100),
        welcome: text(raw?.welcome, 3500),
        imageUrl: httpUrlOrNull(raw?.imageUrl),
        color: (BUTTON_COLORS as readonly string[]).includes(raw?.color as string) ? (raw!.color as ButtonColor) : 'blue',
        pingRoleId: snowflakeOrNull(raw?.pingRoleId),
      }
    })
    .filter((t) => t.label && !seen.has(t.id) && seen.add(t.id))
    .slice(0, 25)
}

function sanitizeCampeonatos(list: unknown): Campeonato[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  return list
    .map((c): Campeonato => {
      const raw = c as Record<string, unknown>
      return {
        id: text(raw?.id, 40) || `c-${randomBytes(4).toString('hex')}`,
        emoji: text(raw?.emoji, 8),
        label: text(raw?.label, 60),
        categoryId: snowflakeOrNull(raw?.categoryId),
        color: (BUTTON_COLORS as readonly string[]).includes(raw?.color as string) ? (raw!.color as ButtonColor) : 'blue',
      }
    })
    .filter((c) => c.label && !seen.has(c.id) && seen.add(c.id))
    .slice(0, 25)
}

export type SettingsInput = Partial<{
  panelTitle: string
  panelDescription: string
  panelChannelId: string | null
  categoryId: string | null
  transcriptChannelId: string | null
  logChannelId: string | null
  staffRoleIds: string[]
  ticketTypes: unknown
  campeonatos: unknown
  welcomeMessage: string
  embedColor: string
  maxOpenTickets: number
  panelStyle: 'menu' | 'buttons'
  pingRoleId: string | null
  reminderMinutes: number
}>

/**
 * Todo lo que venga de un formulario puede faltar o venir del tipo equivocado: el texto se
 * recorta, los ids tienen que parecer un id de Discord y las listas se limitan. Devuelve SIEMPRE
 * el objeto completo (no un parche), porque así se guarda con `update`.
 */
export function sanitizeSettings(body: SettingsInput): Omit<
  SupportGuildConfig,
  'id' | 'guildId' | 'guildName' | 'panelMessageId' | 'createdAt' | 'updatedAt' | 'ticketTypes' | 'campeonatos'
> & { ticketTypes: TicketType[]; campeonatos: Campeonato[] } {
  return {
    panelTitle: text(body.panelTitle, 100) || 'Soporte',
    panelDescription: text(body.panelDescription, 500),
    panelChannelId: snowflakeOrNull(body.panelChannelId),
    categoryId: snowflakeOrNull(body.categoryId),
    transcriptChannelId: snowflakeOrNull(body.transcriptChannelId),
    logChannelId: snowflakeOrNull(body.logChannelId),
    staffRoleIds: Array.isArray(body.staffRoleIds) ? Array.from(new Set(body.staffRoleIds.filter(isSnowflake))).slice(0, 25) : [],
    ticketTypes: sanitizeTicketTypes(body.ticketTypes),
    campeonatos: sanitizeCampeonatos(body.campeonatos),
    welcomeMessage: text(body.welcomeMessage, 500) || 'Gracias por abrir un ticket, {user}. El equipo de staff te atenderá en breve.',
    embedColor: /^#[0-9a-fA-F]{6}$/.test(body.embedColor || '') ? (body.embedColor as string) : '#1274de',
    maxOpenTickets: Math.max(1, Math.min(10, Number(body.maxOpenTickets) || 1)),
    panelStyle: body.panelStyle === 'buttons' ? 'buttons' : 'menu',
    pingRoleId: snowflakeOrNull(body.pingRoleId),
    reminderMinutes: Math.max(0, Math.min(1440, Math.round(Number(body.reminderMinutes) || 0))),
  }
}

function toDTO(row: SupportGuildConfig): GuildConfigDTO {
  return {
    ...row,
    ticketTypes: sanitizeTicketTypes(row.ticketTypes),
    campeonatos: sanitizeCampeonatos(row.campeonatos),
  }
}

export async function ensureGuildConfig(guildId: string, guildName?: string | null): Promise<GuildConfigDTO> {
  const existing = await db.supportGuildConfig.findUnique({ where: { guildId } })
  if (existing) {
    if (guildName && guildName !== existing.guildName) {
      return toDTO(await db.supportGuildConfig.update({ where: { guildId }, data: { guildName } }))
    }
    return toDTO(existing)
  }
  return toDTO(await db.supportGuildConfig.create({ data: { guildId, guildName } }))
}

export async function getGuildConfig(guildId: string): Promise<GuildConfigDTO | null> {
  const row = await db.supportGuildConfig.findUnique({ where: { guildId } })
  return row ? toDTO(row) : null
}

export async function updateGuildConfig(guildId: string, input: SettingsInput): Promise<GuildConfigDTO> {
  await ensureGuildConfig(guildId)
  const data = sanitizeSettings(input)
  return toDTO(await db.supportGuildConfig.update({ where: { guildId }, data }))
}
