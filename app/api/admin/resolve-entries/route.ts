import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { correlateRow, loadCorrelationContext } from '@/lib/result-review'

type RowQuery = {
  userId?: string
  steamId?: string
  driverName?: string
  classTag?: string
  teamName?: string
  dorsal?: string
  /** Modelo de coche que trae el archivo (folder de Assetto Corsa), si lo trae. */
  carModel?: string
}

/**
 * Dado el listado de pilotos de un JSON de resultados, devuelve para cada uno el equipo, el dorsal y la
 * CATEGORÍA reales (Steam ID → coche en Equipos → categoría, igual que al guardar de verdad en
 * /api/admin/import-results). El gestor de ronda lo usa para que la vista previa ya salga agrupada por
 * categoría correctamente, antes de guardar nada.
 */
export async function POST(req: Request) {
  const session = await getCurrentUser()
  if (!session) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as
    | { leagueId?: string; eventId?: string; sessionType?: string; rows?: RowQuery[] }
    | null
  const leagueId = String(body?.leagueId || '')
  const eventId = String(body?.eventId || '')
  const sessionType = String(body?.sessionType || 'race')
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 500) : []
  if (!leagueId) return NextResponse.json({ ok: false, code: 'league-required' }, { status: 400 })

  const platformRole = await getPlatformRole(session.userId)
  const leagueRole = await getLeagueRole(leagueId, session.userId)
  if (!canAccessPlatformAdmin(platformRole) && !canStewardLeague(leagueRole)) {
    return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 })
  }

  const ctx = await loadCorrelationContext(leagueId, eventId, sessionType)
  // Siempre se devuelve la categoría correlacionada (aunque no se encuentre equipo/coche, p. ej. un
  // piloto sin equipo asignado se clasifica igualmente por el modelo de coche que trae el archivo).
  const matches = rows.map((row) => {
    const c = correlateRow(ctx, row)
    return { userId: row.userId, teamName: c.teamName, dorsal: c.dorsal, classTag: c.classTag, flags: c.detection.flags }
  })
  return NextResponse.json({ ok: true, matches })
}
