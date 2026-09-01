'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { guardLeaguePermission } from './admin-league'

type ImportedResultRow = {
  userId?: string
  steamId?: string
  position: number
  points?: number | null
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
  const nested = normalizeIdentityToken(
    String(nestedDriver?.Guid || nestedDriverLower?.guid || '').trim() ||
      String((nestedDriver?.GuidsList || nestedDriver?.GuidList || nestedDriverLower?.guidsList || [])[0] || '').trim(),
  )
  return nested || ''
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
    ? {
        userId: steamOrUser,
        position,
        points: Number.isFinite(pointsNum as number) ? (pointsNum as number) : null,
      }
    : {
        steamId: steamOrUser,
        position,
        points: Number.isFinite(pointsNum as number) ? (pointsNum as number) : null,
      }
}

function pickBestArrayFromTree(root: unknown): unknown[] {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }]
  const seen = new Set<unknown>()
  let best: { score: number; rows: unknown[] } = { score: -1, rows: [] }

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const { value, depth } = current
    if (!value || typeof value !== 'object') continue
    if (seen.has(value)) continue
    seen.add(value)
    if (depth > 7) continue

    if (Array.isArray(value)) {
      const sample = value.slice(0, 12)
      let parsable = 0
      let hasResultShape = 0
      for (let i = 0; i < sample.length; i += 1) {
        const item = sample[i]
        const row = (item || {}) as Record<string, unknown>
        if (toImportedRow(item, i)) parsable += 1
        if (
          row.TotalTime != null ||
          row.NumLaps != null ||
          row.BestLap != null ||
          row.GridPosition != null ||
          row.DriverGuid != null
        ) {
          hasResultShape += 1
        }
      }
      const score = parsable * 3 + hasResultShape * 5 + Math.min(value.length, 200)
      if (score > best.score) best = { score, rows: value }

      for (const item of sample) {
        if (item && typeof item === 'object') queue.push({ value: item, depth: depth + 1 })
      }
      continue
    }

    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 })
    }
  }

  return best.rows
}

function parseResultsJson(raw: string): { eventId?: string; results: ImportedResultRow[] } {
  const parsed = JSON.parse(raw) as unknown
  const source = (parsed || {}) as {
    eventId?: unknown
    results?: unknown[]
    Result?: unknown[]
    result?: unknown[]
    Cars?: unknown[]
    cars?: unknown[]
    Sessions?: Array<{ Result?: unknown[]; results?: unknown[]; result?: unknown[] }>
    sessions?: Array<{ Result?: unknown[]; results?: unknown[]; result?: unknown[] }>
  }

  const eventId = source?.eventId ? String(source.eventId).trim() : undefined
  const sessions = (Array.isArray(source.Sessions) ? source.Sessions : Array.isArray(source.sessions) ? source.sessions : []) as Array<{
    Result?: unknown[]
    results?: unknown[]
    result?: unknown[]
  }>

  let rows: unknown[] = []
  if (Array.isArray(parsed)) {
    rows = parsed
  } else if (Array.isArray(source.results)) {
    rows = source.results
  } else if (Array.isArray(source.Result)) {
    rows = source.Result
  } else if (Array.isArray(source.result)) {
    rows = source.result
  } else {
    for (const session of sessions) {
      if (Array.isArray(session.results)) {
        rows = session.results
        break
      }
      if (Array.isArray(session.Result)) {
        rows = session.Result
        break
      }
      if (Array.isArray(session.result)) {
        rows = session.result
        break
      }
    }
  }

  if (rows.length === 0) {
    const cars = Array.isArray(source.Cars) ? source.Cars : Array.isArray(source.cars) ? source.cars : []
    rows = cars.flatMap((item, index) => {
      const row = item as { Driver?: { Guid?: unknown; GuidsList?: unknown[]; GuidList?: unknown[] }; DriverGuid?: unknown }
      const guids = Array.from(
        new Set(
          [
            String(row.DriverGuid || row.Driver?.Guid || '').trim(),
            ...((Array.isArray(row.Driver?.GuidsList) ? row.Driver?.GuidsList : Array.isArray(row.Driver?.GuidList) ? row.Driver?.GuidList : [])
              .map((value) => String(value || '').trim())),
          ].filter(Boolean),
        ),
      )
      if (guids.length === 0) return []
      return guids.map((guid) => ({
        DriverGuid: guid,
        position: index + 1,
      }))
    })
  }

  if (rows.length === 0) {
    rows = pickBestArrayFromTree(parsed)
  }

  const results: ImportedResultRow[] = rows
    .map((item, index) => toImportedRow(item, index))
    .filter((row): row is ImportedResultRow => Boolean(row))

  return { eventId, results }
}

