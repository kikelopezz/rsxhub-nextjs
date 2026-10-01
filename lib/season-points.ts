import { db } from '@/lib/db'

/**
 * Suma los puntos de UNA ronda de carrera al acumulado de temporada (`LeagueTeamPoints`), sin
 * tocar nunca los puntos que ya hubiera ahí por otro motivo (una carga manual, una ronda distinta,
 * etc.) — nunca recalcula el total desde cero ni lo reemplaza.
 *
 * Para poder sumar sin arriesgarse a duplicar si esta misma ronda se corrige y se vuelve a publicar
 * (o se re-sube ya publicada), se guarda en `LeagueEventCarPoints` cuánto había aportado ya ESTA
 * ronda a cada coche; la segunda vez solo se aplica la diferencia respecto a esa aportación anterior,
 * nunca el total de la ronda otra vez entero.
 *
 * IMPORTANTE: el "coche" se identifica EXACTAMENTE igual que en la ficha de la liga (ver
 * `use-league-state.ts`) — por la inscripción del piloto (equipo + número ASIGNADO en la
 * inscripción), nunca por el dorsal que traiga el resultado de la carrera. Son cosas distintas: el
 * dorsal de carrera puede no estar registrado o no coincidir con el número asignado al inscribirse.
 * Si se usara el dorsal de carrera como clave, los puntos se guardarían en una fila que la
 * clasificación nunca lee (parece que "se borran" los puntos de ese coche).
 */
export async function applyEventPointsToSeasonTotal(leagueId: string, eventId: string, updatedBy: string): Promise<void> {
  const [results, registrations, previousContributions] = await Promise.all([
    db.leagueResult.findMany({
      where: { leagueId, eventId, sessionType: 'race' },
      select: { userId: true, classTag: true, points: true },
    }),
    db.leagueRegistration.findMany({
      where: { leagueId, teamId: { not: null } },
      select: { userId: true, teamId: true, classTag: true, assignedNumber: true },
    }),
    db.leagueEventCarPoints.findMany({ where: { leagueId, eventId } }),
  ])

  const regsByUser = new Map<string, typeof registrations>()
  for (const r of registrations) regsByUser.set(r.userId, [...(regsByUser.get(r.userId) || []), r])

  // Un piloto normalmente solo tiene una inscripción; si tuviera varias (una por categoría), se
  // prefiere la de la categoría en la que corrió esa carrera.
  const findRegistration = (userId: string, classTag: string | null) => {
    const list = regsByUser.get(userId)
    if (!list || list.length === 0) return null
    const wanted = (classTag || '').trim().toUpperCase()
    return list.find((r) => (r.classTag || '').trim().toUpperCase() === wanted) || list[0]
  }

  // Lo que esta ronda aporta a cada coche, calculado desde cero a partir de los LeagueResult
  // actuales de ESTA ronda únicamente (no de toda la temporada).
  type RoundTotal = { classTag: string; teamId: string; carNumber: string; points: number }
  const roundTotals = new Map<string, RoundTotal>()
  for (const row of results) {
    const reg = findRegistration(row.userId, row.classTag)
    if (!reg?.teamId) continue // sin inscripción con equipo, ese coche no sale en la clasificación
    const classTag = (reg.classTag || row.classTag || 'GT3').trim().toUpperCase()
    const carNumber = reg.assignedNumber != null ? String(reg.assignedNumber) : ''
    const key = `${classTag}|${reg.teamId}|${carNumber}`
    const entry = roundTotals.get(key) || { classTag, teamId: reg.teamId, carNumber, points: 0 }
    entry.points += row.points || 0
    roundTotals.set(key, entry)
  }

  const previousByKey = new Map(previousContributions.map((p) => [`${p.classTag}|${p.teamId}|${p.carNumber}`, p]))

  // Coches a los que esta ronda ya había dado puntos antes, pero que ahora (tras una corrección) ya
  // no aparecen — p. ej. un piloto quitado de los resultados. Sin esto, su aportación anterior se
  // quedaría sumada para siempre aunque el resultado que la causó ya no exista.
  for (const key of previousByKey.keys()) {
    if (!roundTotals.has(key)) {
      const prev = previousByKey.get(key)!
      roundTotals.set(key, { classTag: prev.classTag, teamId: prev.teamId, carNumber: prev.carNumber, points: 0 })
    }
  }

  const writes = Array.from(roundTotals.values())
    .map((t) => {
      const key = `${t.classTag}|${t.teamId}|${t.carNumber}`
      const previous = previousByKey.get(key)?.points ?? 0
      const delta = t.points - previous
      return { ...t, delta }
    })
    .filter((t) => t.delta !== 0)

  if (writes.length === 0) return

  await db.$transaction(
    writes.flatMap((t) => [
      db.leagueEventCarPoints.upsert({
        where: { leagueId_eventId_classTag_teamId_carNumber: { leagueId, eventId, classTag: t.classTag, teamId: t.teamId, carNumber: t.carNumber } },
        create: { leagueId, eventId, classTag: t.classTag, teamId: t.teamId, carNumber: t.carNumber, points: t.points },
        update: { points: t.points },
      }),
      db.leagueTeamPoints.upsert({
        where: { leagueId_classTag_teamId_carNumber: { leagueId, classTag: t.classTag, teamId: t.teamId, carNumber: t.carNumber } },
        create: { leagueId, classTag: t.classTag, teamId: t.teamId, carNumber: t.carNumber, points: Math.max(0, t.delta), updatedBy },
        update: { points: { increment: t.delta }, updatedBy },
      }),
    ])
  )
}
