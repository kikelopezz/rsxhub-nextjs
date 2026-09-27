import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

/**
 * Token del bot de soporte, guardado cifrado en la base de datos (tabla `settings`) para poder
 * configurarlo desde /soporte/settings sin tocar el servidor. No hay una máquina propia donde
 * poner variables de entorno, así que esta es la alternativa: se cifra con una clave derivada de
 * SESSION_SECRET (que ya es obligatoria y nunca sale del servidor), no se guarda en texto plano
 * y nunca se vuelve a mostrar completo una vez guardado.
 *
 * DISCORD_BOT_TOKEN como variable de entorno, si existe, tiene prioridad — para quien sí pueda
 * configurar el servidor directamente.
 */

const SETTING_KEY = 'discord_bot_token'

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET no configurado')
  // sha256 de "secreto + contexto" como clave AES-256: nunca se reutiliza la misma clave derivada
  // para dos usos distintos (la cookie de sesión usa el secreto en crudo, no esto).
  return createHash('sha256').update(`${secret}:discord-bot-token`).digest()
}

function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, encrypted].map((b) => b.toString('base64')).join('.')
}

function decrypt(packed: string): string {
  const [ivB64, tagB64, dataB64] = packed.split('.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}

/** Últimos 4 caracteres del token, solo para mostrar "…acabado en XXXX" sin enseñar el token entero. */
export function tokenHint(token: string): string {
  return token.slice(-4)
}

/** El ID de la aplicación/bot va codificado en base64 al principio del propio token (antes del primer punto). */
export function applicationIdFromToken(token: string): string | null {
  try {
    const id = Buffer.from(token.split('.')[0], 'base64').toString('utf8')
    return /^\d{5,25}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export async function getStoredToken(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEY } })
  const encrypted = row?.value && typeof row.value === 'object' ? (row.value as { encrypted?: string }).encrypted : null
  if (!encrypted) return null
  try {
    return decrypt(encrypted)
  } catch (err) {
    console.error('[support] no se pudo descifrar el token guardado (¿cambió SESSION_SECRET?):', err)
    return null
  }
}

export async function saveStoredToken(token: string): Promise<void> {
  const value = { encrypted: encrypt(token), hint: tokenHint(token) }
  await db.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } })
}

export async function clearStoredToken(): Promise<void> {
  await db.setting.deleteMany({ where: { key: SETTING_KEY } })
}

export async function getStoredTokenHint(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEY } })
  const value = row?.value && typeof row.value === 'object' ? (row.value as { hint?: string }) : null
  return value?.hint || null
}

/** El token que se usa de verdad: el de entorno manda si existe; si no, el guardado en la base de datos. */
export async function resolveBotToken(): Promise<{ token: string; source: 'env' | 'db' } | null> {
  if (process.env.DISCORD_BOT_TOKEN) return { token: process.env.DISCORD_BOT_TOKEN, source: 'env' }
  const stored = await getStoredToken()
  return stored ? { token: stored, source: 'db' } : null
}
