// Mirrors next.config.js's images.remotePatterns — keep the two in sync. Used to decide
// whether an image URL can go through Next's built-in optimizer (fetched once, then served
// from Vercel's edge cache for up to a year per minimumCacheTTL) or must be marked
// `unoptimized` (any host Next hasn't been told to trust, e.g. a Catbox/Litterbox skin
// upload fallback) — getting this list out of sync with next.config.js either breaks the
// image (host not actually allowed) or silently loses the caching benefit (host allowed but
// not recognized here).
const OPTIMIZABLE_HOST_SUFFIXES = [
  '.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'images.unsplash.com',
  '.supabase.co',
  'placehold.co',
  'api.dicebear.com',
  '.r2.dev',
]

export function isRemoteImageOptimizable(url?: string | null): boolean {
  if (!url) return false
  if (url.startsWith('/')) return true
  try {
    const { hostname } = new URL(url)
    return OPTIMIZABLE_HOST_SUFFIXES.some((suffix) =>
      suffix.startsWith('.') ? hostname.endsWith(suffix) : hostname === suffix
    )
  } catch {
    return false
  }
}
