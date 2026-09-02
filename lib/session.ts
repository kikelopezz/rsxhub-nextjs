import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { SessionUser } from '@/types'
const COOKIE_NAME = 'simleague_session'
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set — no insecure default is provided.')
}
const encodedSecret = new TextEncoder().encode(process.env.SESSION_SECRET)

function getSecret() {
  return encodedSecret
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  try {
    const verified = await jwtVerify(token, getSecret())
    return verified.payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
