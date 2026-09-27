import { NextResponse } from 'next/server'
import { getHubEntries } from '@/lib/hub-entries'

export type { HubEntry } from '@/lib/hub-entries'

/** Equipo y dorsal de cada piloto según el apartado de Equipos, por Steam ID (ver lib/hub-entries). */
export async function GET() {
  try {
    const entries = await getHubEntries()
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'public, max-age=30' } })
  } catch (error) {
    console.error('[live-timing/entries] falló:', error)
    return NextResponse.json({ entries: {} }, { status: 200 })
  }
}
