import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { redirectTo } from '@/lib/redirect'
import { findEntry } from '@/lib/league-entries'
import { correlateRow, loadCorrelationContext } from '@/lib/result-review'
import { getClassTagFromModel } from '@/lib/live-timing'
import { recalculateSeasonPoints } from '@/lib/season-points'
import { isTrustedRequestOrigin } from '@/lib/csrf'
import { rateLimit } from '@/lib/rate-limit'

type ImportedResultRow = {
  userId?: string
  steamId?: string
  position: number
  points?: number | null
  classTag?: string
  driverName?: string
  teamName?: string
  dorsal?: string
  lapTime?: string
  raceTime?: string
  /** Coche (folder de Assetto Corsa) que trae el archivo, si lo trae — de ahí se deduce la
   * categoría cuando el archivo no dice directamente la categoría de la fila. */
  carModel?: string
}

function cleanText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function toAdminLeagueUrl(leagueId: string, query: string) {
  return `/admin/ligas/${leagueId}${query ? `?${query}` : ''}`
}

function normalizeIdentityToken(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const steamMatch = raw.match(/\d{17}/)
  if (steamMatch?.[0]) return steamMatch[0]
  const firstToken = raw
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .find(Boolean)
  return firstToken || raw
}

function extractGuidFromUnknown(row: Record<string, unknown>) {
  const direct = normalizeIdentityToken(
    String(
      row.userId ||
        row.user_id ||
        row.steamId ||
        row.steam_id ||
        row.guid ||
        row.DriverGuid ||
        row.driverGuid ||
        '',
    ).trim(),
  )
  if (direct) return direct
  const nestedDriver = row.Driver as { Guid?: unknown; GuidList?: unknown[]; GuidsList?: unknown[] } | undefined
  const nestedDriverLower = row.driver as { guid?: unknown; guidsList?: unknown[] } | undefined
  return normalizeIdentityToken(
    String(nestedDriver?.Guid || nestedDriverLower?.guid || '').trim() ||
      String((nestedDriver?.GuidsList || nestedDriver?.GuidList || nestedDriverLower?.guidsList || [])[0] || '').trim(),
  )
}

