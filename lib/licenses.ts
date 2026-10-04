import { db } from '@/lib/db'
import { getCarStats, getClassTagFromModel, type LiveDriver } from '@/lib/live-timing'

/**
 * Licencias por categoría: se consiguen en el servidor dedicado de licencias (servidor 3 de la
 * fuente "erc" en live timing — "04 | RSX | LICENSE SERVER"), no en los servidores de carrera.
 * La categoría la decide el propio coche que elija el piloto al entrar; el servidor de carrera no
 * lo pregunta aparte.
 *
 * Para conseguirla hacen falta las DOS condiciones:
 *  - Una vuelta dentro del 107% del mejor tiempo de esa categoría en la sesión actual del servidor.
 *  - Un mínimo de horas jugadas en Assetto Corsa en Steam (requiere STEAM_WEB_API_KEY configurada
 *    y que el piloto tenga su perfil/detalles de juego en Steam como públicos; si no se puede saber
 *    cuántas horas tiene, no se concede la licencia).
 */
const LICENSE_SOURCE_URL = process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || ''
const LICENSE_SERVER = '3'
const MAX_PERCENT_OVER_BEST = 1.07
const MIN_ASSETTO_CORSA_HOURS = 100
const ASSETTO_CORSA_APP_ID = 244210

export type LicenseResult = {
  classTag: string
  bestLapNs: number
  referenceLapNs: number
  withinPercent: boolean
  granted: boolean
}

export type LicenseCheckSummary =
  | { ok: false; error: 'license-server-unreachable' | 'steam-id-missing' }
  | { ok: true; steamHours: number | null; hoursOk: boolean; results: LicenseResult[]; grantedClasses: string[] }

type LicenseLeaderboard = { ConnectedDrivers?: LiveDriver[]; DisconnectedDrivers?: LiveDriver[] }

async function fetchLicenseServerBoard(): Promise<LicenseLeaderboard | null> {
  if (!LICENSE_SOURCE_URL) return null
  try {
    const url = new URL(LICENSE_SOURCE_URL)
    url.searchParams.set('server', LICENSE_SERVER)
    url.searchParams.set('_t', String(Date.now()))
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    return (await res.json()) as LicenseLeaderboard
  } catch {
    return null
  }
}

/** Horas jugadas en Assetto Corsa: null si no se puede saber (sin clave configurada, o perfil/detalles de juego privados en Steam). */
async function getAssettoCorsaHours(steamId: string): Promise<number | null> {
  const key = process.env.STEAM_WEB_API_KEY
  if (!key || !steamId) return null
  try {
    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/')
    url.searchParams.set('key', key)
    url.searchParams.set('steamid', steamId)
    url.searchParams.set('include_played_free_games', '1')
    url.searchParams.set('appids_filter[0]', String(ASSETTO_CORSA_APP_ID))
    url.searchParams.set('format', 'json')
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const json = await res.json()
    const games = json?.response?.games as Array<{ appid: number; playtime_forever: number }> | undefined
    if (!Array.isArray(games)) return null // perfil o detalles de juego privados: Steam no devuelve la lista
    const game = games.find((g) => g.appid === ASSETTO_CORSA_APP_ID)
    return Math.floor((game?.playtime_forever || 0) / 60)
  } catch {
    return null
  }
}

/** El GUID del leaderboard puede traer solo el SteamID64 o venir mezclado con más texto. */
function extractSteamId64(guid: string | undefined): string | null {
  return String(guid || '').match(/\d{17}/)?.[0] ?? null
}

export async function runLicenseCheck(userId: string, steamId: string): Promise<LicenseCheckSummary> {
  if (!steamId) return { ok: false, error: 'steam-id-missing' }

  const board = await fetchLicenseServerBoard()
  if (!board) return { ok: false, error: 'license-server-unreachable' }

  const allDrivers = [...(board.ConnectedDrivers || []), ...(board.DisconnectedDrivers || [])]

  // Mejor vuelta de CUALQUIER piloto en cada categoría, en la sesión actual: es la referencia del 107%.
  const referenceByClass = new Map<string, number>()
  for (const driver of allDrivers) {
    const bestLap = getCarStats(driver).BestLap
    if (!bestLap) continue
    const cls = getClassTagFromModel(driver.CarInfo?.CarModel)
    const current = referenceByClass.get(cls)
    if (!current || bestLap < current) referenceByClass.set(cls, bestLap)
  }

  // Mis mejores vueltas, por categoría (puede haber probado varios coches/categorías en la sesión).
  const myBestByClass = new Map<string, number>()
  for (const driver of allDrivers) {
    if (extractSteamId64(driver.CarInfo?.DriverGUID) !== steamId) continue
    const bestLap = getCarStats(driver).BestLap
    if (!bestLap) continue
    const cls = getClassTagFromModel(driver.CarInfo?.CarModel)
    const current = myBestByClass.get(cls)
    if (!current || bestLap < current) myBestByClass.set(cls, bestLap)
  }

  const steamHours = await getAssettoCorsaHours(steamId)
  const hoursOk = steamHours != null && steamHours >= MIN_ASSETTO_CORSA_HOURS

  const results: LicenseResult[] = []
  const grantedClasses: string[] = []

  for (const [classTag, bestLapNs] of myBestByClass) {
    const referenceLapNs = referenceByClass.get(classTag)
    if (!referenceLapNs) continue
    const withinPercent = bestLapNs <= referenceLapNs * MAX_PERCENT_OVER_BEST
    const granted = withinPercent && hoursOk
    results.push({ classTag, bestLapNs, referenceLapNs, withinPercent, granted })
    if (granted) {
      grantedClasses.push(classTag)
      await db.driverLicense.upsert({
        where: { userId_classTag: { userId, classTag } },
        create: { userId, classTag, bestLapNs, referenceLapNs, steamHours: steamHours ?? 0 },
        update: { bestLapNs, referenceLapNs, steamHours: steamHours ?? 0 },
      })
    }
  }

  return { ok: true, steamHours, hoursOk, results, grantedClasses }
}
