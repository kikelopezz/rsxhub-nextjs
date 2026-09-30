import { getTrustedOrigins } from './steam'

function originOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

/**
 * True if this state-changing request's Origin (or, failing that, Referer) is one of this
 * deployment's own trusted origins (the same allow-list the Steam login flow uses).
 *
 * `SameSite=Lax` on the session cookie (lib/session.ts) already blocks the cookie on most
 * cross-site POSTs, and Next.js Server Actions get their own built-in Origin check — this covers
 * the gap: plain `app/api/**` route handlers, which get neither, as defense-in-depth.
 */
export function isTrustedRequestOrigin(request: Request): boolean {
  const origin = originOf(request.headers.get('origin')) || originOf(request.headers.get('referer'))
  if (!origin) return false
  return getTrustedOrigins().has(origin)
}
