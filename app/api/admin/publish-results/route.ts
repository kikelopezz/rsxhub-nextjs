import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { recalculateSeasonPoints } from '@/lib/season-points'
import { isTrustedRequestOrigin } from '@/lib/csrf'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Publica los resultados ya guardados de una sesión: los hace oficiales (parrilla de
 * clasificación, o ronda completada si es carrera), que es lo que hace que los pilotos los vean
 * en "Ver resultados" y lo que lee la API de competición (HUD, bot). Guardar una categoría con
 * /api/admin/import-results ya no publica nada por sí solo — así se pueden subir varias
 * categorías (GT3, luego LMP2...) antes de que nadie vea nada, y solo se hacen oficiales cuando
 * se pulsa "Publicar".
 */
export async function POST(req: Request) {
  if (!isTrustedRequestOrigin(req)) return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const leagueId = String(body?.leagueId || '')
  const eventId = String(body?.eventId || '')
  const sessionType = body?.sessionType === 'race' ? 'race' : 'qualifying'

  const session = await getCurrentUser()
  if (!session) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })
  if (!rateLimit(`publish-results:${session.userId}`, 30, 10 * 60_000)) {
    return NextResponse.json({ ok: false, code: 'rate-limited' }, { status: 429 })
  }
  if (!leagueId || !eventId) return NextResponse.json({ ok: false, code: 'missing-params' }, { status: 400 })

  const platformRole = await getPlatformRole(session.userId)
  const leagueRole = await getLeagueRole(leagueId, session.userId)
  if (!canAccessPlatformAdmin(platformRole) && !canStewardLeague(leagueRole)) {
    return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 })
  }

  try {
    const event = await db.leagueEvent.findUnique({ where: { id: eventId } })
    if (!event || event.leagueId !== leagueId) return NextResponse.json({ ok: false, code: 'event-not-found' }, { status: 404 })

    const rowCount = await db.leagueResult.count({ where: { eventId, sessionType } })
    if (rowCount === 0) return NextResponse.json({ ok: false, code: 'no-results-to-publish' }, { status: 400 })

    if (sessionType === 'qualifying') {
      await db.leagueEvent.update({ where: { id: eventId }, data: { qualyCompleted: true } })
    } else {
      await db.leagueEvent.update({ where: { id: eventId }, data: { status: 'completed', completedAt: new Date() } })
      // La clasificación de coches (LeagueTeamPoints) se recalcula sola al publicar una carrera:
      // la clasificación nunca puntúa en qualy, así que no hace falta tocarla en ese caso.
      await recalculateSeasonPoints(leagueId, session.userId)
    }

    invalidateCache([`event_results_${eventId}_qualifying`, `event_results_${eventId}_race`])
    revalidatePath(`/admin/ligas/${leagueId}`)
    revalidatePath('/admin')
    revalidatePath('/ligas')
    revalidatePath('/equipos')

    return NextResponse.json({ ok: true, rowCount })
  } catch (error) {
    console.error('Failed to publish results:', error)
    return NextResponse.json({ ok: false, code: 'publish-failed' }, { status: 500 })
  }
}
