import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { resolveBotToken } from './token-store'

/**
 * Cliente de Discord del bot de soporte, en el mismo proceso que el Hub (nada de un bot ni una
 * base de datos aparte). Solo hace falta el intent GUILDS: no se leen mensajes del servidor en
 * general, solo se gestionan canales, permisos y las interacciones del panel de tickets.
 *
 * El token puede venir de DISCORD_BOT_TOKEN (variable de entorno, si alguien puede configurar el
 * servidor) o, si no, del que se haya guardado desde /soporte/settings (ver token-store.ts) — así
 * se puede conectar el bot sin acceso al servidor donde corre el Hub.
 *
 * Guardado en globalThis para que el hot-reload de `next dev` no cree un cliente nuevo (y por
 * tanto un segundo login) en cada recarga — mismo patrón que lib/db.ts con Prisma.
 */

declare global {
  // eslint-disable-next-line no-var
  var __rsxDiscordClient: Client | undefined
  // eslint-disable-next-line no-var
  var __rsxDiscordLoginPromise: Promise<void> | undefined
  // eslint-disable-next-line no-var
  var __rsxDiscordLoggedInToken: string | undefined
  // eslint-disable-next-line no-var
  var __rsxDiscordLastError: string | undefined
}

/** El motivo del último intento de conexión fallido, para enseñarlo en Ajustes sin depender de mirar logs del servidor. */
export function getLastConnectError(): string | null {
  return globalThis.__rsxDiscordLastError ?? null
}

function buildClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
  })
}

export const discordClient: Client = globalThis.__rsxDiscordClient ?? buildClient()
if (process.env.NODE_ENV !== 'production') globalThis.__rsxDiscordClient = discordClient

/** true si hay un token disponible (de entorno o guardado), sin comprobar si la conexión funciona. */
export async function isDiscordConfigured(): Promise<boolean> {
  return Boolean(await resolveBotToken())
}

export function isDiscordReady(): boolean {
  return discordClient.isReady()
}

/**
 * El login() de discord.js resuelve en cuanto el token queda validado (con `client.user` ya
 * puesto), pero `isReady()` se pone a true un instante después — comprobado: hasta ~200ms de
 * diferencia. Sin esto, cualquiera que comprobara el estado justo después de conectar (como la
 * tarjeta de Ajustes) podía ver "desconectado" con un login perfectamente válido.
 */
function waitUntilReady(timeoutMs = 10_000): Promise<void> {
  if (discordClient.isReady()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      discordClient.off('ready', onReady)
      reject(new Error('El bot validó el token pero no llegó a quedar listo a tiempo.'))
    }, timeoutMs)
    const onReady = () => {
      clearTimeout(timer)
      resolve()
    }
    discordClient.once('ready', onReady)
  })
}

/**
 * Login perezoso e idempotente: aunque se llame varias veces a la vez, solo hay un intento de
 * conexión en curso. Si el token guardado ha cambiado desde la última vez (alguien lo actualizó
 * en Ajustes), se reconecta con el nuevo en vez de quedarse con la sesión vieja.
 */
export async function ensureDiscordLogin(): Promise<void> {
  const resolved = await resolveBotToken()
  if (!resolved) throw new Error('El bot de soporte no tiene un token configurado.')

  if (discordClient.isReady() && globalThis.__rsxDiscordLoggedInToken === resolved.token) return

  if (discordClient.isReady() && globalThis.__rsxDiscordLoggedInToken !== resolved.token) {
    // El token cambió desde la última conexión: hay que reconectar con el nuevo.
    discordClient.destroy()
    globalThis.__rsxDiscordLoginPromise = undefined
  }

  if (!globalThis.__rsxDiscordLoginPromise) {
    globalThis.__rsxDiscordLoginPromise = discordClient
      .login(resolved.token)
      .then(() => waitUntilReady())
      .then(() => {
        globalThis.__rsxDiscordLoggedInToken = resolved.token
        globalThis.__rsxDiscordLastError = undefined
      })
      .catch((err) => {
        globalThis.__rsxDiscordLoginPromise = undefined
        globalThis.__rsxDiscordLastError = err instanceof Error ? err.message : String(err)
        throw err
      })
  }
  return globalThis.__rsxDiscordLoginPromise
}

/** Corta la conexión (p. ej. al quitar el token desde Ajustes). Un login posterior crea una nueva. */
export function disconnectDiscordBot(): void {
  globalThis.__rsxDiscordLoginPromise = undefined
  globalThis.__rsxDiscordLoggedInToken = undefined
  globalThis.__rsxDiscordLastError = undefined
  if (discordClient.isReady()) discordClient.destroy()
}
