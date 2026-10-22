import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { extractSteamId64, formatTrackName, getCarStats, getClassTagFromModel, type LiveDriver } from '@/lib/live-timing'

/**
 * Vueltas mínimas + corte del 105% de la mejor vuelta real, calculado al vuelo sobre el leaderboard
 * en vivo de Assetto Corsa — igual que lib/licenses.ts (107% de corte para licencias), pero sumando
 * los varios servidores de un campeonato en vez de uno solo, y para todos los pilotos a la vez.
 *
 * Sin tabla ni proceso en segundo plano: TotalNumLaps/BestLap son contadores de la sesión del
 * propio servidor de AC, que se resetean solos al cambiar de circuito (reinicio = sesión nueva).
 */
const LIVE_SOURCES: Record<string, string> = {
  erc: process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || '',
  'erc-next-gen': process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL_ERC_NEXT_GEN || '',
}

// Mismos campeonatos/servidores que CHAMPIONSHIPS en app/live-timing/page.tsx.
export const LINEUP_CUTOFF_SERVERS: Record<string, number[]> = {
  erc: [0, 1, 2],
  'erc-next-gen': [0, 1, 2],
}

export type LineupCutoffEntry = {
  lapsCompleted: number
  bestLapNs: number | null
  classTag: string | null
  referenceLapNs: number | null
  meetsLaps: boolean
  meetsCutoff: boolean
  qualifies: boolean
}

export type LineupCutoffSnapshot = {
  live: boolean
  track: string | null
  bySteamId: Map<string, LineupCutoffEntry>
}

const EMPTY_SNAPSHOT: LineupCutoffSnapshot = { live: false, track: null, bySteamId: new Map() }

async function fetchServerBoard(sourceUrl: string, server: number): Promise<{ data: any; track: string | null } | null> {
  try {
    const url = new URL(sourceUrl)
    url.searchParams.set('server', String(server))
    url.searchParams.set('_t', String(Date.now()))
    const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const data = await res.json()
    return { data, track: data?.Track ? formatTrackName(data.Track) : null }
  } catch {
    return null
  }
}

async function buildSnapshot(source: string, servers: number[], minLaps: number, cutoffPercent: number): Promise<LineupCutoffSnapshot> {
  const sourceUrl = LIVE_SOURCES[source]
  if (!sourceUrl) return EMPTY_SNAPSHOT

  const boards = (await Promise.all(servers.map((server) => fetchServerBoard(sourceUrl, server)))).filter(
    (b): b is { data: any; track: string | null } => b != null
  )
  if (boards.length === 0) return EMPTY_SNAPSHOT

  const allDrivers: LiveDriver[] = boards.flatMap((b) => [...(b.data.ConnectedDrivers || []), ...(b.data.DisconnectedDrivers || [])])
  const track = boards.find((b) => b.track)?.track ?? null

  // Mejor vuelta de CUALQUIER piloto en cada clase, en la sesión actual: referencia del corte.
  const referenceByClass = new Map<string, number>()
  for (const driver of allDrivers) {
    const bestLap = getCarStats(driver).BestLap
    if (!bestLap) continue
    const cls = getClassTagFromModel(driver.CarInfo?.CarModel)
    const current = referenceByClass.get(cls)
    if (!current || bestLap < current) referenceByClass.set(cls, bestLap)
  }

  // Por SteamID: vueltas sumadas (coches y servidores distintos se suman) + mejor vuelta propia.
  const lapsBySteamId = new Map<string, number>()
  const bestLapBySteamId = new Map<string, { ns: number; classTag: string }>()
  for (const driver of allDrivers) {
    const steamId = extractSteamId64(driver.CarInfo?.DriverGUID)
    if (!steamId) continue

    lapsBySteamId.set(steamId, (lapsBySteamId.get(steamId) || 0) + (driver.TotalNumLaps || 0))

    const bestLap = getCarStats(driver).BestLap
    if (!bestLap) continue
    const cls = getClassTagFromModel(driver.CarInfo?.CarModel)
    const current = bestLapBySteamId.get(steamId)
    if (!current || bestLap < current.ns) bestLapBySteamId.set(steamId, { ns: bestLap, classTag: cls })
  }

  const bySteamId = new Map<string, LineupCutoffEntry>()
  for (const steamId of lapsBySteamId.keys()) {
    const lapsCompleted = lapsBySteamId.get(steamId) || 0
    const best = bestLapBySteamId.get(steamId) || null
    const referenceLapNs = best ? referenceByClass.get(best.classTag) ?? null : null
    const meetsLaps = lapsCompleted >= minLaps
    const meetsCutoff = best != null && referenceLapNs != null && best.ns <= referenceLapNs * (cutoffPercent / 100)
    bySteamId.set(steamId, {
      lapsCompleted,
      bestLapNs: best?.ns ?? null,
      classTag: best?.classTag ?? null,
      referenceLapNs,
      meetsLaps,
      meetsCutoff,
      qualifies: meetsLaps && meetsCutoff,
    })
  }

  return { live: true, track, bySteamId }
}

export async function getLeagueCutoffSnapshot(
  source: string,
  servers: number[],
  minLaps: number,
  cutoffPercent: number
): Promise<LineupCutoffSnapshot> {
  // minLaps/cutoffPercent entran en la clave: dos ligas pueden compartir el mismo `source` con
  // umbrales distintos, y meetsLaps/meetsCutoff ya vienen calculados dentro del snapshot cacheado.
  return fetchWithTTLCache(`lineup_cutoff_${source}_${minLaps}_${cutoffPercent}`, () => buildSnapshot(source, servers, minLaps, cutoffPercent), 8)
}
