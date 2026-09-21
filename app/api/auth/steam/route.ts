import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { STEAM_STATE_COOKIE, buildSteamAuthUrl } from '@/lib/steam'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Every login attempt costs a redirect + a cookie; a bot hammering this shouldn't be free.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`steam-login:${ip}`, 30, 60_000)) {
    return new NextResponse('Too many login attempts. Try again in a minute.', { status: 429 })
  }

  const origin = request.nextUrl.searchParams.get('origin')

  // Random per-login value bound to this browser: it rides inside the signed `return_to` and the
  // callback only accepts an assertion whose `state` matches this cookie, so an assertion someone
  // else obtained can't be replayed into a victim's browser (login CSRF).
  const state = randomBytes(24).toString('base64url')

  let url: string
  try {
    url = buildSteamAuthUrl(request, origin, state)
  } catch (err) {
    console.error('Failed to build Steam auth URL:', err)
    return NextResponse.redirect(new URL('/?login=error', request.url))
  }

  const response = NextResponse.redirect(url)
  response.cookies.set(STEAM_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax', // must survive the top-level redirect back from steamcommunity.com
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: 10 * 60,
  })
  return response
}
