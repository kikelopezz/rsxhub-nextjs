import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'

/**
 * Equipo y dorsal de cada piloto según el apartado de Equipos del Hub, indexados por Steam ID.
 * El servidor de carrera a menudo manda el número a 0 y el equipo vacío, así que el live timing
 * completa esos datos con lo que hay registrado aquí. Solo expone lo que ya es público en las
 * fichas de equipo (nombre, logo y número de coche), nunca datos personales.
 */
export type HubEntry = {
  teamName: string
  teamLogoUrl: string | null
  dorsal: string | null
  category: string | null
}

type TeamLite = { name: string; logoUrl: string | null; status: string }

async function loadEntries(): Promise<Record<string, HubEntry[]>> {
  const teamSelect = { name: true, logoUrl: true, status: true } as const
  const [carDrivers, members] = await Promise.all([
    db.teamCarDriver.findMany({
      where: { isReserve: false },
      select: { userId: true, car: { select: { dorsal: true, category: true, team: { select: teamSelect } } } },
    }),
    db.teamMember.findMany({ select: { userId: true, steamId: true, team: { select: teamSelect } } }),
  ])

  const userIds = Array.from(new Set([...carDrivers.map((c) => c.userId), ...members.map((m) => m.userId)]))
  const accounts = userIds.length > 0 ? await db.steamAccount.findMany({ where: { userId: { in: userIds } }, select: { userId: true, steamId: true } }) : []
  const steamByUser = new Map(accounts.map((a) => [a.userId, a.steamId]))

  const out: Record<string, HubEntry[]> = {}
  const push = (steamId: string, team: TeamLite, dorsal: string | null, category: string | null) => {
    if (team.status === 'rejected') return
    const list = (out[steamId] ||= [])
    if (list.some((e) => e.teamName === team.name && e.dorsal === dorsal && e.category === category)) return
    list.push({ teamName: team.name, teamLogoUrl: team.logoUrl, dorsal, category })
  }

  // Coches con piloto asignado: aportan equipo, dorsal y categoría
  for (const row of carDrivers) {
    const steamId = steamByUser.get(row.userId)
    if (!steamId) continue
    push(steamId, row.car.team, row.car.dorsal?.trim() || null, row.car.category?.trim().toUpperCase() || null)
  }

  // Miembros de un equipo sin coche asignado: al menos aportan el equipo
  for (const member of members) {
    const steamId = member.steamId || steamByUser.get(member.userId)
    if (!steamId) continue
    if ((out[steamId] || []).some((e) => e.teamName === member.team.name)) continue
    push(steamId, member.team, null, null)
  }

  return out
}

export async function GET() {
  try {
    const entries = await fetchWithTTLCache('live_timing_hub_entries', loadEntries, 60)
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'public, max-age=30' } })
  } catch (error) {
    console.error('[live-timing/entries] falló:', error)
    return NextResponse.json({ entries: {} }, { status: 200 })
  }
}
