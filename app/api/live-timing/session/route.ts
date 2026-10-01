import { NextResponse } from 'next/server'

/**
 * Tiempo de la sesión tomado del propio servidor de carrera.
 *
 * El leaderboard.json solo trae el tiempo transcurrido con una precisión de un minuto. El estado completo (el que usa
 * la web del Server Manager) llega por el websocket /api/race-control y trae SessionStartTime, la hora exacta de
 * inicio de la sesión. Con ella se calcula el tiempo restante igual que hace el Server Manager:
 *   restante = Time * 60 s + WaitTime - (ahora - SessionStartTime)
 * El cálculo se hace aquí, con la hora del servidor de la web, para no depender del reloj del navegador de cada usuario.
 */

const SOURCE_URLS: Record<string, string> = {
  erc: process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL || '',
  'erc-next-gen': process.env.NEXT_PUBLIC_LIVE_TIMING_API_URL_ERC_NEXT_GEN || '',
}

type SessionTime = {
  phase: 'countdown' | 'running' | 'laps' | 'unknown'
  /** Milisegundos que faltan (cuenta atrás previa o fin de sesión); 0 en sesiones por vueltas */
  remainingMs: number
  elapsedMs: number
  /** Duración total de la sesión en ms (para la barra de progreso); 0 si es por vueltas */
  totalMs: number
  /** Vueltas de la sesión (solo si es por vueltas) */
  laps: number
}

// Una sola conexión al servidor por (origen, servidor) cada pocos segundos, aunque haya muchos
// espectadores — 5 s en vez de 3 s para amortiguar mejor entre varios espectadores del mismo
// servidor (el cliente ya pide esto cada 15 s, así que de todas formas nunca sirve una respuesta
// cacheada a un único espectador; lo que de verdad ahorra es abrir un websocket nuevo al servidor
// de carrera por cada visitante que entra en un instante parecido).
const CACHE_MS = 5_000
type Entry = { at: number; data?: SessionTime; pending?: Promise<SessionTime> }
const cache = new Map<string, Entry>()

function readStatus(wsUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const WS = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket
    if (!WS) return reject(new Error('WebSocket no disponible en este Node'))
    const socket = new WS(wsUrl)
    const timer = setTimeout(() => {
      try {
        socket.close()
      } catch {}
      reject(new Error('timeout'))
    }, 8_000)
    socket.onerror = () => {
      clearTimeout(timer)
      reject(new Error('websocket error'))
    }
    socket.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(event.data))
        const status = parsed?.Message
        // El primer mensaje con SessionStartTime es el estado completo de la carrera
        if (status && typeof status === 'object' && status.SessionStartTime) {
          clearTimeout(timer)
          socket.close()
          resolve(status)
        }
      } catch {
        // Mensajes que no son JSON: se ignoran
      }
    }
  })
}

async function loadSession(sourceUrl: string, server: string): Promise<SessionTime> {
  const origin = new URL(sourceUrl).origin.replace(/^http/, 'ws')
  const status = await readStatus(`${origin}/api/race-control?server=${server}`)
  const info = status.SessionInfo || {}
  const start = Date.parse(status.SessionStartTime)
  if (!Number.isFinite(start)) return { phase: 'unknown', remainingMs: 0, elapsedMs: 0, totalMs: 0, laps: 0 }

  const elapsed = Date.now() - start
  const waitMs = (Number(info.WaitTime) || 0) * 1000
  const totalMs = (Number(info.Time) || 0) * 60_000
  if (elapsed < waitMs) return { phase: 'countdown', remainingMs: waitMs - elapsed, elapsedMs: 0, totalMs, laps: 0 }
  if (totalMs > 0) return { phase: 'running', remainingMs: Math.max(0, totalMs + waitMs - elapsed), elapsedMs: Math.max(0, elapsed - waitMs), totalMs, laps: 0 }
  if (Number(info.Laps) > 0) return { phase: 'laps', remainingMs: 0, elapsedMs: Math.max(0, elapsed - waitMs), totalMs: 0, laps: Number(info.Laps) }
  return { phase: 'unknown', remainingMs: 0, elapsedMs: Math.max(0, elapsed - waitMs), totalMs: 0, laps: 0 }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const server = searchParams.get('server') || '0'
  const source = searchParams.get('source') || 'erc'
  if (!/^\d$/.test(server)) return NextResponse.json({ ok: false, error: 'Invalid server' }, { status: 400 })
  const sourceUrl = SOURCE_URLS[source]
  if (!sourceUrl) return NextResponse.json({ ok: false, error: 'Live timing source not configured' }, { status: 500 })

  const key = `${source}:${server}`
  const hit = cache.get(key)
  try {
    let data: SessionTime
    if (hit?.data && Date.now() - hit.at < CACHE_MS) {
      // El restante ya calculado se descuenta lo que ha pasado desde entonces
      const age = Date.now() - hit.at
      data = { ...hit.data, remainingMs: Math.max(0, hit.data.remainingMs - age), elapsedMs: hit.data.elapsedMs + age }
    } else if (hit?.pending) {
      data = await hit.pending
    } else {
      const pending = loadSession(sourceUrl, server)
      cache.set(key, { at: Date.now(), pending })
      try {
        data = await pending
        cache.set(key, { at: Date.now(), data })
      } catch (error) {
        cache.delete(key)
        throw error
      }
    }
    return NextResponse.json({ ok: true, session: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[live-timing/session] falló:', error)
    return NextResponse.json({ ok: false, error: 'Session time unavailable' }, { status: 502 })
  }
}
