import { db } from '@/lib/db'

/**
 * Recalcula `LeagueTeamPoints` (el acumulado de temporada por coche que se ve en la clasificación)
 * a partir de TODOS los `LeagueResult` de carrera ya publicados (rondas con `status: 'completed'`)
 * de la liga. Es un recálculo completo desde cero, no una suma incremental: así, corregir y volver
 * a publicar (o re-subir) una ronda ya oficial nunca duplica puntos, y una corrección se refleja
 * sola la próxima vez que se recalcula.
 *
 * IMPORTANTE: el "coche" se identifica EXACTAMENTE igual que en la ficha de la liga (ver
 * `use-league-state.ts`) — por la inscripción del piloto (equipo + número ASIGNADO en la
 * inscripción), nunca por el dorsal que traiga el resultado de la carrera. Son cosas distintas: el
 * dorsal de carrera puede no estar registrado o no coincidir con el número asignado al inscribirse.
 * Si se usara el dorsal de carrera como clave, los puntos se guardarían en una fila que la
 * clasificación nunca lee (parece que "se borran" los puntos de ese coche).
 */
export async function recalculateSeasonPoints(leagueId: string, updatedBy: string): Promise<void> {
  const [results, registrations] = await Promise.all([
    db.leagueResult.findMany({
      where: { leagueId, sessionType: 'race', event: { status: 'completed' } },
      select: { userId: true, classTag: true, points: true },
    }),
    db.leagueRegistration.findMany({
      where: { leagueId, teamId: { not: null } },
      select: { userId: true, teamId: true, classTag: true, assignedNumber: true },
    }),
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

  type Total = { classTag: string; teamId: string; carNumber: string; points: number }
  const totals = new Map<string, Total>()
  for (const row of results) {
    const reg = findRegistration(row.userId, row.classTag)
    if (!reg?.teamId) continue // sin inscripción con equipo, ese coche no sale en la clasificación
    const classTag = (reg.classTag || row.classTag || 'GT3').trim().toUpperCase()
    const carNumber = reg.assignedNumber != null ? String(reg.assignedNumber) : ''
    const key = `${classTag}|${reg.teamId}|${carNumber}`
    const entry = totals.get(key) || { classTag, teamId: reg.teamId, carNumber, points: 0 }
    entry.points += row.points || 0
    totals.set(key, entry)
  }

  if (totals.size === 0) return

  await db.$transaction(
    Array.from(totals.values()).map((t) =>
      db.leagueTeamPoints.upsert({
        where: { leagueId_classTag_teamId_carNumber: { leagueId, classTag: t.classTag, teamId: t.teamId, carNumber: t.carNumber } },
        create: { leagueId, classTag: t.classTag, teamId: t.teamId, carNumber: t.carNumber, points: t.points, updatedBy },
        update: { points: t.points, updatedBy },
      })
    )
  )
}
