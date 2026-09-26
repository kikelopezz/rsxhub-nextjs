import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { findEntry, loadLeagueEntries } from '@/lib/league-entries'

type RowQuery = { steamId?: string; driverName?: string; classTag?: string }

/**
 * Dado el listado de pilotos de un JSON de resultados, devuelve para cada uno el equipo y el dorsal con los
 * que está inscrito en la liga (o null si no se encuentra). El gestor de ronda lo usa para la vista previa.
 */
export async function POST(req: Request) {
  const session = await getCurrentUser()
  if (!session) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { leagueId?: string; rows?: RowQuery[] } | null
  const leagueId = String(body?.leagueId || '')
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 500) : []
  if (!leagueId) return NextResponse.json({ ok: false, code: 'league-required' }, { status: 400 })

  const platformRole = await getPlatformRole(session.userId)
  const leagueRole = await getLeagueRole(leagueId, session.userId)
  if (!canAccessPlatformAdmin(platformRole) && !canStewardLeague(leagueRole)) {
    return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 })
  }

  const entries = await loadLeagueEntries(leagueId)
  const matches = rows.map((row) => {
    const entry = findEntry(entries, { steamId: row.steamId, driverName: row.driverName }, row.classTag)
    return entry
      ? { userId: entry.userId, teamName: entry.teamName, dorsal: entry.dorsal, classTag: entry.classTag }
      : null
  })
  return NextResponse.json({ ok: true, matches })
}
