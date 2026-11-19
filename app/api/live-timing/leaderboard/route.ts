import { NextResponse } from 'next/server'

// ERC and ERC Next Gen run on two entirely separate physical servers/domains, each with
// its own server=0/1/2 — they're not one shared pool split by index range.
const SOURCE_URLS: Record<string, string> = {
  erc: process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || '',
  'erc-next-gen': process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL_ERC_NEXT_GEN || '',
}

// This endpoint is public and polled by every open live-timing tab. Without a cache each request
// became one request to the game server, so N viewers = N upstream calls per poll. Share one
// upstream fetch per (source, server) for a few seconds, and coalesce concurrent requests.
//
// 4 s en vez de los 2 s originales: el cliente solo pide esto cada 6 s, así que 2 s nunca llegaba a
// amortiguar nada (siempre caía en caché caducada y pagaba el viaje completo al servidor de
// Assetto Corsa). Con 4 s, el caso que sí importa — varios espectadores del mismo servidor
// abriendo/actualizando la página en momentos ligeramente distintos — comparte más peticiones.
const CACHE_MS = 4_000
type Entry = { at: number; data?: unknown; pending?: Promise<unknown> }
const cache = new Map<string, Entry>()

// El timeout del propio fetch no basta: en producción hay peticiones al servidor de origen que no
// llegan a cancelarse, y esa promesa colgada queda compartida en la caché (ver abajo), así que todas
// las siguientes para ese servidor se quedan esperando con ella. Este límite corta siempre.
const UPSTREAM_DEADLINE_MS = 9_000

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Live timing upstream deadline exceeded')), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

async function fetchUpstream(sourceUrl: string, server: string) {
  const url = new URL(sourceUrl)
  url.searchParams.set('server', server)
  url.searchParams.set('_t', String(Date.now()))
  const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw Object.assign(new Error(`Upstream error ${res.status}`), { upstreamStatus: res.status })
  return res.json()
}

// El servidor de Assetto Corsa lleva TotalNumLaps en memoria del propio proceso: si se cae o se
// reinicia a mitad de carrera (sin cambiar de sesión), ese contador vuelve a 0 para todo el mundo
// aunque la carrera siga. Aquí se recuerda, por piloto, cuántas vueltas ya llevaba antes de ese
// reinicio, para poder seguir sumando en vez de volver a empezar desde 0. Vive en memoria del
// propio proceso de Next.js (igual que la caché de arriba) — sobrevive a reinicios del servidor de
// carrera, que es el caso que falla; no hace falta base de datos para esto.
type LapState = { lastRaw: number; offset: number }
type SessionLapTracker = { drivers: Map<string, LapState>; lastSessionTime: number | null }
const lapTrackers = new Map<string, SessionLapTracker>()

function driverKey(d: any): string {
  return d?.CarInfo?.DriverGUID || `${d?.CarInfo?.RaceNumber || ''}-${d?.CarInfo?.DriverName || ''}`
}

function reconcileLaps(key: string, data: any) {
  if (!data || typeof data !== 'object') return
  const drivers: any[] = [...(data.ConnectedDrivers || []), ...(data.DisconnectedDrivers || [])]
  if (drivers.length === 0) return

  let tracker = lapTrackers.get(key)
  if (!tracker) {
    tracker = { drivers: new Map(), lastSessionTime: null }
    lapTrackers.set(key, tracker)
  }

  // `Time` (duración configurada de la sesión en minutos) solo cambia cuando el propio servidor
  // pasa a otra sesión (de qualy a carrera, p. ej.) — a diferencia de un reinicio del proceso tras
  // una caída, que retoma la MISMA sesión. Es la señal disponible para distinguir "sesión nueva,
  // las vueltas deben volver a 0" de "mismo proceso caído y recuperado, hay que seguir sumando".
  const currentSessionTime = typeof data.Time === 'number' ? data.Time : null
  if (tracker.lastSessionTime !== null && currentSessionTime !== tracker.lastSessionTime) {
    tracker.drivers.clear()
  }
  tracker.lastSessionTime = currentSessionTime

  for (const d of drivers) {
    const raw = Number(d.TotalNumLaps) || 0
    const kDriver = driverKey(d)
    let state = tracker.drivers.get(kDriver)
    if (!state) {
      state = { lastRaw: raw, offset: 0 }
      tracker.drivers.set(kDriver, state)
    } else if (raw < state.lastRaw) {
      // El contador bajó dentro de la misma sesión: el servidor de carrera se reinició. Lo ya
      // corrido antes de eso se guarda como offset para no perderlo.
      state.offset += state.lastRaw
      state.lastRaw = raw
    } else {
      state.lastRaw = raw
    }
    d.TotalNumLaps = state.offset + raw
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const server = searchParams.get('server') || '0'
  const source = searchParams.get('source') || 'erc'

  // server is only ever a small index; never forward arbitrary text to the upstream.
  if (!/^\d$/.test(server)) {
    return NextResponse.json({ error: 'Invalid server' }, { status: 400 })
  }

  const sourceUrl = SOURCE_URLS[source]
  if (!sourceUrl) {
    return NextResponse.json({ error: 'Live timing source not configured' }, { status: 500 })
  }

  const key = `${source}:${server}`
  const now = Date.now()
  const hit = cache.get(key)

  try {
    let data: unknown
    if (hit && hit.data !== undefined && now - hit.at < CACHE_MS) {
      data = hit.data
    } else if (hit?.pending) {
      data = await hit.pending
    } else {
      const pending = withDeadline(fetchUpstream(sourceUrl, server), UPSTREAM_DEADLINE_MS)
      cache.set(key, { at: now, pending })
      try {
        data = await pending
        reconcileLaps(key, data)
        cache.set(key, { at: Date.now(), data })
      } catch (err) {
        // Never keep serving old positions when the game server is down: drop the entry.
        cache.delete(key)
        throw err
      }
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const upstreamStatus = (err as { upstreamStatus?: number }).upstreamStatus
    if (upstreamStatus) {
      return NextResponse.json({ error: `Upstream error ${upstreamStatus}` }, { status: 502 })
    }
    console.error('Failed to fetch live timing leaderboard:', err)
    return NextResponse.json({ error: 'Failed to reach live timing source' }, { status: 502 })
  }
}
