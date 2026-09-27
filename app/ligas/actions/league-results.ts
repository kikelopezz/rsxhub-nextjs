'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getAdminAccessContext, canStewardLeague } from '@/lib/auth'
import { db } from '@/lib/db'
import { fetchWithTTLCache, invalidateCache } from '@/lib/ttl-cache'
import { correlateRow, loadCorrelationContext, readReviews, writeReviews, WARNING_FLAGS, type CarDetection, type ReviewFlag } from '@/lib/result-review'
import { isDorsalValid } from '@/lib/dorsal-utils'
import { getTeamsDashboard } from '@/lib/team-data'

export type EventResultRow = {
  id: string
  sessionType: string
  position: number
  driverName: string
  teamName: string
  steamId: string
  classTag: string
  dorsal: string | null
  points: number
  lapTime: string | null
  raceTime: string | null
  /** Solo en la vista de revisión de admins */
  reviewKey?: string
  car?: Pick<CarDetection, 'teamName' | 'dorsal' | 'carModel' | 'source'>
  flags?: ReviewFlag[]
  review?: { status: 'confirmed' | 'override'; by: string; at: string } | null
  needsReview?: boolean
}

async function buildResults(leagueId: string, eventId: string, sessionType: 'qualifying' | 'race', forReview: boolean): Promise<EventResultRow[]> {
  const rows = await db.leagueResult.findMany({ where: { eventId, sessionType } })
  if (rows.length === 0) return []

  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)))
  const [{ teams }, profiles, steamAccounts, ctx] = await Promise.all([
    getTeamsDashboard(),
    userIds.length > 0 ? db.profile.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
    userIds.length > 0 ? db.steamAccount.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
    loadCorrelationContext(leagueId, eventId, sessionType),
  ])

  const profilesMap = new Map(profiles.map((p) => [p.userId, p.displayName]))
  const steamMap = new Map(steamAccounts.map((s) => [s.userId, { steamId: s.steamId, name: s.steamDisplayName }]))

  const built = rows.map((row) => {
    const profName = profilesMap.get(row.userId)
    const stm = steamMap.get(row.userId)
    const dName = profName || stm?.name || row.driverName || (row.userId ? `Driver ${row.userId.slice(0, 4)}` : 'Driver')
    const sId = stm?.steamId || row.steamId || ''

    // Equipo y número del coche por Steam ID (misma regla que el resto de pantallas y APIs)
    const c = correlateRow(ctx, { userId: row.userId, steamId: sId, driverName: dName, classTag: row.classTag, teamName: row.teamName, dorsal: row.dorsal })

    let teamName = c.teamName || ''
    if (!teamName) {
      const matchedTeam = teams.find((t: any) => t.members?.some((m: any) => m.userId === row.userId))
      if (matchedTeam) teamName = matchedTeam.name
    }

    const result: EventResultRow = {
      id: row.id,
      sessionType: row.sessionType,
      position: row.position ?? 0,
      driverName: dName,
      teamName: teamName || 'Independent',
      steamId: sId,
      classTag: c.classTag,
      dorsal: c.dorsal,
      points: row.points ?? 0,
      lapTime: row.lapTime,
      raceTime: row.raceTime,
    }
    if (forReview) {
      result.reviewKey = c.reviewKey
      result.car = { teamName: c.detection.teamName, dorsal: c.detection.dorsal, carModel: c.detection.carModel, source: c.detection.source }
      result.flags = [...c.detection.flags]
      result.review = c.review ? { status: c.review.status, by: c.review.by, at: c.review.at } : null
    }
    return result
  })

  if (forReview) {
    // Dos pilotos de la misma categoría con el mismo número: uno de los dos está mal
    const seen = new Map<string, EventResultRow[]>()
    for (const r of built) {
      if (!r.dorsal) continue
      const k = `${r.classTag}|${r.dorsal}`
      seen.set(k, [...(seen.get(k) || []), r])
    }
    seen.forEach((list) => {
      if (list.length > 1) list.forEach((r) => r.flags?.push('duplicate-number'))
    })
    for (const r of built) {
      const warnings = (r.flags || []).some((f) => WARNING_FLAGS.includes(f))
      r.needsReview = warnings && !r.review
    }
  }

  return built.sort((a, b) => a.position - b.position)
}

/**
 * Guardar una categoría no la hace visible por sí sola: hasta que se pulsa "Publicar" (ver
 * /api/admin/publish-results), lo que haya guardado es un borrador que solo ven admins y
 * comisarios desde el modo de revisión — el resto solo ve la última clasificación/carrera
 * publicada, aunque ya haya datos más nuevos sin publicar por debajo.
 */
async function isSessionPublished(eventId: string, sessionType: 'qualifying' | 'race'): Promise<boolean> {
  const event = await db.leagueEvent.findUnique({ where: { id: eventId }, select: { qualyCompleted: true, status: true } })
  if (!event) return false
  return sessionType === 'qualifying' ? Boolean(event.qualyCompleted) : event.status === 'completed'
}

