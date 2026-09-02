/**
 * Server-Side In-Memory TTL (Time-To-Live) Cache Store
 * Eliminates redundant Firestore reads across server renders and concurrent requests.
 * Default TTL: 60 seconds (configurable per dataset).
 */

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

// Global server singleton cache map across requests in the Node process
const globalCache = new Map<string, CacheEntry<any>>()

// Right after a key is invalidated, the very next fetch can race the data
// source's own eventual consistency (most visibly the Firestore emulator,
// whose collection queries can lag a moment behind a write that already
// resolved) and come back stale or empty. Caching that result for the full
// TTL would make the page look "stuck" until it expires. So for a short
// window after invalidation, whatever a fetch returns is cached only
// briefly, giving the next request a chance to see the settled data.
const recentlyInvalidated = new Map<string, number>()
const INVALIDATION_GRACE_WINDOW_MS = 5_000
const GRACE_TTL_SECONDS = 2

export async function fetchWithTTLCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const now = Date.now()
  const existing = globalCache.get(key)

  if (existing && existing.expiresAt > now) {
    return existing.data
  }

  try {
    const freshData = await fetcher()
    const invalidatedAt = recentlyInvalidated.get(key)
    const inGraceWindow = invalidatedAt !== undefined && now - invalidatedAt < INVALIDATION_GRACE_WINDOW_MS
    globalCache.set(key, {
      data: freshData,
      expiresAt: now + (inGraceWindow ? GRACE_TTL_SECONDS : ttlSeconds) * 1000,
    })
    return freshData
  } catch (err) {
    if (existing) {
      console.warn(`[TTL Cache] Fetch failed for key "${key}". Returning stale cached data.`)
      return existing.data
    }
    throw err
  }
}

export function invalidateCache(keys?: string | string[]) {
  const now = Date.now()
  if (!keys) {
    globalCache.clear()
    recentlyInvalidated.clear()
    return
  }
  const keyList = Array.isArray(keys) ? keys : [keys]
  for (const targetKey of keyList) {
    recentlyInvalidated.set(targetKey, now)
    for (const cacheKey of globalCache.keys()) {
      if (cacheKey.startsWith(targetKey)) {
        globalCache.delete(cacheKey)
        recentlyInvalidated.set(cacheKey, now)
      }
    }
  }
}
