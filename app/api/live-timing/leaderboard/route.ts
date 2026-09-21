import { NextResponse } from 'next/server'

// ERC and ERC Next Gen run on two entirely separate physical servers/domains, each with
// its own server=0/1/2 — they're not one shared pool split by index range.
const SOURCE_URLS: Record<string, string> = {
  erc: process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || '',
  'erc-next-gen': process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL_ERC_NEXT_GEN || '',
}

// This endpoint is public and polled by every open live-timing tab. Without a cache each request
// became one request to the game server, so N viewers = N upstream calls per poll. Share one
// upstream fetch per (source, server) for a couple of seconds, and coalesce concurrent requests.
const CACHE_MS = 2_000
type Entry = { at: number; data?: unknown; pending?: Promise<unknown> }
const cache = new Map<string, Entry>()

async function fetchUpstream(sourceUrl: string, server: string) {
  const url = new URL(sourceUrl)
  url.searchParams.set('server', server)
  url.searchParams.set('_t', String(Date.now()))
  const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw Object.assign(new Error(`Upstream error ${res.status}`), { upstreamStatus: res.status })
  return res.json()
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const server = searchParams.get('server') || '0'
  const source = searchParams.get('source') || 'erc'

  // server is only ever a small index; never forward arbitrary text to the upstream.
  if (!/^\d$/.test(server)) {
    return NextResponse.json({ error: 'Invalid server' }, { status: 400 })
  }

  const sourceUrl = SOURCE_URLS[source]
  if (!sourceUrl) {
    return NextResponse.json({ error: 'Live timing source not configured' }, { status: 500 })
  }

  const key = `${source}:${server}`
  const now = Date.now()
  const hit = cache.get(key)

  try {
    let data: unknown
    if (hit && hit.data !== undefined && now - hit.at < CACHE_MS) {
      data = hit.data
    } else if (hit?.pending) {
      data = await hit.pending
    } else {
      const pending = fetchUpstream(sourceUrl, server)
      cache.set(key, { at: now, pending })
      try {
        data = await pending
        cache.set(key, { at: Date.now(), data })
      } catch (err) {
        // Never keep serving old positions when the game server is down: drop the entry.
        cache.delete(key)
        throw err
      }
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const upstreamStatus = (err as { upstreamStatus?: number }).upstreamStatus
    if (upstreamStatus) {
      return NextResponse.json({ error: `Upstream error ${upstreamStatus}` }, { status: 502 })
    }
    console.error('Failed to fetch live timing leaderboard:', err)
    return NextResponse.json({ error: 'Failed to reach live timing source' }, { status: 502 })
  }
}
