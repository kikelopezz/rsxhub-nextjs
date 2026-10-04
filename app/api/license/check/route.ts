import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isTrustedRequestOrigin } from '@/lib/csrf'
import { runLicenseCheck } from '@/lib/licenses'

export async function POST(req: Request) {
  if (!isTrustedRequestOrigin(req)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const session = await getCurrentUser()
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  if (!rateLimit(`license-check:${session.userId}`, 10, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: 'rate-limited' }, { status: 429 })
  }

  const summary = await runLicenseCheck(session.userId, session.steamId)
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
}
