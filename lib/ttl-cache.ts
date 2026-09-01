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
    globalCache.set(key, {
      data: freshData,
      expiresAt: now + ttlSeconds * 1000,
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
  if (!keys) {
    globalCache.clear()
    return
  }
  const keyList = Array.isArray(keys) ? keys : [keys]
  for (const targetKey of keyList) {
    for (const cacheKey of globalCache.keys()) {
      if (cacheKey.startsWith(targetKey)) {
        globalCache.delete(cacheKey)
      }
    }
  }
}
