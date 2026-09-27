import { Client, GatewayIntentBits, Partials } from 'discord.js'

/**
 * Cliente de Discord del bot de soporte, en el mismo proceso que el Hub (nada de un bot ni una
 * base de datos aparte). Solo hace falta el intent GUILDS: no se leen mensajes del servidor en
 * general, solo se gestionan canales, permisos y las interacciones del panel de tickets.
 *
 * Guardado en globalThis para que el hot-reload de `next dev` no cree un cliente nuevo (y por
 * tanto un segundo login) en cada recarga — mismo patrón que lib/db.ts con Prisma.
 */

declare global {
  // eslint-disable-next-line no-var
  var __rsxDiscordClient: Client | undefined
  // eslint-disable-next-line no-var
  var __rsxDiscordLoginPromise: Promise<void> | undefined
}

export const discordBotToken = process.env.DISCORD_BOT_TOKEN || ''
export const hasDiscordBot = Boolean(discordBotToken)

export const discordClient: Client =
  globalThis.__rsxDiscordClient ??
  new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
  })

if (process.env.NODE_ENV !== 'production') globalThis.__rsxDiscordClient = discordClient

/** Login perezoso e idempotente: aunque se llame varias veces, solo hay un intento de conexión en curso. */
export function ensureDiscordLogin(): Promise<void> {
  if (!hasDiscordBot) return Promise.reject(new Error('DISCORD_BOT_TOKEN no configurado'))
  if (discordClient.isReady()) return Promise.resolve()
  if (!globalThis.__rsxDiscordLoginPromise) {
    globalThis.__rsxDiscordLoginPromise = discordClient
      .login(discordBotToken)
      .then(() => undefined)
      .catch((err) => {
        globalThis.__rsxDiscordLoginPromise = undefined
        throw err
      })
  }
  return globalThis.__rsxDiscordLoginPromise
}

export function isDiscordReady(): boolean {
  return discordClient.isReady()
}
