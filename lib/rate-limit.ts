/**
 * Tiny in-memory sliding-window limiter. State is per server instance (on serverless that means
 * per warm lambda), so it's a brake against a single client hammering an endpoint — not a hard,
 * global quota.
 */
const hits = new Map<string, number[]>()
let lastSweep = 0

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  if (now - lastSweep > 60_000) {
    lastSweep = now
    for (const [k, times] of hits) {
      if (times.every((t) => now - t > windowMs)) hits.delete(k)
    }
  }

  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}
