import { NextResponse } from 'next/server'

// ERC and ERC Next Gen run on two entirely separate physical servers/domains, each with
// its own server=0/1/2 — they're not one shared pool split by index range.
const SOURCE_URLS: Record<string, string> = {
  erc: process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || '',
  'erc-next-gen': process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL_ERC_NEXT_GEN || '',
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const server = searchParams.get('server') || '0'
  const source = searchParams.get('source') || 'erc'

  const sourceUrl = SOURCE_URLS[source]
  if (!sourceUrl) {
    return NextResponse.json({ error: 'Live timing source not configured' }, { status: 500 })
  }

  try {
    const url = new URL(sourceUrl)
    url.searchParams.set('server', server)
    url.searchParams.set('_t', String(Date.now()))
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream error ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Failed to fetch live timing leaderboard:', err)
    return NextResponse.json({ error: 'Failed to reach live timing source' }, { status: 502 })
  }
}
