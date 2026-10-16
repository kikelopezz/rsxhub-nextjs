'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { guardLeaguePermission } from './admin-league'
import { applyEventPointsToSeasonTotal } from '@/lib/season-points'

function refresh(leagueId: string) {
  revalidatePath(`/admin/ligas/${leagueId}`)
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath('/equipos')
}

function parseIntOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function textOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim()
  return raw || null
}

// Edita una fila de resultado ya publicada (p. ej. corregir una posición mal detectada, o
// descalificar a un coche después de una protesta) sin tener que re-subir el JSON entero.
export async function updateLeagueResultAction(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const { session } = await guardLeaguePermission(leagueId, 'steward')

  const resultId = String(formData.get('resultId') || '')
  if (!resultId) redirect(`/admin/ligas/${leagueId}?resultsError=missing-fields`)

  const result = await db.leagueResult.findUnique({ where: { id: resultId } })
  if (!result || result.leagueId !== leagueId) redirect(`/admin/ligas/${leagueId}?resultsError=result-not-found`)

  await db.leagueResult.update({
    where: { id: resultId },
    data: {
      position: parseIntOrNull(formData.get('position')),
      points: parseIntOrNull(formData.get('points')),
      status: (String(formData.get('status') || 'finished') as 'finished' | 'dnf' | 'dsq'),
      driverName: textOrNull(formData.get('driverName')),
      teamName: textOrNull(formData.get('teamName')),
      classTag: textOrNull(formData.get('classTag')),
      dorsal: textOrNull(formData.get('dorsal')),
      lapTime: textOrNull(formData.get('lapTime')),
      raceTime: textOrNull(formData.get('raceTime')),
    },
  })

  // Si los puntos de una carrera cambian tras publicarse (p. ej. una descalificación por protesta),
  // el acumulado de temporada tiene que corregirse también — si no, se queda con el valor viejo.
  if (result.sessionType === 'race') {
    await applyEventPointsToSeasonTotal(leagueId, result.eventId, session.userId).catch((e) =>
      console.error('Failed to resync season points after result edit:', e)
    )
  }

  refresh(leagueId)
  redirect(`/admin/ligas/${leagueId}?resultsUpdated=1`)
}

export async function deleteLeagueResultAction(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const { session } = await guardLeaguePermission(leagueId, 'steward')

  const resultId = String(formData.get('resultId') || '')
  if (!resultId) redirect(`/admin/ligas/${leagueId}?resultsError=missing-fields`)

  const result = await db.leagueResult.findUnique({ where: { id: resultId } })
  if (result && result.leagueId === leagueId) {
    await db.leagueResult.deleteMany({ where: { id: resultId, leagueId } })
    if (result.sessionType === 'race') {
      await applyEventPointsToSeasonTotal(leagueId, result.eventId, session.userId).catch((e) =>
        console.error('Failed to resync season points after result delete:', e)
      )
    }
  }

  refresh(leagueId)
  redirect(`/admin/ligas/${leagueId}?resultsUpdated=1`)
}

// Fila de resultado para un coche/equipo sin piloto registrado en la plataforma (userId queda a
// null) — el importador de JSON descarta estas filas porque exige una inscripción aprobada; este
// es el único camino para meterlas.
export async function createManualLeagueResultAction(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  await guardLeaguePermission(leagueId, 'steward')

  const eventId = String(formData.get('eventId') || '')
  const driverName = textOrNull(formData.get('driverName'))
  if (!eventId || !driverName) redirect(`/admin/ligas/${leagueId}?resultsError=missing-fields`)

  const event = await db.leagueEvent.findUnique({ where: { id: eventId } })
  if (!event || event.leagueId !== leagueId) redirect(`/admin/ligas/${leagueId}?resultsError=event-not-found`)

  await db.leagueResult.create({
    data: {
      leagueId,
      eventId,
      userId: null,
      sessionType: (String(formData.get('sessionType') || 'race') as 'qualifying' | 'race'),
      position: parseIntOrNull(formData.get('position')),
      points: parseIntOrNull(formData.get('points')),
      status: (String(formData.get('status') || 'finished') as 'finished' | 'dnf' | 'dsq'),
      driverName,
      teamName: textOrNull(formData.get('teamName')),
      classTag: textOrNull(formData.get('classTag')),
      dorsal: textOrNull(formData.get('dorsal')),
      lapTime: textOrNull(formData.get('lapTime')),
      raceTime: textOrNull(formData.get('raceTime')),
    },
  })

  refresh(leagueId)
  redirect(`/admin/ligas/${leagueId}?resultsUpdated=1`)
}
