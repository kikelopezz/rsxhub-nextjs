import { db } from '@/lib/db'

/**
 * Inscripciones de una liga con el equipo y el dorsal reales de cada piloto.
 * Sirve para vincular las filas de un JSON de resultados (que a veces trae dorsales
 * inventados o ninguno) con el equipo y el número con el que se inscribió cada piloto.
 */
export type LeagueEntry = {
  userId: string
  steamId: string | null
  displayName: string
  teamId: string | null
  teamName: string | null
  dorsal: string | null
  classTag: string | null
}

export type EntryQuery = { userId?: string | null; steamId?: string | null; driverName?: string | null }

const normName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

export async function loadLeagueEntries(leagueId: string): Promise<LeagueEntry[]> {
  const regs = await db.leagueRegistration.findMany({ where: { leagueId, status: { not: 'rejected' } } })
  if (regs.length === 0) return []

  const userIds = Array.from(new Set(regs.map((r) => r.userId)))
  const teamIds = Array.from(new Set(regs.map((r) => r.teamId).filter((id): id is string => Boolean(id))))
  const [accounts, teams] = await Promise.all([
    db.steamAccount.findMany({ where: { userId: { in: userIds } }, select: { userId: true, steamId: true } }),
    teamIds.length > 0 ? db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ])
  const steamByUser = new Map(accounts.map((a) => [a.userId, a.steamId]))
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]))

  return regs.map((r) => ({
    userId: r.userId,
    // El Steam ID de la inscripción manda; si no lo tiene, el de la cuenta de Steam vinculada.
    steamId: r.steamId || steamByUser.get(r.userId) || null,
    displayName: r.displayName,
    teamId: r.teamId,
    teamName: r.teamId ? teamNameById.get(r.teamId) ?? null : null,
    dorsal: r.assignedNumber != null ? String(r.assignedNumber) : null,
    classTag: r.classTag ? r.classTag.trim().toUpperCase() : null,
  }))
}

/**
 * Busca la inscripción de una fila del JSON: primero por userId, luego por Steam ID real y, como último
 * recurso, por nombre de piloto (solo si ese nombre es de una única persona). Si el piloto corre en
 * varias categorías se prefiere la inscripción de la categoría de la fila.
 */
export function findEntry(entries: LeagueEntry[], query: EntryQuery, classTag?: string | null): LeagueEntry | null {
  let candidates: LeagueEntry[] = []
  if (query.userId) candidates = entries.filter((e) => e.userId === query.userId)
  if (candidates.length === 0 && query.steamId) candidates = entries.filter((e) => e.steamId === query.steamId)
  if (candidates.length === 0 && query.driverName) {
    const name = normName(query.driverName)
    const byName = entries.filter((e) => normName(e.displayName) === name)
    if (new Set(byName.map((e) => e.userId)).size === 1) candidates = byName
  }
  if (candidates.length === 0) return null
  const wanted = classTag?.trim().toUpperCase()
  return (wanted && candidates.find((e) => e.classTag === wanted)) || candidates[0]
}
