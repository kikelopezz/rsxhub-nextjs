import { discordClient, getLastConnectError } from './client'
import { ensureBotStarted } from './index'
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
  /** Motivo del último intento de conexión fallido (null si nunca falló, o si ya está conectado). */
  lastError: string | null
}

export async function getBotStatus(): Promise<BotStatus> {
  // Se intenta conectar aquí mismo, no solo desde el layout: layout.tsx y la página se resuelven
  // en paralelo en el App Router, así que fiarse de que el layout ya haya terminado de conectar
  // antes de leer el estado en la página era una carrera — la primera visita casi siempre perdía
  // (el login tarda menos de un segundo, pero algo es algo) y se veía "Desconectado" un momento
  // aunque el token fuera perfectamente válido.
  await ensureBotStarted()
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
    lastError: ready ? null : getLastConnectError(),
  }
}