function extractPositionFromUnknown(row: Record<string, unknown>, index: number) {
  const value = row.position ?? row.pos ?? row.Position ?? row.rank ?? row.place ?? index + 1
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

function toImportedRow(item: unknown, index: number): ImportedResultRow | null {
  const row = (item || {}) as Record<string, unknown>
  const steamOrUser = extractGuidFromUnknown(row)
  const position = extractPositionFromUnknown(row, index)
  if (!steamOrUser || !position) return null
  const pointsRaw = row.points ?? row.Points ?? null
  const pointsNum = pointsRaw == null || pointsRaw === '' ? null : Number(pointsRaw)
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(steamOrUser)
  const points = Number.isFinite(pointsNum as number) ? (pointsNum as number) : null
  // Datos extra que manda el gestor de ronda (categoría, nombres, dorsal, tiempos, coche)
  const carModel = cleanText(row.carModel ?? row.CarModel ?? row.Model ?? row.model ?? row.car ?? row.Car)
  // Si el archivo no trae la categoría directamente pero sí el coche, se deduce de ahí ya en este
  // punto (mismo mapeo coche→categoría que el live timing) — así también cuenta para agrupar por
  // categoría más abajo (p. ej. al limitar cuántos coches se guardan por categoría).
  const classTag = cleanText(row.classTag ?? row.ClassTag)?.toUpperCase() ?? (carModel ? getClassTagFromModel(carModel).toUpperCase() : undefined)
  const extra = {
    classTag,
    driverName: cleanText(row.driverName ?? row.DriverName),
    teamName: cleanText(row.teamName ?? row.TeamName),
    dorsal: cleanText(row.carNumber ?? row.CarNumber ?? row.dorsal),
    lapTime: cleanText(row.lapTime ?? row.BestLap ?? row.bestLap),
    raceTime: cleanText(row.raceTime ?? row.TotalTime ?? row.totalTime),
    carModel,
  }
  return looksLikeUuid ? { userId: steamOrUser, position, points, ...extra } : { steamId: steamOrUser, position, points, ...extra }
}

function parseResultsJson(raw: string): { eventId?: string; results: ImportedResultRow[] } {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const eventId = parsed?.eventId ? String(parsed.eventId).trim() : undefined
  let rows: unknown[] = []

  if (Array.isArray(parsed)) rows = parsed
  else if (Array.isArray(parsed.results)) rows = parsed.results
  else if (Array.isArray(parsed.Result)) rows = parsed.Result
  else if (Array.isArray(parsed.result)) rows = parsed.result

  if (rows.length === 0) {
    const cars = Array.isArray(parsed.Cars) ? parsed.Cars : Array.isArray(parsed.cars) ? parsed.cars : []
    rows = cars.flatMap((item, index) => {
      const row = item as {
        Driver?: { Guid?: unknown; GuidsList?: unknown[]; GuidList?: unknown[] }
        DriverGuid?: unknown
        Model?: unknown
        CarModel?: unknown
      }
      const guids = Array.from(
        new Set(
          [
            String(row.DriverGuid || row.Driver?.Guid || '').trim(),
            ...((Array.isArray(row.Driver?.GuidsList) ? row.Driver?.GuidsList : Array.isArray(row.Driver?.GuidList) ? row.Driver?.GuidList : []).map((v) =>
              String(v || '').trim(),
            )),
          ].filter(Boolean),
        ),
      )
      const carModel = String(row.Model || row.CarModel || '').trim() || undefined
      return guids.map((guid) => ({ DriverGuid: guid, position: index + 1, CarModel: carModel }))
    })
  }

  const results: ImportedResultRow[] = rows
    .map((item, index) => toImportedRow(item, index))
    .filter((row): row is ImportedResultRow => Boolean(row))

  return { eventId, results }
}

// Por cada categoría se quedan solo los `max` primeros (por posición). Sin categoría cuenta como una sola.
function limitPerClass<T extends { position: number; classTag?: string }>(rows: T[], max: number) {
  const byClass = new Map<string, T[]>()
  for (const row of rows) {
    const key = row.classTag || ''
    byClass.set(key, [...(byClass.get(key) || []), row])
  }
  const kept = new Set<T>()
  byClass.forEach((list) => {
    list
      .slice()
      .sort((a, b) => a.position - b.position)
      .slice(0, max)
      .forEach((row) => kept.add(row))
  })
  return rows.filter((row) => kept.has(row))
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const leagueId = String(formData.get('leagueId') || '')
  const selectedEventId = String(formData.get('eventId') || '').trim()
  const sessionType = String(formData.get('sessionType') || 'race').trim() as 'qualifying' | 'race'
  const rawFromTextField = String(formData.get('resultsJsonText') || '').trim()
  const replaceExisting = formData.get('replaceExisting') === 'on'
  // Máximo de coches que se guardan por categoría (opcional; el gestor de ronda lo manda)
  const maxPerClassRaw = Number(formData.get('maxPerClass'))
  const maxPerClass = Number.isInteger(maxPerClassRaw) && maxPerClassRaw > 0 ? Math.min(maxPerClassRaw, 200) : null
  // El gestor de ronda pide respuesta JSON; el formulario clásico del panel sigue redirigiendo
  const wantsJson = req.headers.get('x-requested-with') === 'fetch'

  const fail = (code: string, status = 400) =>
    wantsJson
      ? NextResponse.json({ ok: false, code }, { status })
      : redirectTo(toAdminLeagueUrl(leagueId, `resultsError=${code}`))

  if (!isTrustedRequestOrigin(req)) return fail('forbidden', 403)

  const session = await getCurrentUser()
  if (!session) return wantsJson ? NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 }) : redirectTo('/perfil')
  if (!rateLimit(`import-results:${session.userId}`, 20, 10 * 60_000)) return fail('rate-limited', 429)
  if (!leagueId) return wantsJson ? NextResponse.json({ ok: false, code: 'league-required' }, { status: 400 }) : redirectTo('/admin')

  const platformRole = await getPlatformRole(session.userId)
  const leagueRole = await getLeagueRole(leagueId, session.userId)
  if (!canAccessPlatformAdmin(platformRole) && !canStewardLeague(leagueRole)) {
    return wantsJson ? NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 }) : redirectTo('/admin')
  }

  const uploadedRaw = formData.get('resultsFile')
  const uploaded =
    uploadedRaw &&
    typeof uploadedRaw === 'object' &&
    'size' in uploadedRaw &&
    'text' in uploadedRaw &&
    typeof (uploadedRaw as { size?: unknown }).size === 'number'
      ? (uploadedRaw as File)
      : null
  if ((!uploaded || uploaded.size === 0) && !rawFromTextField) return fail('file-required')

  let rawJson = ''
  let parsed: { eventId?: string; results: ImportedResultRow[] }
  try {
    rawJson = rawFromTextField || (uploaded ? await uploaded.text() : '')
    parsed = parseResultsJson(rawJson)
  } catch {
    return fail('invalid-json')
  }

  const eventId = selectedEventId || parsed.eventId || ''
  if (!eventId) return fail('event-required')

  try {
    const event = await db.leagueEvent.findUnique({ where: { id: eventId } })
    if (!event || event.leagueId !== leagueId) return fail('event-not-found')
    if (maxPerClass) parsed.results = limitPerClass(parsed.results, maxPerClass)
    if (parsed.results.length === 0) return fail('no-valid-rows')

    const steamIds = Array.from(new Set(parsed.results.map((row) => row.steamId).filter(Boolean))) as string[]
    const steamToUserId = new Map<string, string>()
    const userIdCandidates = Array.from(new Set(parsed.results.map((row) => row.userId).filter(Boolean))) as string[]
    const knownUserIds = new Set<string>()

    if (steamIds.length > 0) {
      const [steamAccounts, regsBySteam] = await Promise.all([
        db.steamAccount.findMany({ where: { steamId: { in: steamIds } } }),
        db.leagueRegistration.findMany({ where: { leagueId, steamId: { in: steamIds } } }),
      ])
      steamAccounts.forEach((s) => steamToUserId.set(s.steamId, s.userId))
      regsBySteam.forEach((r) => {
        if (r.steamId && !steamToUserId.has(r.steamId)) steamToUserId.set(r.steamId, r.userId)
      })
    }

    if (userIdCandidates.length > 0) {
      const users = await db.user.findMany({ where: { id: { in: userIdCandidates } }, select: { id: true } })
      users.forEach((u) => knownUserIds.add(u.id))
    }

    // Equipos, coches e inscripciones de la liga: completan el equipo y el dorsal reales de cada piloto (por Steam ID)
    const correlation = await loadCorrelationContext(leagueId, eventId, sessionType)
    const leagueEntries = correlation.entries

    const resolved = parsed.results
      .map((row) => ({
        ...row,
        userId:
          (row.userId && knownUserIds.has(String(row.userId)) ? String(row.userId) : undefined) ||
          (row.steamId ? steamToUserId.get(row.steamId) : undefined) ||
          // Sin Steam ID reconocido (p. ej. uno inventado): se busca por nombre de piloto entre los inscritos
          findEntry(leagueEntries, { driverName: row.driverName })?.userId,
        points: row.points ?? null,
      }))
      .filter((row) => Boolean(row.userId))

    const unresolvedCount = parsed.results.length - resolved.length
    const resolvedUserIds = Array.from(new Set(resolved.map((row) => row.userId as string)))

    const regs = resolvedUserIds.length > 0 ? await db.leagueRegistration.findMany({ where: { leagueId, userId: { in: resolvedUserIds } } }) : []
    const registeredUserIds = new Set(regs.map((r) => r.userId))
    const regClassByUser = new Map(regs.map((r) => [r.userId, r.classTag ? String(r.classTag).toUpperCase() : undefined]))

    // No estar inscrito en la liga ya no descarta el resultado (antes desaparecía sin aviso,
    // p. ej. el ganador de una carrera si su Steam ID no estaba inscrito formalmente aunque sí
    // tuviera cuenta vinculada en el Hub). Se guarda igual — al mostrarlo se usa el nombre de
    // Steam si lo hay, y si no el que traiga el propio archivo. notRegisteredCount se mantiene
    // solo como dato informativo para el admin.
    const filtered = resolved
    const notRegisteredCount = resolved.filter((row) => !registeredUserIds.has(String(row.userId))).length

    // Categoría, equipo y dorsal de cada fila: los decide correlateRow a partir del coche que el
    // piloto tiene en Equipos por su Steam ID (manda sobre lo que traiga el archivo o la inscripción
    // de la liga, que aquí solo sirven de pista de partida cuando el equipo no lo deja claro).
    const rowsToSave = filtered.map((row) => {
      const c = correlateRow(correlation, {
        userId: row.userId,
        steamId: row.steamId,
        driverName: row.driverName,
        classTag: row.classTag || regClassByUser.get(String(row.userId)),
        teamName: row.teamName,
        dorsal: row.dorsal,
        carModel: row.carModel,
      })
      return { ...row, classTag: c.classTag, dorsal: c.dorsal ?? undefined, teamName: c.teamName ?? undefined }
    })
    const uploadedTags = Array.from(new Set(rowsToSave.map((row) => row.classTag).filter(Boolean))) as string[]

    if (replaceExisting) {
      if (uploadedTags.length > 0) {
        // Solo se reemplazan las categorías que se suben ahora: subir LMP2 no borra lo ya subido de GT3.
        // Los resultados antiguos sin categoría de esos mismos pilotos también se sustituyen.
        await db.leagueResult.deleteMany({
          where: {
            leagueId,
            eventId,
            sessionType,
            OR: [
              ...uploadedTags.map((tag) => ({ classTag: { equals: tag, mode: 'insensitive' as const } })),
              { classTag: null, userId: { in: resolvedUserIds } },
            ],
          },
        })
      } else {
        await db.leagueResult.deleteMany({ where: { leagueId, eventId, sessionType } })
      }
    }

    if (rowsToSave.length > 0) {
      await db.leagueResult.createMany({
        data: rowsToSave.map((row) => ({
          leagueId,
          eventId,
          sessionType,
          userId: row.userId as string,
          position: row.position,
          points: sessionType === 'qualifying' ? 0 : row.points,
          classTag: row.classTag ?? null,
          driverName: row.driverName ?? null,
          teamName: row.teamName ?? null,
          steamId: row.steamId ?? null,
          dorsal: row.dorsal ?? null,
          lapTime: row.lapTime ?? null,
          raceTime: row.raceTime ?? null,
        })),
      })
    }

    // Guardar ya no publica: la ronda solo se marca como completada/con parrilla cuando se pulsa
    // "Publicar" (ver /api/admin/publish-results) — así se pueden subir varias categorías antes
    // de que los pilotos vean nada, en vez de quedar "oficial" con solo la primera subida.
    // Si la ronda YA estaba publicada (se está corrigiendo una carrera oficial), la clasificación
    // de coches se recalcula ahora mismo para que la corrección se note sin tener que "publicar" de nuevo.
    if (sessionType === 'race' && event.status === 'completed') {
      await recalculateSeasonPoints(leagueId, session.userId)
    }

    await db.leagueResultImport.create({
      data: {
        leagueId,
        eventId,
        uploadedByUserId: session.userId,
        fileName: (uploaded && uploaded.name) || 'results.json',
        payloadText: rawJson,
        rowsTotal: parsed.results.length,
        rowsImported: rowsToSave.length,
        rowsUnresolved: unresolvedCount,
        rowsNotRegistered: notRegisteredCount,
      },
    })

    // Que el resultado recién subido se vea al momento (la lista de resultados se guarda 60 s en caché)
    invalidateCache([`event_results_${eventId}_qualifying`, `event_results_${eventId}_race`])
    revalidatePath(`/admin/ligas/${leagueId}`)
    revalidatePath('/admin')
    revalidatePath('/ligas')
    revalidatePath('/equipos')

    if (wantsJson) {
      return NextResponse.json({
        ok: true,
        imported: rowsToSave.length,
        unresolved: unresolvedCount,
        notRegistered: notRegisteredCount,
        classTags: uploadedTags,
      })
    }
    const unresolvedFlag = unresolvedCount > 0 ? `&resultsUnresolved=${unresolvedCount}` : ''
    const notRegisteredFlag = notRegisteredCount > 0 ? `&resultsNotRegistered=${notRegisteredCount}` : ''
    return redirectTo(toAdminLeagueUrl(leagueId, `resultsImported=${rowsToSave.length}${unresolvedFlag}${notRegisteredFlag}`))
  } catch (error) {
    console.error('Failed to import race results REST API:', error)
    return fail('insert-failed', 500)
  }
}