export async function importRaceResultsJson(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const { session } = await guardLeaguePermission(leagueId, 'steward')

  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')
  if (!leagueId) redirect('/admin?resultsError=missing-league')

  const uploadedRaw = formData.get('resultsFile')
  const uploaded =
    uploadedRaw &&
    typeof uploadedRaw === 'object' &&
    'size' in uploadedRaw &&
    'text' in uploadedRaw &&
    typeof (uploadedRaw as { size?: unknown }).size === 'number'
      ? (uploadedRaw as File)
      : null
  const rawFromTextField = String(formData.get('resultsJsonText') || '').trim()
  const selectedEventId = String(formData.get('eventId') || '').trim()
  const replaceExisting = formData.get('replaceExisting') === 'on'

  if ((!uploaded || uploaded.size === 0) && !rawFromTextField) {
    redirect(`/admin/ligas/${leagueId}?resultsError=file-required`)
  }

  let rawJson = ''
  let parsed: { eventId?: string; results: ImportedResultRow[] }
  try {
    rawJson = rawFromTextField || (uploaded ? await uploaded.text() : '')
    parsed = parseResultsJson(rawJson)
  } catch {
    redirect(`/admin/ligas/${leagueId}?resultsError=invalid-json`)
  }

  const eventId = selectedEventId || parsed.eventId || ''
  if (!eventId) {
    redirect(`/admin/ligas/${leagueId}?resultsError=event-required`)
  }

  try {
    const eventDoc = await db.collection('league_events').doc(eventId).get()
    if (!eventDoc.exists || eventDoc.data()?.league_id !== leagueId) {
      redirect(`/admin/ligas/${leagueId}?resultsError=event-not-found`)
    }

    if (parsed.results.length === 0) {
      redirect(`/admin/ligas/${leagueId}?resultsError=no-valid-rows`)
    }

    const steamIds = Array.from(new Set(parsed.results.map((row) => row.steamId).filter(Boolean))) as string[]
    const steamToUserId = new Map<string, string>()
    const userIdCandidates = Array.from(new Set(parsed.results.map((row) => row.userId).filter(Boolean))) as string[]
    const knownUserIds = new Set<string>()

    if (steamIds.length > 0) {
      // Chunk query steam_accounts
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
    if (resolved.length === 0) {
      await db.collection('league_result_imports').add({
        league_id: leagueId,
        event_id: eventId,
        uploaded_by_user_id: session.userId,
        file_name: (uploaded && uploaded.name) || 'results.json',
        payload_text: rawJson,
        rows_total: parsed.results.length,
        rows_imported: 0,
        rows_unresolved: unresolvedCount,
        rows_not_registered: 0,
        created_at: new Date(),
      })
      await db.collection('league_events').doc(eventId).update({ status: 'completed' })

      revalidatePath(`/admin/ligas/${leagueId}`)
      revalidatePath('/admin')
      revalidatePath('/ligas')
      revalidatePath('/equipos')
      const unresolvedFlag = unresolvedCount > 0 ? `&resultsUnresolved=${unresolvedCount}` : ''
      redirect(`/admin/ligas/${leagueId}?resultsImported=0${unresolvedFlag}`)
    }

    const resolvedUserIds = Array.from(new Set(resolved.map((row) => row.userId as string)))
    
    // Chunk query registrations
    const rChunks = []
    for (let i = 0; i < resolvedUserIds.length; i += 10) {
      rChunks.push(resolvedUserIds.slice(i, i + 10))
    }
    const regSnaps = await Promise.all(rChunks.map(c => 
      db.collection('league_registrations')
        .where('league_id', '==', leagueId)
        .where('user_id', 'in', c)
        .get()
    ))
    const registeredUserIds = new Set(regSnaps.flatMap(s => s.docs).map((doc: any) => doc.data().user_id))

    const filtered = resolved.filter((row) => registeredUserIds.has(String(row.userId)))
    const notRegisteredCount = resolved.length - filtered.length
    if (filtered.length === 0) {
      await db.collection('league_result_imports').add({
        league_id: leagueId,
        event_id: eventId,
        uploaded_by_user_id: session.userId,
        file_name: (uploaded && uploaded.name) || 'results.json',
        payload_text: rawJson,
        rows_total: parsed.results.length,
        rows_imported: 0,
        rows_unresolved: unresolvedCount,
        rows_not_registered: notRegisteredCount,
        created_at: new Date(),
      })
      await db.collection('league_events').doc(eventId).update({ status: 'completed' })

      revalidatePath(`/admin/ligas/${leagueId}`)
      revalidatePath('/admin')
      revalidatePath('/ligas')
      revalidatePath('/equipos')
      const unresolvedFlag = unresolvedCount > 0 ? `&resultsUnresolved=${unresolvedCount}` : ''
      const notRegisteredFlag = notRegisteredCount > 0 ? `&resultsNotRegistered=${notRegisteredCount}` : ''
      redirect(`/admin/ligas/${leagueId}?resultsImported=0${unresolvedFlag}${notRegisteredFlag}`)
    }

    if (replaceExisting) {
      const existingResultsSnap = await db
        .collection('league_results')
        .where('league_id', '==', leagueId)
        .where('event_id', '==', eventId)
        .get()
      const delBatch = db.batch()
      existingResultsSnap.docs.forEach((doc: any) => delBatch.delete(doc.ref))
      await delBatch.commit()
    }

    const payload = filtered.map((row) => ({
      league_id: leagueId,
      event_id: eventId,
      user_id: row.userId as string,
      position: row.position,
      points: row.points,
      created_at: new Date(),
    }))

    const insertBatch = db.batch()
    payload.forEach((row) => {
      const docRef = db.collection('league_results').doc()
      insertBatch.set(docRef, row)
    })
    await insertBatch.commit()

    await db.collection('league_events').doc(eventId).update({ status: 'completed' })

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
    redirect(`/admin/ligas/${leagueId}?resultsImported=${filtered.length}${unresolvedFlag}${notRegisteredFlag}`)
  } catch (error) {
    console.error('Failed to import race results in Firestore:', error)
    redirect(`/admin/ligas/${leagueId}?resultsError=insert-failed`)
  }
}