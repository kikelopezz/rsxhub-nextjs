import { NextResponse } from 'next/server'
import { getHubEntries, getHubNames } from '@/lib/hub-entries'

export type { HubEntry } from '@/lib/hub-entries'

/** Equipo y dorsal de cada piloto según el apartado de Equipos, y su nombre en el Hub, por Steam ID (ver lib/hub-entries). */
export async function GET() {
  try {
    const [entries, names] = await Promise.all([getHubEntries(), getHubNames()])
    return NextResponse.json({ entries, names }, { headers: { 'Cache-Control': 'public, max-age=30' } })
  } catch (error) {
    console.error('[live-timing/entries] falló:', error)
    return NextResponse.json({ entries: {}, names: {} }, { status: 200 })
  }
}
