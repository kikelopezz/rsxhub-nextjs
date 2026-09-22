/**
 * API interna de competicion de RSXHub, pensada para servicios internos de RSX (el bot
 * "RSX Competition" de Discord y, mas adelante, Race Control, Verify, Stats, Live...).
 *
 * - Es SOLO LECTURA y se autentica con una clave compartida (RSX_COMPETITION_API_KEY).
 * - RSXHub sigue siendo la fuente de verdad: aqui solo se leen datos que ya existen y se
 *   normalizan (numero de ronda, "grid publicada", "resultados oficiales", URLs...).
 * - Las URLs las construye SIEMPRE este modulo, para que los consumidores nunca las hardcodeen.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { simulatorLabel } from '@/lib/utils'
import { fetchWithTTLCache } from '@/lib/ttl-cache'

export const COMPETITION_SCHEMA_VERSION = 1

/* ------------------------------------------------------------------ auth */

export function authorizeCompetitionRequest(request: Request): NextResponse | null {
  const expected = process.env.RSX_COMPETITION_API_KEY
  if (!expected) {
    return NextResponse.json({ error: 'API de competicion desactivada: falta RSX_COMPETITION_API_KEY.' }, { status: 503 })
  }
  const header = request.headers.get('authorization') || ''
  const provided = Buffer.from(header.replace(/^Bearer\s+/i, ''))
  const wanted = Buffer.from(expected)
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }
  return null
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...(init?.headers || {}) } })
}

/* ------------------------------------------------------------------ urls */

