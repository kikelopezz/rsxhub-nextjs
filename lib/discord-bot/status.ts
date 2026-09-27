import { discordClient } from './client'
import { applicationIdFromToken, resolveBotToken, tokenHint } from './token-store'

export type BotStatus = {
  configured: boolean
  /** De dónde sale el token en uso: variable de entorno del servidor, o guardado desde la web. */
  source: 'env' | 'db' | null
  ready: boolean
  tag: string | null
  guildCount: number
  applicationId: string | null
  tokenHint: string | null
}

export async function getBotStatus(): Promise<BotStatus> {
  const resolved = await resolveBotToken()
  const ready = discordClient.isReady()
  return {
    configured: Boolean(resolved),
    source: resolved?.source ?? null,
    ready,
    tag: ready ? discordClient.user?.tag ?? null : null,
    guildCount: ready ? discordClient.guilds.cache.size : 0,
    applicationId: resolved ? applicationIdFromToken(resolved.token) : null,
    tokenHint: resolved ? tokenHint(resolved.token) : null,
  }
}
