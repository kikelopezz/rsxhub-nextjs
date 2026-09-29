import { db } from '@/lib/db'

/**
 * Recalcula `LeagueTeamPoints` (el acumulado de temporada por coche que se ve en la clasificación)
 * a partir de TODOS los `LeagueResult` de carrera ya publicados (rondas con `status: 'completed'`)
 * de la liga. Es un recálculo completo desde cero, no una suma incremental: así, corregir y volver
 * a publicar (o re-subir) una ronda ya oficial nunca duplica puntos, y una corrección se refleja
 * sola la próxima vez que se recalcula.
 *
 * La clasificación (qualy nunca da puntos) se calcula por coche: (categoría, equipo, dorsal). El
 * equipo se resuelve por la inscripción del piloto en la liga (misma fuente que el resto de
 * pantallas); si el piloto no está inscrito se usa el nombre de equipo ya guardado en el resultado.
 */
export async function recalculateSeasonPoints(leagueId: string, updatedBy: string): Promise<void> {
  const [results, registrations, teams] = await Promise.all([
    db.leagueResult.findMany({
      where: { leagueId, sessionType: 'race', event: { status: 'completed' } },
      select: { userId: true, teamName: true, dorsal: true, classTag: true, points: true },
    }),
    db.leagueRegistration.findMany({ where: { leagueId }, select: { userId: true, teamId: true } }),
    db.team.findMany({ select: { id: true, name: true } }),
  ])

  const teamIdByUser = new Map<string, string>()
  for (const r of registrations) if (r.teamId) teamIdByUser.set(r.userId, r.teamId)
  const teamIdByName = new Map(teams.map((t) => [t.name.trim().toLowerCase(), t.id]))

  type Total = { classTag: string; teamId: string; carNumber: string; points: number }
  const totals = new Map<string, Total>()
  for (const row of results) {
    const teamId = teamIdByUser.get(row.userId) || (row.teamName ? teamIdByName.get(row.teamName.trim().toLowerCase()) : undefined)
    if (!teamId) continue // sin equipo identificable no se le puede atribuir el coche a nadie
    const classTag = (row.classTag || 'GT3').trim().toUpperCase()
    const carNumber = row.dorsal || ''
    const key = `${classTag}|${teamId}|${carNumber}`
    const entry = totals.get(key) || { classTag, teamId, carNumber, points: 0 }
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