/** Base publica del Hub. Ignora valores "localhost" (config de desarrollo) y cae al origen de la peticion. */
export function publicBaseUrl(request: Request) {
  const configured = process.env.COMPETITION_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

const dayKeyUTC = (date: Date) => date.toISOString().slice(0, 10)

export function buildUrls(base: string, league: { slug: string }, event?: { startsAt: Date }) {
  const leaguePage = `${base}/ligas/${encodeURIComponent(league.slug)}`
  return {
    league: leaguePage,
    registration: leaguePage,
    standings: leaguePage,
    liveTiming: `${base}/live-timing`,
    // El Hub aun no tiene URL propia por evento: el mas cercano es el programa del calendario de ese dia.
    ...(event
      ? {
          event: `${base}/calendario?view=programme&date=${dayKeyUTC(event.startsAt)}`,
          grid: leaguePage,
          results: leaguePage,
        }
      : {}),
  }
}

/* -------------------------------------------------------------- snapshot */

const DAY_MS = 86_400_000

function absoluteImage(base: string, url: string | null) {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

export async function buildSnapshot(base: string) {
  return fetchWithTTLCache(
    `competition_snapshot_${base}`,
    async () => {
      const now = new Date()
      const from = new Date(now.getTime() - 14 * DAY_MS)
      const to = new Date(now.getTime() + 90 * DAY_MS)

      const leagues = await db.league.findMany({ where: { status: { not: 'draft' } }, orderBy: { startsAt: 'asc' } })
      const leagueIds = leagues.map((l) => l.id)
      const leagueById = new Map(leagues.map((l) => [l.id, l]))

      // Numero de ronda: posicion entre las carreras (no canceladas) del campeonato, por fecha.
      const allEvents = await db.leagueEvent.findMany({
        where: { leagueId: { in: leagueIds } },
        select: { id: true, leagueId: true, startsAt: true, eventType: true, status: true },
        orderBy: { startsAt: 'asc' },
      })
      const roundByEvent = new Map<string, number>()
      const counters = new Map<string, number>()
      for (const e of allEvents) {
        if (e.eventType !== 'race' || e.status === 'cancelled') continue
        const n = (counters.get(e.leagueId) || 0) + 1
        counters.set(e.leagueId, n)
        roundByEvent.set(e.id, n)
      }

      const events = await db.leagueEvent.findMany({
        where: {
          leagueId: { in: leagueIds },
          OR: [{ startsAt: { gte: from, lte: to } }, { completedAt: { gte: from } }],
        },
        orderBy: { startsAt: 'asc' },
      })
      const eventIds = events.map((e) => e.id)

      const [confirmations, resultCounts, circuits] = await Promise.all([
        db.leagueEventConfirmation.findMany({
          where: { eventId: { in: eventIds } },
          select: { eventId: true, drivers: { select: { userId: true } } },
        }),
        db.leagueResult.groupBy({ by: ['eventId', 'sessionType'], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
        db.circuit.findMany({ select: { id: true, name: true, imageUrl: true } }),
      ])
      const circuitById = new Map(circuits.map((c) => [c.id, c]))

      const registered = new Map<string, { cars: number; drivers: Set<string> }>()
      for (const c of confirmations) {
        const bucket = registered.get(c.eventId) || { cars: 0, drivers: new Set<string>() }
        bucket.cars += 1
        c.drivers.forEach((d) => bucket.drivers.add(d.userId))
        registered.set(c.eventId, bucket)
      }
      const rows = (eventId: string, session: 'qualifying' | 'race') =>
        resultCounts.find((r) => r.eventId === eventId && r.sessionType === session)?._count._all ?? 0

      const classLimitRows = await db.leagueClassLimit.findMany({ where: { eventId: { in: eventIds } } })
      const limitsByEvent = new Map<string, Record<string, number>>()
      for (const l of classLimitRows) {
        if (!l.eventId) continue
        limitsByEvent.set(l.eventId, { ...(limitsByEvent.get(l.eventId) || {}), [l.classTag]: l.maxCars })
      }

      return {
        schemaVersion: COMPETITION_SCHEMA_VERSION,
        generatedAt: now.toISOString(),
        leagues: leagues.map((l) => ({
          id: l.id,
          slug: l.slug,
          title: l.title,
          simulator: l.simulator,
          simulatorLabel: simulatorLabel(l.simulator),
          format: l.format,
          classTags: l.classTags,
          status: l.status,
          registrationOpen: l.registrationOpen && l.status === 'open',
          registrationMode: l.registrationMode,
          accentColor: l.accentColor,
          logoUrl: absoluteImage(base, l.logoUrl),
          startsAt: l.startsAt?.toISOString() ?? null,
          endsAt: l.endsAt?.toISOString() ?? null,
          urls: buildUrls(base, l),
        })),
        events: events.map((e) => {
          const league = leagueById.get(e.leagueId)!
          const circuit = e.circuitId ? circuitById.get(e.circuitId) : undefined
          const reg = registered.get(e.id)
          const qualyRows = rows(e.id, 'qualifying')
          const raceRows = rows(e.id, 'race')
          return {
            id: e.id,
            leagueId: e.leagueId,
            round: roundByEvent.get(e.id) ?? null,
            title: e.title || null,
            eventType: e.eventType,
            status: e.status,
            startsAt: e.startsAt.toISOString(),
            endsAt: e.endsAt.toISOString(),
            qualy: {
              enabled: e.hasQualy,
              startsAt: e.qualyStartsAt?.toISOString() ?? null,
              endsAt: e.qualyEndsAt?.toISOString() ?? null,
              completed: e.qualyCompleted,
            },
            completedAt: e.completedAt?.toISOString() ?? null,
            circuit: {
              name: circuit?.name || e.circuitName,
              countryCode: e.countryCode,
              imageUrl: absoluteImage(base, circuit?.imageUrl || e.circuitImageUrl),
            },
            registered: { cars: reg?.cars ?? 0, drivers: reg?.drivers.size ?? 0 },
            capacity: { maxDrivers: e.maxDrivers, classLimits: limitsByEvent.get(e.id) ?? null },
            // Un dato "oficial" es el que un admin ha cerrado en el Hub, no cualquier fila suelta.
            gridPublished: e.qualyCompleted && qualyRows > 0,
            resultsOfficial: e.status === 'completed' && e.completedAt !== null && raceRows > 0,
            urls: buildUrls(base, league, e),
          }
        }),
      }
    },
    15
  )
}

/* ------------------------------------------------------------ grid / results */

export async function buildGrid(eventId: string) {
  const event = await db.leagueEvent.findUnique({ where: { id: eventId } })
  if (!event) return null
  const rows = await db.leagueResult.findMany({
    where: { eventId, sessionType: 'qualifying' },
    orderBy: [{ position: 'asc' }],
  })
  return {
    schemaVersion: COMPETITION_SCHEMA_VERSION,
    eventId,
    official: event.qualyCompleted && rows.length > 0,
    entries: rows
      .filter((r) => r.position != null)
      .map((r) => ({
        position: r.position as number,
        driverName: r.driverName || 'Piloto',
        teamName: r.teamName || null,
        dorsal: r.dorsal || null,
        classTag: r.classTag || null,
        lapTime: r.lapTime || null,
      })),
  }
}

export async function buildResults(eventId: string) {
  const event = await db.leagueEvent.findUnique({ where: { id: eventId } })
  if (!event) return null
  const rows = await db.leagueResult.findMany({
    where: { eventId, sessionType: 'race' },
    orderBy: [{ position: 'asc' }],
  })
  return {
    schemaVersion: COMPETITION_SCHEMA_VERSION,
    eventId,
    official: event.status === 'completed' && event.completedAt !== null && rows.length > 0,
    completedAt: event.completedAt?.toISOString() ?? null,
    entries: rows
      .filter((r) => r.position != null)
      .map((r) => ({
        position: r.position as number,
        driverName: r.driverName || 'Piloto',
        teamName: r.teamName || null,
        dorsal: r.dorsal || null,
        classTag: r.classTag || null,
        raceTime: r.raceTime || null,
        points: r.points ?? null,
        status: r.status,
      })),
  }
}

/* ---------------------------------------------------------------- standings */

export async function buildStandings(leagueId: string) {
  const league = await db.league.findUnique({ where: { id: leagueId } })
  if (!league) return null
  const rows = await db.leagueTeamPoints.findMany({
    where: { leagueId },
    include: { team: { select: { name: true } } },
    orderBy: { points: 'desc' },
  })
  const byClass = new Map<string, typeof rows>()
  for (const r of rows) byClass.set(r.classTag, [...(byClass.get(r.classTag) || []), r])
  return {
    schemaVersion: COMPETITION_SCHEMA_VERSION,
    leagueId,
    updatedAt: rows.reduce<Date | null>((max, r) => (!max || r.updatedAt > max ? r.updatedAt : max), null)?.toISOString() ?? null,
    classes: [...byClass.entries()].map(([classTag, list]) => ({
      classTag,
      entries: list.map((r, i) => ({
        position: i + 1,
        teamName: r.team.name,
        carNumber: r.carNumber || null,
        points: r.points,
      })),
    })),
  }
}

/* --------------------------------------------------------------- live timing */

const LIVE_SOURCES: Record<string, string> = {
  erc: process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || '',
  'erc-next-gen': process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL_ERC_NEXT_GEN || '',
}

// Assetto Corsa Server Manager: 1 = practice, 2 = qualifying, 3 = race.
const SESSION_LABEL: Record<number, string> = { 0: 'booking', 1: 'practice', 2: 'qualifying', 3: 'race' }

function formatLap(ns: number) {
  const ms = Math.round(ns / 1e6)
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

/** Resumen compacto del live timing (el JSON original pesa hasta varios MB). */
export async function buildLiveSummary(source: string, server: number) {
  const url = LIVE_SOURCES[source]
  if (!url) return { error: 'source_not_configured' as const }

  return fetchWithTTLCache(
    `competition_live_${source}_${server}`,
    async () => {
      const target = new URL(url)
      target.searchParams.set('server', String(server))
      target.searchParams.set('_t', String(Date.now()))
      const res = await fetch(target.toString(), { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`upstream ${res.status}`)
      const data: any = await res.json()

      const connected: any[] = data.ConnectedDrivers || []
      const disconnected: any[] = data.DisconnectedDrivers || []
      const all = [...connected, ...disconnected]
      const nameOf = (d: any) => d?.CarInfo?.DriverName || 'Piloto'

      let best: { driver: string; number: string | null; ns: number } | null = null
      for (const d of all) {
        for (const car of Object.values<any>(d.Cars || {})) {
          if (car.BestLap > 0 && (!best || car.BestLap < best.ns)) {
            best = { driver: nameOf(d), number: d.CarInfo?.RaceNumber != null ? String(d.CarInfo.RaceNumber) : null, ns: car.BestLap }
          }
        }
      }
      const leaderRaw = connected.find((d) => d.Position === 1)
      return {
        schemaVersion: COMPETITION_SCHEMA_VERSION,
        source,
        server,
        serverName: data.ServerName || null,
        track: data.Track || null,
        session: {
          name: data.Name || null,
          type: SESSION_LABEL[data.Type as number] || 'unknown',
          elapsedMs: data.ElapsedMilliseconds ?? null,
          timeLimitMinutes: data.Time ?? null,
          lapLimit: data.Laps ?? null,
        },
        connectedCount: connected.length,
        leader: leaderRaw
          ? {
              name: nameOf(leaderRaw),
              number: leaderRaw.CarInfo?.RaceNumber != null ? String(leaderRaw.CarInfo.RaceNumber) : null,
              team: leaderRaw.CarInfo?.TeamName || null,
              laps: leaderRaw.TotalNumLaps ?? 0,
            }
          : null,
        fastestLap: best ? { driver: best.driver, number: best.number, timeMs: Math.round(best.ns / 1e6), formatted: formatLap(best.ns) } : null,
        top: connected
          .filter((d) => typeof d.Position === 'number' && d.Position > 0)
          .sort((a, b) => a.Position - b.Position)
          .slice(0, 10)
          .map((d) => ({ position: d.Position as number, name: nameOf(d), number: d.CarInfo?.RaceNumber != null ? String(d.CarInfo.RaceNumber) : null })),
      }
    },
    10
  )
}
