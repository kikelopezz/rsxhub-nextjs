import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'

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
}

function cleanText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function toAdminLeagueUrl(req: Request, leagueId: string, query: string) {
  return new URL(`/admin/ligas/${leagueId}${query ? `?${query}` : ''}`, req.url)
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
  // Datos extra que manda el gestor de ronda (categoría, nombres, dorsal, tiempos)
  const extra = {
    classTag: cleanText(row.classTag ?? row.ClassTag)?.toUpperCase(),
    driverName: cleanText(row.driverName ?? row.DriverName),
    teamName: cleanText(row.teamName ?? row.TeamName),
    dorsal: cleanText(row.carNumber ?? row.CarNumber ?? row.dorsal),
    lapTime: cleanText(row.lapTime ?? row.BestLap ?? row.bestLap),
    raceTime: cleanText(row.raceTime ?? row.TotalTime ?? row.totalTime),
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
      const row = item as { Driver?: { Guid?: unknown; GuidsList?: unknown[]; GuidList?: unknown[] }; DriverGuid?: unknown }
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
      return guids.map((guid) => ({ DriverGuid: guid, position: index + 1 }))
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
      : NextResponse.redirect(toAdminLeagueUrl(req, leagueId, `resultsError=${code}`))

  const session = await getCurrentUser()
  if (!session) return wantsJson ? NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 }) : NextResponse.redirect(new URL('/perfil', req.url))
  if (!leagueId) return wantsJson ? NextResponse.json({ ok: false, code: 'league-required' }, { status: 400 }) : NextResponse.redirect(new URL('/admin', req.url))

  const platformRole = await getPlatformRole(session.userId)
  const leagueRole = await getLeagueRole(leagueId, session.userId)
  if (!canAccessPlatformAdmin(platformRole) && !canStewardLeague(leagueRole)) {
    return wantsJson ? NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 }) : NextResponse.redirect(new URL('/admin', req.url))
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

    const resolved = parsed.results
      .map((row) => ({
        ...row,
        userId:
          (row.userId && knownUserIds.has(String(row.userId)) ? String(row.userId) : undefined) ||
          (row.steamId ? steamToUserId.get(row.steamId) : undefined),
        points: row.points ?? null,
      }))
      .filter((row) => Boolean(row.userId))

    const unresolvedCount = parsed.results.length - resolved.length
    const resolvedUserIds = Array.from(new Set(resolved.map((row) => row.userId as string)))

    const regs = resolvedUserIds.length > 0 ? await db.leagueRegistration.findMany({ where: { leagueId, userId: { in: resolvedUserIds } } }) : []
    const registeredUserIds = new Set(regs.map((r) => r.userId))
    const regClassByUser = new Map(regs.map((r) => [r.userId, r.classTag ? String(r.classTag).toUpperCase() : undefined]))

    const filtered = resolved.filter((row) => registeredUserIds.has(String(row.userId)))
    const notRegisteredCount = resolved.length - filtered.length

    // Categoría de cada fila: la que manda el gestor de ronda o, si no, la de la inscripción del piloto
    const rowsToSave = filtered.map((row) => ({ ...row, classTag: row.classTag || regClassByUser.get(String(row.userId)) }))
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

    if (sessionType === 'qualifying') {
      await db.leagueEvent.update({ where: { id: eventId }, data: { qualyCompleted: true } })
    } else {
      await db.leagueEvent.update({ where: { id: eventId }, data: { status: 'completed', completedAt: new Date() } })
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
    return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, `resultsImported=${rowsToSave.length}${unresolvedFlag}${notRegisteredFlag}`))
  } catch (error) {
    console.error('Failed to import race results REST API:', error)
    return fail('insert-failed', 500)
  }
}
