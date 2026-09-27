import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'

/**
 * Equipo y dorsal de cada piloto según el apartado de Equipos del Hub, indexados por Steam ID.
 * Es la fuente de verdad para vincular un piloto con su equipo y el número de su coche: los servidores de carrera y los
 * JSON de resultados a menudo traen el número a 0, inventado (1, 2, 3…) o el equipo vacío. Solo expone lo que ya es
 * público en las fichas de equipo (nombre, logo y número de coche), nunca datos personales.
 */
export type HubEntry = {
  teamName: string
  teamLogoUrl: string | null
  dorsal: string | null
  category: string | null
  /** Modelo del coche del equipo (solo si la entrada viene de un coche con piloto asignado) */
  carModel: string | null
}

type TeamLite = { name: string; logoUrl: string | null; status: string }

async function loadEntries(): Promise<Record<string, HubEntry[]>> {
  const teamSelect = { name: true, logoUrl: true, status: true } as const
  const [carDrivers, members] = await Promise.all([
    db.teamCarDriver.findMany({
      where: { isReserve: false },
      select: { userId: true, car: { select: { dorsal: true, category: true, modelName: true, team: { select: teamSelect } } } },
    }),
    db.teamMember.findMany({ select: { userId: true, steamId: true, team: { select: teamSelect } } }),
  ])

  const userIds = Array.from(new Set([...carDrivers.map((c) => c.userId), ...members.map((m) => m.userId)]))
  const accounts = userIds.length > 0 ? await db.steamAccount.findMany({ where: { userId: { in: userIds } }, select: { userId: true, steamId: true } }) : []
  const steamByUser = new Map(accounts.map((a) => [a.userId, a.steamId]))

  const out: Record<string, HubEntry[]> = {}
  const push = (steamId: string, team: TeamLite, dorsal: string | null, category: string | null, carModel: string | null = null) => {
    if (team.status === 'rejected') return
    const list = (out[steamId] ||= [])
    if (list.some((e) => e.teamName === team.name && e.dorsal === dorsal && e.category === category)) return
    list.push({ teamName: team.name, teamLogoUrl: team.logoUrl, dorsal, category, carModel })
  }

  // Coches con piloto asignado: aportan equipo, dorsal y categoría
  for (const row of carDrivers) {
    const steamId = steamByUser.get(row.userId)
    if (!steamId) continue
    push(steamId, row.car.team, row.car.dorsal?.trim() || null, row.car.category?.trim().toUpperCase() || null, row.car.modelName?.trim() || null)
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

/** Entradas por Steam ID, con caché de un minuto. */
export function getHubEntries() {
  return fetchWithTTLCache('live_timing_hub_entries', loadEntries, 60)
}

/**
 * Elige la entrada de un piloto que corresponde a una categoría: la de su coche en esa categoría si la hay; si no,
 * la primera con dorsal; y como último recurso la primera (solo equipo).
 */
export function pickHubEntry(entries: HubEntry[] | undefined, classTag?: string | null): HubEntry | undefined {
  if (!entries || entries.length === 0) return undefined
  const cls = (classTag || '').trim().toUpperCase()
  const sameClass = cls ? entries.find((e) => e.category && (e.category === cls || cls.includes(e.category) || e.category.includes(cls))) : undefined
  return sameClass || entries.find((e) => e.dorsal) || entries[0]
}
