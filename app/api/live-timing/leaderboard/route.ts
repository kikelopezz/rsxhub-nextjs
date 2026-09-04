import { NextResponse } from 'next/server'

const SOURCE_URL = process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || ''

export async function GET(req: Request) {
  if (!SOURCE_URL) {
    return NextResponse.json({ error: 'Live timing source not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const server = searchParams.get('server') || '0'

  try {
    const url = new URL(SOURCE_URL)
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
