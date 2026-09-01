import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canStewardLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'

type ImportedResultRow = {
  userId?: string
  steamId?: string
  position: number
  points?: number | null
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
  return looksLikeUuid
    ? { userId: steamOrUser, position, points: Number.isFinite(pointsNum as number) ? (pointsNum as number) : null }
    : { steamId: steamOrUser, position, points: Number.isFinite(pointsNum as number) ? (pointsNum as number) : null }
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

export async function POST(req: Request) {
  const formData = await req.formData()
  const leagueId = String(formData.get('leagueId') || '')
  const selectedEventId = String(formData.get('eventId') || '').trim()
  const sessionType = String(formData.get('sessionType') || 'race').trim()
  const rawFromTextField = String(formData.get('resultsJsonText') || '').trim()
  const replaceExisting = formData.get('replaceExisting') === 'on'

  const session = await getCurrentUser()
  if (!session) return NextResponse.redirect(new URL('/perfil', req.url))
  if (!leagueId) return NextResponse.redirect(new URL('/admin', req.url))

  const platformRole = await getPlatformRole(session.userId)
  const leagueRole = await getLeagueRole(leagueId, session.userId)
  if (!canAccessPlatformAdmin(platformRole) && !canStewardLeague(leagueRole)) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  if (!hasFirebase) return NextResponse.redirect(new URL('/admin?mode=mock', req.url))
  const db = getFirestoreDb()
  if (!db) return NextResponse.redirect(new URL('/admin?mode=mock', req.url))

  const uploadedRaw = formData.get('resultsFile')
  const uploaded =
    uploadedRaw &&
    typeof uploadedRaw === 'object' &&
    'size' in uploadedRaw &&
    'text' in uploadedRaw &&
    typeof (uploadedRaw as { size?: unknown }).size === 'number'
      ? (uploadedRaw as File)
      : null
  if ((!uploaded || uploaded.size === 0) && !rawFromTextField) {
    return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, 'resultsError=file-required'))
  }

  let rawJson = ''
  let parsed: { eventId?: string; results: ImportedResultRow[] }
  try {
    rawJson = rawFromTextField || (uploaded ? await uploaded.text() : '')
    parsed = parseResultsJson(rawJson)
  } catch {
    return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, 'resultsError=invalid-json'))
  }

  const eventId = selectedEventId || parsed.eventId || ''
  if (!eventId) return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, 'resultsError=event-required'))

  try {
    const eventDoc = await db.collection('league_events').doc(eventId).get()
    if (!eventDoc.exists || eventDoc.data()?.league_id !== leagueId) {
      return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, 'resultsError=event-not-found'))
    }
    if (parsed.results.length === 0) return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, 'resultsError=no-valid-rows'))

    const steamIds = Array.from(new Set(parsed.results.map((row) => row.steamId).filter(Boolean))) as string[]
    const steamToUserId = new Map<string, string>()
    const userIdCandidates = Array.from(new Set(parsed.results.map((row) => row.userId).filter(Boolean))) as string[]
    const knownUserIds = new Set<string>()

    if (steamIds.length > 0) {
      const chunks = []
      for (let i = 0; i < steamIds.length; i += 10) {
        chunks.push(steamIds.slice(i, i + 10))
      }
      const snaps = await Promise.all(chunks.map(c => db.collection('steam_accounts').where('steam_id', 'in', c).get()))
      snaps.flatMap(s => s.docs).forEach((doc: any) => {
        steamToUserId.set(doc.data().steam_id, doc.data().user_id)
      })

      const regSnaps = await Promise.all(chunks.map(c => 
        db.collection('league_registrations')
          .where('league_id', '==', leagueId)
          .where('steam_id', 'in', c)
          .get()
      ))
      regSnaps.flatMap(s => s.docs).forEach((doc: any) => {
        if (!steamToUserId.has(doc.data().steam_id)) {
          steamToUserId.set(doc.data().steam_id, doc.data().user_id)
        }
      })
    }

    if (userIdCandidates.length > 0) {
      const chunks = []
      for (let i = 0; i < userIdCandidates.length; i += 10) {
        chunks.push(userIdCandidates.slice(i, i + 10))
      }
      const snaps = await Promise.all(chunks.map(c => db.collection('users').where('__name__', 'in', c).get()))
      snaps.flatMap(s => s.docs).forEach((doc: any) => {
        knownUserIds.add(doc.id)
      })
    }

    const resolved = parsed.results
      .map((row) => ({
        userId:
          (row.userId && knownUserIds.has(String(row.userId)) ? String(row.userId) : undefined) ||
          (row.steamId ? steamToUserId.get(row.steamId) : undefined),
        position: row.position,
        points: row.points ?? null,
      }))
      .filter((row) => Boolean(row.userId))

    const unresolvedCount = parsed.results.length - resolved.length
    const resolvedUserIds = Array.from(new Set(resolved.map((row) => row.userId as string)))
    
    let registeredUserIds = new Set<string>()
    if (resolvedUserIds.length > 0) {
      const chunks = []
      for (let i = 0; i < resolvedUserIds.length; i += 10) {
        chunks.push(resolvedUserIds.slice(i, i + 10))
      }
      const regSnaps = await Promise.all(chunks.map(c => 
        db.collection('league_registrations')
          .where('league_id', '==', leagueId)
          .where('user_id', 'in', c)
          .get()
      ))
      registeredUserIds = new Set(regSnaps.flatMap(s => s.docs).map((doc: any) => doc.data().user_id))
    }

    const filtered = resolved.filter((row) => registeredUserIds.has(String(row.userId)))
    const notRegisteredCount = resolved.length - filtered.length

    if (replaceExisting) {
      const existingResultsSnap = await db
        .collection('league_results')
        .where('league_id', '==', leagueId)
        .where('event_id', '==', eventId)
        .get()
      const delBatch = db.batch()
      existingResultsSnap.docs.forEach((doc: any) => {
        const docSession = doc.data()?.session_type || doc.data()?.sessionType || 'race'
        if (docSession === sessionType) {
          delBatch.delete(doc.ref)
        }
      })
      await delBatch.commit()
    }

    if (filtered.length > 0) {
      const payload = filtered.map((row) => ({
        league_id: leagueId,
        event_id: eventId,
        session_type: sessionType,
        user_id: row.userId as string,
        position: row.position,
        points: sessionType === 'qualifying' ? 0 : row.points,
        created_at: new Date(),
      }))

      const insertBatch = db.batch()
      payload.forEach((row) => {
        const docRef = db.collection('league_results').doc()
        insertBatch.set(docRef, row)
      })
      await insertBatch.commit()
    }

    if (sessionType === 'qualifying') {
      await db.collection('league_events').doc(eventId).update({
        qualy_completed: true,
        qualyCompleted: true,
      })
    } else {
      const nowIso = new Date().toISOString()
      await db.collection('league_events').doc(eventId).update({
        status: 'completed',
        completed_at: nowIso,
        completedAt: nowIso,
      })
    }

    await db.collection('league_result_imports').add({
      league_id: leagueId,
      event_id: eventId,
      uploaded_by_user_id: session.userId,
      file_name: (uploaded && uploaded.name) || 'results.json',
      payload_text: rawJson,
      rows_total: parsed.results.length,
      rows_imported: filtered.length,
      rows_unresolved: unresolvedCount,
      rows_not_registered: notRegisteredCount,
      created_at: new Date(),
    })

    revalidatePath(`/admin/ligas/${leagueId}`)
    revalidatePath('/admin')
    revalidatePath('/ligas')
    revalidatePath('/equipos')
    const unresolvedFlag = unresolvedCount > 0 ? `&resultsUnresolved=${unresolvedCount}` : ''
    const notRegisteredFlag = notRegisteredCount > 0 ? `&resultsNotRegistered=${notRegisteredCount}` : ''
    return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, `resultsImported=${filtered.length}${unresolvedFlag}${notRegisteredFlag}`))
  } catch (error) {
    console.error('Failed to import race results REST API:', error)
    return NextResponse.redirect(toAdminLeagueUrl(req, leagueId, 'resultsError=insert-failed'))
  }
}