export async function getEventResultsAction(leagueId: string, eventId: string, sessionType: 'qualifying' | 'race' = 'race') {
  return fetchWithTTLCache(`event_results_${eventId}_${sessionType}`, async () => {
    try {
      if (!(await isSessionPublished(eventId, sessionType))) return []
      return await buildResults(leagueId, eventId, sessionType, false)
    } catch (err) {
      console.error('Failed to load event results:', err)
      return []
    }
  }, 60)
}

async function requireReviewer(leagueId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')
  const access = await getAdminAccessContext(session.userId)
  const allowed = access.canAccessPlatformAdmin || canStewardLeague(access.platformRole) || access.managedLeagueIds.includes(leagueId)
  if (!allowed) throw new Error('Unauthorized: solo admins y comisarios pueden revisar los resultados.')
  return session
}

/** Resultados con la detección del coche de cada posición y su estado de revisión (solo admins y comisarios). */
export async function getEventResultsForReviewAction(leagueId: string, eventId: string, sessionType: 'qualifying' | 'race' = 'race') {
  await requireReviewer(leagueId)
  return buildResults(leagueId, eventId, sessionType, true)
}

export async function saveResultReviewAction(input: {
  leagueId: string
  eventId: string
  sessionType: 'qualifying' | 'race'
  reviewKey: string
  action: 'confirm' | 'override' | 'clear'
  teamName?: string
  dorsal?: string
}) {
  const session = await requireReviewer(input.leagueId)
  const { eventId, sessionType, reviewKey } = input
  if (!reviewKey) throw new Error('Missing review key')

  const map = await readReviews(eventId, sessionType)
  if (input.action === 'clear') {
    delete map[reviewKey]
  } else if (input.action === 'confirm') {
    map[reviewKey] = { status: 'confirmed', by: session.userId, at: new Date().toISOString() }
  } else {
    const teamName = String(input.teamName || '').trim().slice(0, 60)
    const dorsal = String(input.dorsal || '').trim()
    if (dorsal && !isDorsalValid(dorsal)) throw new Error('Número de coche no válido (1 a 3 dígitos).')
    if (!teamName && !dorsal) throw new Error('Indica un equipo o un número.')
    map[reviewKey] = { status: 'override', teamName: teamName || null, dorsal: dorsal || null, by: session.userId, at: new Date().toISOString() }
  }
  await writeReviews(eventId, sessionType, map)

  invalidateCache([`event_results_${eventId}_${sessionType}`])
  revalidatePath(`/ligas`)
  return { ok: true as const }
}

export async function updateTeamPointsAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  const isSteward = canStewardLeague(access.platformRole)
  if (!access.canAccessPlatformAdmin && !isSteward) {
    throw new Error('Unauthorized: Only Admins and Stewards can modify team points.')
  }

  const leagueId = String(formData.get('leagueId') || '').trim()
  const classTag = String(formData.get('classTag') || 'GT3').trim().toUpperCase()
  const teamId = String(formData.get('teamId') || '').trim()
  const carNumber = String(formData.get('carNumber') || '').trim()
  const points = Math.max(0, parseInt(String(formData.get('points') || '0'), 10) || 0)
  const slug = String(formData.get('slug') || '')

  if (!leagueId || !teamId) throw new Error('Missing parameters')

  await db.leagueTeamPoints.upsert({
    where: { leagueId_classTag_teamId_carNumber: { leagueId, classTag, teamId, carNumber } },
    create: { leagueId, classTag, teamId, carNumber, points, updatedBy: session.userId },
    update: { points, updatedBy: session.userId },
  })

  if (slug) {
    revalidatePath(`/ligas/${slug}`)
  }
}

export async function updateCarPhotoAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  const isSteward = canStewardLeague(access.platformRole)
  if (!access.canAccessPlatformAdmin && !isSteward) {
    throw new Error('Unauthorized: Only Admins and Stewards can change car photos.')
  }

  const leagueId = String(formData.get('leagueId') || '').trim()
  const classTag = String(formData.get('classTag') || 'GT3').trim().toUpperCase()
  const teamId = String(formData.get('teamId') || '').trim()
  const carNumber = String(formData.get('carNumber') || '').trim()
  const imageUrl = String(formData.get('imageUrl') || '').trim()
  const slug = String(formData.get('slug') || '')

  if (!leagueId || !teamId || !imageUrl) throw new Error('Missing parameters')

  await db.leagueCarPhoto.upsert({
    where: { leagueId_classTag_teamId_carNumber: { leagueId, classTag, teamId, carNumber } },
    create: { leagueId, classTag, teamId, carNumber, imageUrl, updatedBy: session.userId },
    update: { imageUrl, updatedBy: session.userId },
  })

  if (slug) {
    revalidatePath(`/ligas/${slug}`)
  }
}
