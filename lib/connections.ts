/**
 * Conexiones (redes sociales) del perfil de un piloto.
 *
 * Se guardan como JSON { plataforma: valor }. Para todas menos Discord el valor es una URL https
 * canónica construida por nosotros a partir de lo que escribe el piloto (un @usuario o un enlace),
 * y solo se aceptan enlaces de los dominios de esa plataforma: así nadie puede colar enlaces
 * arbitrarios (phishing, javascript:, etc.) en un perfil. Discord no tiene URL pública por nombre
 * de usuario, así que se guarda el nombre tal cual para copiarlo.
 */

export type ConnectionKey = 'discord' | 'twitch' | 'youtube' | 'instagram' | 'x' | 'tiktok' | 'kick' | 'facebook' | 'website'

export type ConnectionPlatform = {
  key: ConnectionKey
  label: string
  placeholder: string
  /** Color de marca para el punto del chip. */
  color: string
  /** Cómo se construye la URL a partir de un usuario. null = sin URL (Discord) o enlace libre (website). */
  buildUrl: ((handle: string) => string) | null
  /** Dominios aceptados cuando el piloto pega un enlace completo. */
  hosts: string[]
}

export const CONNECTION_PLATFORMS: ConnectionPlatform[] = [
  { key: 'discord', label: 'Discord', placeholder: 'tu_usuario', color: '#5865F2', buildUrl: null, hosts: [] },
  { key: 'twitch', label: 'Twitch', placeholder: 'tu_canal o enlace', color: '#9146FF', buildUrl: (h) => `https://www.twitch.tv/${h}`, hosts: ['twitch.tv'] },
  { key: 'youtube', label: 'YouTube', placeholder: '@tu_canal o enlace', color: '#FF0033', buildUrl: (h) => `https://www.youtube.com/@${h}`, hosts: ['youtube.com', 'youtu.be'] },
  { key: 'instagram', label: 'Instagram', placeholder: '@tu_usuario o enlace', color: '#E4405F', buildUrl: (h) => `https://www.instagram.com/${h}`, hosts: ['instagram.com'] },
  { key: 'x', label: 'X (Twitter)', placeholder: '@tu_usuario o enlace', color: '#E7E9EA', buildUrl: (h) => `https://x.com/${h}`, hosts: ['x.com', 'twitter.com'] },
  { key: 'tiktok', label: 'TikTok', placeholder: '@tu_usuario o enlace', color: '#25F4EE', buildUrl: (h) => `https://www.tiktok.com/@${h}`, hosts: ['tiktok.com'] },
  { key: 'kick', label: 'Kick', placeholder: 'tu_canal o enlace', color: '#53FC18', buildUrl: (h) => `https://kick.com/${h}`, hosts: ['kick.com'] },
  { key: 'facebook', label: 'Facebook', placeholder: 'tu_usuario o enlace', color: '#1877F2', buildUrl: (h) => `https://www.facebook.com/${h}`, hosts: ['facebook.com', 'fb.com'] },
  { key: 'website', label: 'Web / otro', placeholder: 'https://tu-web.com', color: '#94A3B8', buildUrl: null, hosts: [] },
]

export type Connections = Partial<Record<ConnectionKey, string>>

const MAX_LENGTH = 200
const HANDLE = /^[A-Za-z0-9._-]{1,60}$/
const DISCORD_NAME = /^[A-Za-z0-9._#-]{2,40}$/

function hostMatches(hostname: string, allowed: string[]) {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  return allowed.some((h) => host === h || host.endsWith(`.${h}`))
}

function parseHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.protocol = 'https:'
    url.username = ''
    url.password = ''
    return url
  } catch {
    return null
  }
}

/**
 * Limpia lo que escribe el piloto para una plataforma.
 * Devuelve '' si está vacío, el valor a guardar si es válido, o null si no es válido.
 */
export function normalizeConnection(key: ConnectionKey, input: string): string | null {
  const platform = CONNECTION_PLATFORMS.find((p) => p.key === key)
  if (!platform) return null

  const raw = input.trim()
  if (!raw) return ''
  if (raw.length > MAX_LENGTH) return null

  if (key === 'discord') {
    const name = raw.replace(/^@/, '')
    return DISCORD_NAME.test(name) ? name : null
  }

  if (key === 'website') {
    const url = parseHttpsUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url && url.hostname.includes('.') ? url.toString() : null
  }

  // Un enlace lleva protocolo o al menos una barra ("twitch.tv/canal"); un usuario puede llevar puntos ("rsx.racing").
  if (/^https?:\/\//i.test(raw) || raw.includes('/')) {
    const url = parseHttpsUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (!url || !hostMatches(url.hostname, platform.hosts)) return null
    return url.toString()
  }

  const handle = raw.replace(/^@/, '')
  return HANDLE.test(handle) && platform.buildUrl ? platform.buildUrl(handle) : null
}

/** Lee el JSON guardado en la BD de forma defensiva: solo claves conocidas y valores que siguen siendo válidos. */
export function parseConnections(value: unknown): Connections {
  const out: Connections = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const platform of CONNECTION_PLATFORMS) {
    const stored = (value as Record<string, unknown>)[platform.key]
    if (typeof stored !== 'string') continue
    const clean = normalizeConnection(platform.key, stored)
    if (clean) out[platform.key] = clean
  }
  return out
}

/** Texto corto para mostrar en el chip (el @usuario o el dominio). */
export function connectionDisplay(key: ConnectionKey, value: string): string {
  if (key === 'discord') return value
  try {
    const url = new URL(value)
    const path = url.pathname.replace(/^\/+|\/+$/g, '')
    if (key === 'website') return url.hostname.replace(/^www\./, '')
    const last = path.split('/').filter(Boolean).pop() || url.hostname
    return last.startsWith('@') ? last : `@${last}`
  } catch {
    return value
  }
}
