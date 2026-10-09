'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDictionary } from '@/lib/i18n/locale-provider'
import { HelpCircle, Signal, SignalZero, ArrowUp, ArrowDown } from 'lucide-react'
import {
  CLASS_COLORS,
  fetchOfficialStints,
  formatNanos,
  formatSeconds,
  formatTrackName,
  formatStintMs,
  getCarStats,
  getClassTagFromModel,
  type CarStats,
  type LeaderboardResponse,
  type LiveDriver,
} from '@/lib/live-timing'
import type { HubEntry } from '@/app/api/live-timing/entries/route'
import { TrackMap, type MapSample } from './track-map'

type SortKey = 'Position' | 'Class' | 'Number' | 'Driver' | 'Team' | 'BestLap' | 'LastLap' | 'Laps'
type Tab = 'live' | 'results'
type ConnectionStatus = 'connecting' | 'online' | 'offline'

const CLASS_FILTERS = ['ALL', 'HYPERCAR', 'LMP2', 'GT3', 'GT4', 'TCR']
const CLASS_SHORT: Record<string, string> = { HYPERCAR: 'HYP', LMP2: 'LMP2', GT3: 'GT3', GT4: 'GT4', TCR: 'TCR' }
const classColor = (cls: string) => CLASS_COLORS[cls] || '#475569'

// The server's gap-to-leader field comes as "mm:ss.mmm" (e.g. "00:00.210"), not a plain
// "+X.XXX" seconds string — parseFloat alone stops at the ":" and silently reads every gap as
// 0, which is why the interval column used to show "+0.000" for everyone behind the leader.
function parseGapSeconds(raw: string): number | null {
  const clean = raw.replace('+', '').trim()
  if (!clean) return null
  if (clean.includes(':')) {
    const [mins, secs] = clean.split(':')
    const m = parseFloat(mins)
    const s = parseFloat(secs)
    return isNaN(m) || isNaN(s) ? null : m * 60 + s
  }
  const v = parseFloat(clean)
  return isNaN(v) ? null : v
}

function bestSplitFor(driver: LiveDriver, index: number, sessionBest: Record<number, number>) {
  const stats = getCarStats(driver)
  const curr = stats.CurrentLapSplits ? Object.values(stats.CurrentLapSplits).find((s) => s.SplitIndex === index) : undefined
  const curVal = curr?.SplitTime ?? 0
  if (!curVal || curVal <= 0) return { text: '-', tone: 'empty' as const }
  const fmt = (curVal / 1e9).toFixed(3)
  if (curVal <= (sessionBest[index] ?? Infinity)) return { text: fmt, tone: 'purple' as const }
  const best = stats.BestSplits ? Object.values(stats.BestSplits).find((s) => s.SplitIndex === index) : undefined
  const pb = best?.SplitTime ?? Infinity
  if (curVal <= pb) return { text: fmt, tone: 'green' as const }
  return { text: fmt, tone: 'yellow' as const }
}

/** Sectores de la mejor vuelta de un piloto (para la tabla de resultados, donde ya no hay vuelta en curso). */
function bestLapSplit(driver: LiveDriver, index: number, sessionBest: Record<number, number>) {
  const stats = getCarStats(driver)
  const split = stats.BestSplits ? Object.values(stats.BestSplits).find((s) => s.SplitIndex === index) : undefined
  const value = split?.SplitTime ?? 0
  if (!value || value <= 0) return { text: '-', tone: 'empty' as const }
  const text = (value / 1e9).toFixed(3)
  return { text, tone: value <= (sessionBest[index] ?? Infinity) ? ('purple' as const) : ('green' as const) }
}

const SPLIT_TONE_CLASS: Record<string, string> = {
  purple: 'text-fuchsia-400 font-bold',
  green: 'text-emerald-400 font-semibold',
  yellow: 'text-amber-300/90',
  empty: 'text-slate-700',
}

type ChampionshipId = 'erc' | 'erc-next-gen'

// ERC and ERC Next Gen are two separate physical servers/domains, each with its own
// server=0/1/2 — not one shared pool split by index range. The API route resolves
// `source` (the championship id) to the right upstream domain, so the same server
// index (e.g. 0) means something different depending on which championship it's for.
const CHAMPIONSHIPS: { id: ChampionshipId; label: string; servers: number[] }[] = [
  { id: 'erc', label: 'ERC', servers: [0, 1, 2] },
  { id: 'erc-next-gen', label: 'ERC NEXT GEN', servers: [0, 1, 2] },
]

// Server indices repeat across championships, so status entries are keyed by
// "championshipId_server" rather than just the raw index to avoid ERC's server 0
// and ERC Next Gen's server 0 overwriting each other's status.
const serverStatusKey = (championshipId: ChampionshipId, server: number) => `${championshipId}_${server}`

const ALL_SERVERS = CHAMPIONSHIPS.flatMap((c) => c.servers.map((server) => ({ championshipId: c.id, server })))

// Sin timeout, una petición que el servidor deja colgada bloquea para siempre el barrido de estados
// (los servidores siguientes nunca se llegan a consultar) o el poll principal (y con él el tablero).
const LIVE_FETCH_TIMEOUT_MS = 10_000
const liveFetch = (url: string) => fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(LIVE_FETCH_TIMEOUT_MS) })

function withFallback<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  return Promise.race([promise.catch(() => fallback), limit]).finally(() => clearTimeout(timer))
}

function isServerLive(json: LeaderboardResponse | null) {
  return Boolean(json && (json.ServerName || json.ConnectedDrivers || json.DisconnectedDrivers))
}

const carKey = (d: LiveDriver) => d.CarInfo?.DriverGUID || `${d.CarInfo?.RaceNumber || ''}-${d.CarInfo?.DriverName || ''}`

// Compuesto de neumático: círculo con la inicial y el color habitual de retransmisión.
function tyreStyle(raw?: string) {
  const r = (raw || '').trim().toUpperCase()
  if (!r) return null
  if (r.includes('WET') || r === 'W') return { letter: 'W', color: '#38bdf8' }
  if (r.includes('INT')) return { letter: 'I', color: '#22c55e' }
  if (r.includes('SOFT') || r === 'S' || r === 'SM' || r === 'SS') return { letter: 'S', color: '#ef4444' }
  if (r.includes('MED') || r === 'M') return { letter: 'M', color: '#facc15' }
  if (r.includes('HARD') || r === 'H') return { letter: 'H', color: '#e2e8f0' }
  return { letter: r.slice(0, 1), color: '#94a3b8' }
}

/** Placa con el número de coche, con el color de su categoría (como en las retransmisiones del WEC). */
function NumberPlate({ number, cls }: { number?: string; cls: string }) {
  return (
    <span
      className="inline-flex h-6 min-w-[42px] items-center justify-center px-1.5 font-display-league text-[16px] leading-none tracking-wide text-white"
      style={{ background: classColor(cls) }}
    >
      {number || '–'}
    </span>
  )
}

function Th({
  children,
  sortKey,
  onSort,
  sort,
  className = '',
}: {
  children?: React.ReactNode
  sortKey?: SortKey
  onSort?: (key: SortKey) => void
  /** Estado de orden actual de la tabla — solo hace falta si esta columna es `sortKey`. */
  sort?: { key: SortKey; dir: 'asc' | 'desc' }
  className?: string
}) {
  // Antes el <th> entero era el objetivo de un onClick suelto: sin onKeyDown ni foco, no se podía
  // ordenar la tabla con teclado ni un lector de pantalla sabía que era ordenable. Ahora el control
  // de verdad es un <button> (foco y teclado gratis) y aria-sort en el <th> dice el estado real.
  if (!sortKey || !onSort) {
    return <th className={`border-b border-[#1f242c] px-2 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6b7280] ${className}`}>{children}</th>
  }
  const active = sort?.key === sortKey
  return (
    <th
      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`border-b border-[#1f242c] p-0 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6b7280] ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`w-full cursor-pointer select-none px-2 py-3 text-inherit hover:text-white ${className.includes('text-right') ? 'text-right' : className.includes('text-center') ? 'text-center' : 'text-left'}`}
      >
        {children}
        {active ? <span aria-hidden="true">{sort!.dir === 'asc' ? ' ▲' : ' ▼'}</span> : null}
      </button>
    </th>
  )
}

function HeaderStat({ label, value, tone = 'text-white' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="px-5 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{label}</p>
      <p className={`font-mono-data mt-1 text-2xl font-bold leading-none tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

type SessionTime = {
  phase: 'countdown' | 'running' | 'laps' | 'unknown'
  remainingMs: number
  elapsedMs: number
  totalMs: number
  laps: number
}

/**
 * Tiempo de la sesión. Sale del servidor de carrera (hora de inicio exacta de la sesión, como hace la web del
 * Server Manager): el servidor de la web calcula lo que falta y aquí solo corre el reloj entre consultas, cada segundo.
 * Si no se puede consultar, se usa el tiempo transcurrido del leaderboard, que solo se actualiza cada minuto.
 */
function SessionClock({
  source,
  server,
  fallbackTotalSeconds,
  fallbackElapsedMs,
  leaderLaps,
  labels,
}: {
  source: string
  server: number
  fallbackTotalSeconds: number
  fallbackElapsedMs: number | null
  leaderLaps: number
  labels: { remaining: string; countdown: string; over: string; lapsRemaining: string }
}) {
  const [info, setInfo] = useState<{ data: SessionTime; at: number } | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    setInfo(null)
    let alive = true
    const load = async () => {
      try {
        const res = await liveFetch(`/api/live-timing/session?source=${source}&server=${server}`)
        if (!res.ok) return
        const json = await res.json()
        if (alive && json?.ok) setInfo({ data: json.session as SessionTime, at: Date.now() })
      } catch {
        // Sin dato del servidor se usa el respaldo
      }
    }
    load()
    const id = setInterval(load, 15_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [source, server])

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  let seconds = 0
  let progress = 0
  let label = labels.remaining
  let lapsLeft: number | null = null

  if (info) {
    const passed = Date.now() - info.at
    const { data } = info
    if (data.phase === 'countdown') {
      seconds = Math.max(0, (data.remainingMs - passed) / 1000)
      label = labels.countdown
    } else if (data.phase === 'running') {
      const remainingMs = Math.max(0, data.remainingMs - passed)
      seconds = remainingMs / 1000
      progress = data.totalMs > 0 ? Math.min(100, ((data.totalMs - remainingMs) / data.totalMs) * 100) : 0
      if (remainingMs <= 0) label = labels.over
    } else if (data.phase === 'laps') {
      lapsLeft = Math.max(0, data.laps - leaderLaps)
      progress = data.laps > 0 ? Math.min(100, (leaderLaps / data.laps) * 100) : 0
      label = labels.lapsRemaining
    }
  } else if (fallbackTotalSeconds > 0 && fallbackElapsedMs != null) {
    seconds = Math.max(0, fallbackTotalSeconds - fallbackElapsedMs / 1000)
    progress = Math.min(100, (fallbackElapsedMs / 1000 / fallbackTotalSeconds) * 100)
  }

  return (
    <div className="px-5 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{label}</p>
      <p className="font-mono-data mt-1 text-3xl font-bold leading-none tabular-nums text-white">{lapsLeft != null ? lapsLeft : formatSeconds(seconds)}</p>
      <div className="mt-2 h-[3px] w-full overflow-hidden bg-[#1f242c]">
        <div className="h-full bg-[#e10600] transition-[width] duration-1000" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

// Reloj de pared en su propio componente: así su tick de cada segundo no vuelve a pintar la tabla.
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
}

const LEGEND_COLUMNS =['pos', 'cls', 'classPos', 'number', 'name', 'team', 'tyre', 'gap', 'interval', 'last', 'best', 'laps', 'pits', 'stint', 'state'] as const

type LT = ReturnType<typeof useDictionary>['liveTiming']

function LiveRow({
  selected,
  onSelect,
  d,
  car,
  cls,
  classPos,
  interval,
  stats,
  stintMs,
  isClassBest,
  isOverallBest,
  moveDelta,
  splits,
  labels,
}: {
  selected: boolean
  onSelect: () => void
  d: LiveDriver
  car: { team: string; number: string | null; driver: string }
  cls: string
  classPos: number | undefined
  interval: string
  stats: CarStats
  stintMs: number
  isClassBest: boolean
  isOverallBest: boolean
  moveDelta: number | null
  splits: { text: string; tone: string }[]
  labels: LT
}) {
  const info = d.CarInfo || {}
  const color = classColor(cls)
  const tyre = tyreStyle(info.Tyres)
  const longPits = d.NumLongPits || 0
  const totalPits = d.NumPits || 0
  const normalPits = Math.max(0, totalPits - longPits)
  const lastIsPersonalBest = Boolean(stats.LastLap && stats.BestLap && stats.LastLap <= stats.BestLap)
  const lastTone = lastIsPersonalBest ? (isClassBest ? 'text-[#d946ef]' : 'text-[#22c55e]') : 'text-[#c9ced6]'

  return (
    <tr
      onClick={onSelect}
      className={`group cursor-pointer border-t border-[#1b2029] transition-colors hover:bg-white/[0.04] ${selected ? 'bg-white/[0.08]' : d.IsInPits ? 'bg-[#f59e0b]/[0.06]' : ''}`}
      style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
    >
      <td className="py-2.5 pl-4 pr-2">
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-7 text-right font-display-league text-xl leading-none text-white">{d.Position}</span>
          <span className="flex w-3 justify-center">
            {moveDelta != null && moveDelta > 0 && <ArrowUp className="h-3 w-3 text-[#22c55e]" />}
            {moveDelta != null && moveDelta < 0 && <ArrowDown className="h-3 w-3 text-[#e10600]" />}
          </span>
        </div>
      </td>
      <td className="px-2 py-2.5 text-center">
        <NumberPlate number={car.number ?? undefined} cls={cls} />
      </td>
      <td className="px-2 py-2.5 text-center">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[9px] font-black tracking-wider" style={{ color }}>
            {CLASS_SHORT[cls] || cls}
          </span>
          <span className="inline-flex h-5 min-w-[22px] items-center justify-center px-1 text-[11px] font-black text-white" style={{ background: color }}>
            {classPos ?? '-'}
          </span>
        </span>
      </td>
      <td className="px-2 py-2.5">
        <div className="max-w-[220px] truncate text-[13px] font-semibold leading-tight text-white">{car.driver}</div>
        <div className="max-w-[220px] truncate text-[10px] uppercase leading-tight text-[#6b7280]">{info.CarName || info.CarModel || '-'}</div>
      </td>
      <td className="max-w-[200px] truncate px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#c9ced6]">{car.team}</td>
      <td className="px-2 py-2.5 text-center">
        {tyre ? (
          <span title={info.Tyres} className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-black text-white" style={{ borderColor: tyre.color }}>
            {tyre.letter}
          </span>
        ) : (
          <span className="text-[#374151]">-</span>
        )}
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums text-[#9ca3af]">{d.Position === 1 ? '-' : d.Split || '-'}</td>
      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-[#38bdf8]">{interval}</td>
      <td className={`px-2 py-2.5 text-right tabular-nums ${lastTone}`}>{formatNanos(stats.LastLap)}</td>
      <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${isOverallBest ? 'text-[#d946ef]' : isClassBest ? 'text-[#f0abfc]' : 'text-white'}`} title={isClassBest ? labels.legend.sessionBest : undefined}>
        {formatNanos(stats.BestLap)}
      </td>
      {splits.map((s, i) => (
        <td key={i} className={`px-1 py-2.5 text-center tabular-nums ${SPLIT_TONE_CLASS[s.tone]}`}>
          {s.text}
        </td>
      ))}
      <td className="px-2 py-2.5 text-center font-bold tabular-nums text-white">{d.TotalNumLaps || 0}</td>
      <td className="px-2 py-2.5 text-center tabular-nums text-[#c9ced6]" title={`${normalPits} ${labels.col.normalPits} · ${longPits} ${labels.col.longPits}${d.LastPitStop ? ` · ${labels.col.lastPit}: ${d.LastPitStop}` : ''}`}>
        {totalPits}
      </td>
      <td className="px-2 py-2.5 text-center font-bold tabular-nums text-[#f59e0b]">{formatStintMs(stintMs)}</td>
      <td className="px-2 py-2.5 text-center">
        {d.IsInPits ? (
          <span className="animate-pulse bg-[#f59e0b] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">{labels.pit}</span>
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#22c55e]">{labels.onTrack}</span>
        )}
      </td>
    </tr>
  )
}

function ResultRow({
  d,
  idx,
  car,
  cls,
  stats,
  stintMs,
  sectors,
  seen,
  
}: {
  d: LiveDriver
  idx: number
  car: { team: string; number: string | null; driver: string }
  cls: string
  stats: CarStats
  stintMs: number
  sectors: { text: string; tone: string }[]
  seen: string
}) {
  const info = d.CarInfo || {}
  const color = classColor(cls)
  const longPits = d.NumLongPits || 0
  const normalPits = Math.max(0, (d.NumPits || 0) - longPits)
  return (
    <tr className="border-t border-[#1b2029] transition-colors hover:bg-white/[0.04]" style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}>
      <td className="py-2.5 pl-4 pr-2 text-center font-display-league text-lg text-[#6b7280]">{idx + 1}</td>
      <td className="px-2 py-2.5 text-center">
        <NumberPlate number={car.number ?? undefined} cls={cls} />
      </td>
      <td className="px-2 py-2.5 text-center text-[9px] font-black tracking-wider" style={{ color }}>
        {CLASS_SHORT[cls] || cls}
      </td>
      <td className="px-2 py-2.5">
        <div className="text-[13px] font-semibold leading-tight text-white">{car.driver}</div>
        <div className="text-[10px] uppercase leading-tight text-[#6b7280]">{info.CarModel || '-'}</div>
      </td>
      <td className="px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#c9ced6]">{car.team}</td>
      <td className="px-2 py-2.5 text-right font-bold tabular-nums text-white">{formatNanos(stats.BestLap)}</td>
      {sectors.map((s, i) => (
        <td key={i} className={`px-1 py-2.5 text-center tabular-nums ${SPLIT_TONE_CLASS[s.tone]}`}>
          {s.text}
        </td>
      ))}
      <td className="px-2 py-2.5 text-center font-bold tabular-nums text-white">{d.TotalNumLaps || 0}</td>
      <td className="px-2 py-2.5 text-center tabular-nums text-[#c9ced6]">{longPits}</td>
      <td className="px-2 py-2.5 text-center tabular-nums text-[#6b7280]">{normalPits}</td>
      <td className="px-2 py-2.5 text-center font-bold tabular-nums text-[#f59e0b]">{formatStintMs(stintMs)}</td>
      <td className="px-2 py-2.5 text-right text-[#6b7280]">{seen}</td>
    </tr>
  )
}

export default function LiveTimingPage() {
  const t = useDictionary().liveTiming
  const [tab, setTab] = useState<Tab>('live')
  const [filter, setFilter] = useState('ALL')
  const [championship, setChampionship] = useState<ChampionshipId>('erc')
  const activeServers = CHAMPIONSHIPS.find((c) => c.id === championship)?.servers ?? CHAMPIONSHIPS[0].servers
  const [selectedServer, setSelectedServer] = useState(activeServers[0])
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [serverStatus, setServerStatus] = useState<Record<string, boolean>>({})
  const [stints, setStints] = useState<Record<string, number>>({})
  // Equipo y dorsal según el apartado de Equipos del Hub, por Steam ID
  const [hubEntries, setHubEntries] = useState<Record<string, HubEntry[]>>({})
  // Nombre de cada piloto en el Hub, por Steam ID (si la cuenta de Steam está vinculada)
  const [hubNames, setHubNames] = useState<Record<string, string>>({})
  const [showMap, setShowMap] = useState(true)
  // Coche seleccionado (clic en la tabla o en el mapa): se destaca en ambos
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'Position', dir: 'asc' })
  const [showLegend, setShowLegend] = useState(false)
  // Cambios de posición recientes (flechas verde/roja que se apagan solas a los 12 s)
  const [moves, setMoves] = useState<Record<string, { delta: number; at: number }>>({})
  const prevPositions = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/live-timing/entries')
        const json = await res.json()
        if (alive && json?.entries) setHubEntries(json.entries)
        if (alive && json?.names) setHubNames(json.names)
      } catch {
        // Sin datos del Hub se muestran los del servidor de carrera
      }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    try {
      if (window.localStorage.getItem('rsx_lt_map') === 'hidden') setShowMap(false)
    } catch {}
  }, [])

  const toggleMap = () => {
    setShowMap((v) => {
      try {
        window.localStorage.setItem('rsx_lt_map', v ? 'hidden' : 'shown')
      } catch {}
      return !v
    })
  }

  // Evita que dos polls se solapen: si una petición tarda más que el intervalo, el siguiente tick se salta
  // en vez de lanzar otra en paralelo, para que una respuesta vieja no pise a una nueva.
  const pollInFlight = useRef(false)

  const poll = useCallback(async () => {
    if (pollInFlight.current || document.hidden) return
    pollInFlight.current = true
    const key = serverStatusKey(championship, selectedServer)
    try {
      const res = await liveFetch(`/api/live-timing/leaderboard?server=${selectedServer}&source=${championship}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: LeaderboardResponse = await res.json()
      setData(json)
      setServerStatus((prev) => ({ ...prev, [key]: isServerLive(json) }))
      setStatus(isServerLive(json) ? 'online' : 'offline')
    } catch {
      setStatus('offline')
      setServerStatus((prev) => ({ ...prev, [key]: false }))
    } finally {
      pollInFlight.current = false
    }
  }, [championship, selectedServer])

  // Los stints oficiales cambian despacio y vienen de otra base de datos: se piden una vez al minuto,
  // no en cada sondeo de la carrera.
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.hidden) return
      const map = await withFallback<Record<string, number> | null>(fetchOfficialStints(), LIVE_FETCH_TIMEOUT_MS, null)
      if (alive && map) setStints(map)
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  // Estado de los demás servidores para las tarjetas de selección. Usa la ruta de sesión (114 bytes) y no el
  // leaderboard completo (hasta 12 MB): con el leaderboard, cinco servidores cada 30 s saturaban al origen.
  const sweepInFlight = useRef(false)
  const pollAllStatuses = useCallback(async () => {
    if (sweepInFlight.current || document.hidden) return
    sweepInFlight.current = true
    try {
      for (const { championshipId, server } of ALL_SERVERS) {
        if (championshipId === championship && server === selectedServer) continue
        const key = serverStatusKey(championshipId, server)
        try {
          const res = await liveFetch(`/api/live-timing/session?source=${championshipId}&server=${server}`)
          const json = res.ok ? await res.json() : null
          setServerStatus((prev) => ({ ...prev, [key]: Boolean(json?.ok && json.session?.phase !== 'unknown') }))
        } catch {
          setServerStatus((prev) => ({ ...prev, [key]: false }))
        }
        await new Promise((resolve) => setTimeout(resolve, 350))
      }
    } finally {
      sweepInFlight.current = false
    }
  }, [championship, selectedServer])

  const pollAllStatusesRef = useRef(pollAllStatuses)
  pollAllStatusesRef.current = pollAllStatuses

  useEffect(() => {
    pollAllStatusesRef.current()
    const id = setInterval(() => pollAllStatusesRef.current(), 30000)
    return () => clearInterval(id)
  }, [])

  const pollRef = useRef(poll)
  pollRef.current = poll

  useEffect(() => {
    setData(null)
    setStatus('connecting')
    setMoves({})
    prevPositions.current = new Map()
    const kickoff = setTimeout(() => pollRef.current(), 400)
    const id = setInterval(() => pollRef.current(), 6000)
    // Red de seguridad: poll() siempre debería dejar "Conectando…" en online/offline, pero si la
    // pestaña se abrió en segundo plano (poll() no hace nada mientras document.hidden) y nunca pasa
    // a primer plano, antes se quedaba así para siempre. A los 8 s se fuerza "offline" — solo es un
    // estado visual, el intervalo normal lo corrige solo en el siguiente sondeo que sí tenga datos.
    const safety = setTimeout(() => setStatus((prev) => (prev === 'connecting' ? 'offline' : prev)), 8000)
    // Al volver a la pestaña se refresca enseguida, en vez de esperar al siguiente tick.
    const onVisible = () => {
      if (!document.hidden) pollRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(kickoff)
      clearTimeout(safety)
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [selectedServer, championship])

  const connected = useMemo(() => data?.ConnectedDrivers ?? [], [data])
  const disconnected = useMemo(() => data?.DisconnectedDrivers ?? [], [data])

  // Equipo y número del coche: mandan los del apartado de Equipos (vinculados por Steam ID); el servidor de
  // carrera suele mandar el número a 0 y el equipo vacío, así que solo sirve de respaldo.
  const resolveCar = useCallback(
    (d: LiveDriver) => {
      const info = d.CarInfo || {}
      const cls = getClassTagFromModel(info.CarModel)
      const steamId = String(info.DriverGUID || '').match(/\d{17}/)?.[0] || String(info.DriverGUID || '')
      const entries = hubEntries[steamId] || []
      const sameClass = entries.find((e) => e.category && (e.category === cls || cls.includes(e.category) || e.category.includes(cls)))
      const pick = sameClass || entries.find((e) => e.dorsal) || entries[0]
      const simNumber = Number(info.RaceNumber) > 0 ? String(info.RaceNumber) : null
      return {
        team: pick?.teamName || info.TeamName || info.DriverName || '-',
        number: pick?.dorsal || simNumber,
        driver: hubNames[steamId] || info.DriverName || '-',
      }
    },
    [hubEntries, hubNames]
  )

  // Detecta adelantamientos: compara cada posición con la del sondeo anterior
  useEffect(() => {
    const now = Date.now()
    const next = new Map<string, number>()
    const changes: Record<string, { delta: number; at: number }> = {}
    connected.forEach((d) => {
      const key = carKey(d)
      next.set(key, d.Position)
      const before = prevPositions.current.get(key)
      if (before != null && before !== d.Position) changes[key] = { delta: before - d.Position, at: now }
    })
    prevPositions.current = next
    setMoves((prev) => {
      const alive = Object.fromEntries(Object.entries(prev).filter(([, m]) => now - m.at < 12_000))
      return { ...alive, ...changes }
    })
  }, [connected])

  const filterDrivers = useCallback(
    (drivers: LiveDriver[]) => {
      if (filter === 'ALL') return drivers
      return drivers.filter((d) => getClassTagFromModel(d.CarInfo?.CarModel) === filter)
    },
    [filter]
  )

  const sessionBestSplits = useMemo(() => {
    const best: Record<number, number> = { 0: Infinity, 1: Infinity, 2: Infinity }
    connected.forEach((d) => {
      const stats = getCarStats(d)
      ;[stats.BestSplits, stats.CurrentLapSplits].forEach((group) => {
        if (!group) return
        Object.values(group).forEach((s) => {
          if (s.SplitTime > 0 && s.SplitTime < (best[s.SplitIndex] ?? Infinity)) best[s.SplitIndex] = s.SplitTime
        })
      })
    })
    return best
  }, [connected])

  const resultBestSplits = useMemo(() => {
    const best: Record<number, number> = { 0: Infinity, 1: Infinity, 2: Infinity }
    ;[...connected, ...disconnected].forEach((d) => {
      const group = getCarStats(d).BestSplits
      if (!group) return
      Object.values(group).forEach((sp) => {
        if (sp.SplitTime > 0 && sp.SplitTime < (best[sp.SplitIndex] ?? Infinity)) best[sp.SplitIndex] = sp.SplitTime
      })
    })
    return best
  }, [connected, disconnected])

  // Posición en su categoría e intervalo con el coche de delante: se calculan sobre el orden real de carrera,
  // no sobre lo que se vea tras filtrar u ordenar la tabla.
  const rowMeta = useMemo(() => {
    const meta = new Map<string, { cls: string; classPos: number; interval: string }>()
    const counters: Record<string, number> = {}
    let prevGap = 0
    ;[...connected]
      .sort((a, b) => a.Position - b.Position)
      .forEach((d, idx) => {
        const cls = getClassTagFromModel(d.CarInfo?.CarModel)
        counters[cls] = (counters[cls] || 0) + 1
        const splitStr = d.Split || ''
        let interval = '-'
        if (idx === 0) {
          prevGap = 0
        } else if (splitStr.toUpperCase().includes('L')) {
          interval = splitStr
        } else {
          const gapVal = parseGapSeconds(splitStr)
          if (gapVal != null) {
            interval = `+${Math.max(0, gapVal - prevGap).toFixed(3)}`
            prevGap = gapVal
          } else {
            interval = splitStr || '-'
          }
        }
        meta.set(carKey(d), { cls, classPos: counters[cls], interval })
      })
    return meta
  }, [connected])

  // Mejor vuelta de cada categoría (y la absoluta) para pintar en morado y para la banda de vueltas rápidas
  const fastest = useMemo(() => {
    const byClass: Record<string, { time: number; driver: LiveDriver }> = {}
    let overall: { time: number; driver: LiveDriver; cls: string } | null = null
    connected.forEach((d) => {
      const best = getCarStats(d).BestLap
      if (!best || best <= 0 || best > 3_600_000_000_000) return
      const cls = getClassTagFromModel(d.CarInfo?.CarModel)
      if (!byClass[cls] || best < byClass[cls].time) byClass[cls] = { time: best, driver: d }
      if (!overall || best < overall.time) overall = { time: best, driver: d, cls }
    })
    return { byClass, overall: overall as { time: number; driver: LiveDriver; cls: string } | null }
  }, [connected])

  const sortDrivers = useCallback(
    (drivers: LiveDriver[]) => {
      const sorted = [...drivers]
      sorted.sort((a, b) => {
        let valA: number | string
        let valB: number | string
        switch (sort.key) {
          case 'Class':
            valA = getClassTagFromModel(a.CarInfo?.CarModel)
            valB = getClassTagFromModel(b.CarInfo?.CarModel)
            break
          case 'Number':
            valA = parseInt(resolveCar(a).number || '0', 10)
            valB = parseInt(resolveCar(b).number || '0', 10)
            break
          case 'Driver':
            valA = (a.CarInfo?.DriverName || '').toLowerCase()
            valB = (b.CarInfo?.DriverName || '').toLowerCase()
            break
          case 'Team':
            valA = resolveCar(a).team.toLowerCase()
            valB = resolveCar(b).team.toLowerCase()
            break
          case 'BestLap':
            valA = getCarStats(a).BestLap || 9e14
            valB = getCarStats(b).BestLap || 9e14
            break
          case 'LastLap':
            valA = getCarStats(a).LastLap || 9e14
            valB = getCarStats(b).LastLap || 9e14
            break
          case 'Laps':
            valA = a.TotalNumLaps || 0
            valB = b.TotalNumLaps || 0
            break
          default:
            valA = a.Position
            valB = b.Position
        }
        if (valA < valB) return sort.dir === 'asc' ? -1 : 1
        if (valA > valB) return sort.dir === 'asc' ? 1 : -1
        return 0
      })
      return sorted
    },
    [sort, resolveCar]
  )

  const handleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'Laps' ? 'desc' : 'asc' }))
  }

  const liveRows = useMemo(() => sortDrivers(filterDrivers(connected)), [connected, filterDrivers, sortDrivers])
  const resultRows = useMemo(() => sortDrivers(filterDrivers(disconnected)), [disconnected, filterDrivers, sortDrivers])

  // Objeto estable: TrackMap está memoizado (React.memo) para que los re-renders del reloj (cada 1
  // s) y de forceTick (cada 4 s) no reconstruyan el SVG entero de los coches — un objeto literal
  // nuevo en cada render para esta prop rompería esa memoización aunque el texto no cambie nunca.
  const mapLabels = useMemo(() => ({ loading: t.map.loading, unavailable: t.map.unavailable }), [t.map.loading, t.map.unavailable])

  const mapSamples = useMemo<MapSample[]>(
    () =>
      connected
        .filter((d) => d.LastPos)
        .map((d) => {
          const car = resolveCar(d)
          const cls = rowMeta.get(carKey(d))?.cls || getClassTagFromModel(d.CarInfo?.CarModel)
          return {
            key: carKey(d),
            x: d.LastPos!.X,
            z: d.LastPos!.Z,
            progress: typeof d.NormalisedSplinePos === 'number' ? d.NormalisedSplinePos : null,
            initials: (d.CarInfo?.DriverInitials || d.CarInfo?.DriverName || '').slice(0, 3).toUpperCase(),
            inPits: Boolean(d.IsInPits),
            number: car.number || '–',
            color: classColor(cls),
            position: d.Position,
            label: `P${d.Position} · #${car.number ?? '-'} ${car.team} — ${d.CarInfo?.DriverName || ''}`,
            dim: filter !== 'ALL' && cls !== filter,
          }
        }),
    [connected, resolveCar, rowMeta, filter]
  )

  const totalSeconds = data?.Time ? data.Time * 60 : 0
  const leaderLaps = useMemo(() => connected.reduce((max, d) => Math.max(max, d.TotalNumLaps || 0), 0), [connected])
  const inPitCount = useMemo(() => connected.filter((d) => d.IsInPits).length, [connected])
  const nowMs = Date.now()
  const fastestClasses = Object.keys(fastest.byClass).sort((a, b) => fastest.byClass[a].time - fastest.byClass[b].time)
  const onAir = status === 'online'

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-4 text-[#e8eaee]">
      {/* Cabecera */}
      <header className="border border-[#1f242c] bg-[#11141a]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-4">
            <span
              className={`flex items-center gap-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                onAir ? 'bg-[#e10600] text-white' : status === 'offline' ? 'bg-[#1f242c] text-[#e10600]' : 'bg-[#1f242c] text-[#6b7280]'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${onAir ? 'animate-pulse bg-white' : 'bg-current'}`} />
              {onAir ? t.statusOnline : status === 'offline' ? t.statusOffline : t.statusConnecting}
            </span>
            <div>
              <h1 className="font-display-league text-3xl uppercase leading-none tracking-wide text-white">{t.title}</h1>
              <p className="mt-1 hidden text-[10px] uppercase tracking-[0.2em] text-[#6b7280] md:block">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex border border-[#1f242c]">
              {CHAMPIONSHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setChampionship(c.id)
                    setSelectedServer(c.servers[0])
                  }}
                  className={`px-3.5 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${
                    championship === c.id ? 'bg-white text-black' : 'text-[#6b7280] hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="font-mono-data px-1 text-xl font-bold tabular-nums text-white">
              <LiveClock />
            </div>
            <button
              type="button"
              onClick={() => setShowLegend((v) => !v)}
              title={t.legend.title}
              aria-label={t.legend.title}
              className={`flex h-9 w-9 items-center justify-center border transition-colors ${
                showLegend ? 'border-white text-white' : 'border-[#1f242c] text-[#6b7280] hover:border-[#374151] hover:text-white'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Servidores */}
        <div className="flex flex-wrap gap-2 border-t border-[#1f242c] px-5 py-3">
          {activeServers.map((server, idx) => {
            const live = server === selectedServer ? status === 'online' : Boolean(serverStatus[serverStatusKey(championship, server)])
            const isSelected = server === selectedServer
            return (
              <button
                key={server}
                type="button"
                onClick={() => setSelectedServer(server)}
                title={live ? t.statusOnline : t.statusOffline}
                className={`flex items-center gap-2.5 border px-3.5 py-2 transition-colors ${
                  isSelected ? 'border-white bg-white/[0.06]' : 'border-[#1f242c] hover:border-[#374151]'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[#22c55e]' : 'bg-[#374151]'}`} />
                <span className="font-mono-data text-[11px] font-bold text-white">{String(idx + 1).padStart(2, '0')}</span>
                <span className={`hidden text-[10px] font-bold uppercase tracking-wider sm:block ${live ? 'text-[#22c55e]' : 'text-[#4b5563]'}`}>
                  {live ? t.statusOnline : t.statusOffline}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sesión */}
        <div className="grid grid-cols-2 border-t border-[#1f242c] md:grid-cols-6">
          <div className="col-span-2 border-b border-[#1f242c] px-5 py-3 md:border-b-0 md:border-r">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{t.track}</p>
            <p className="font-display-league truncate text-2xl uppercase leading-tight text-white">{formatTrackName(data?.Track) || '—'}</p>
            <p className="truncate font-mono-data text-[10px] text-[#4b5563]">{data?.ServerName || t.serverConnecting}</p>
          </div>
          <SessionClock
            source={championship}
            server={selectedServer}
            fallbackTotalSeconds={totalSeconds}
            fallbackElapsedMs={data?.ElapsedMilliseconds ?? null}
            leaderLaps={leaderLaps}
            labels={{ remaining: t.remaining, countdown: t.countdown, over: t.clockOver, lapsRemaining: t.lapsRemaining }}
          />
          <HeaderStat label={t.lap} value={leaderLaps || '—'} />
          <HeaderStat label={t.cars} value={connected.length ? `${connected.length}${inPitCount ? ` · ${inPitCount} ${t.pit}` : ''}` : '—'} />
          <HeaderStat label={t.air} value={data?.AmbientTemp != null ? `${data.AmbientTemp}°` : '—'} />
          <HeaderStat label={t.trackTemp} value={data?.RoadTemp != null ? `${data.RoadTemp}°` : '—'} tone="text-[#f59e0b]" />
        </div>
      </header>

      {/* Mejores vueltas por categoría */}
      {fastestClasses.length > 0 && (
        <section>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{t.fastestLaps}</p>
          <div className="grid gap-px border border-[#1f242c] bg-[#1f242c] md:grid-cols-3 xl:grid-cols-5">
            {fastestClasses.map((cls) => {
              const item = fastest.byClass[cls]
              const car = resolveCar(item.driver)
              const isOverall = fastest.overall?.driver === item.driver
              return (
                <div key={cls} className="flex items-center gap-3 bg-[#11141a] px-4 py-3" style={{ boxShadow: `inset 3px 0 0 0 ${classColor(cls)}` }}>
                  <NumberPlate number={car.number ?? undefined} cls={cls} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold uppercase tracking-wide text-white">{car.team}</p>
                    <p className="truncate text-[10px] uppercase text-[#6b7280]">{item.driver.CarInfo?.DriverName || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: classColor(cls) }}>{CLASS_SHORT[cls] || cls}</p>
                    <p className={`font-mono-data text-base font-bold tabular-nums ${isOverall ? 'text-[#d946ef]' : 'text-white'}`}>{formatNanos(item.time)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {showLegend && (
        <section className="grid gap-6 border border-[#1f242c] bg-[#11141a] px-5 py-4 md:grid-cols-3">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{t.legend.columns}</p>
            <dl className="space-y-1 text-[11px]">
              {LEGEND_COLUMNS.map((key) => (
                <div key={key} className="flex items-baseline gap-2">
                  <dt className="w-16 shrink-0 font-mono-data font-bold text-white">{(t.col as Record<string, string>)[key]}</dt>
                  <dd className="text-[#9ca3af]">{(t.legend.colDesc as Record<string, string>)[key]}</dd>
                </div>
              ))}
              <div className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 font-mono-data font-bold text-white">S1 / S2 / S3</dt>
                <dd className="text-[#9ca3af]">{t.legend.sector}</dd>
              </div>
            </dl>
          </div>
          <div className="space-y-4 text-[11px] text-[#9ca3af]">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{t.legend.positions}</p>
              <div className="flex items-center gap-2"><ArrowUp className="h-3.5 w-3.5 text-[#22c55e]" /> {t.legend.gained}</div>
              <div className="flex items-center gap-2"><ArrowDown className="h-3.5 w-3.5 text-[#e10600]" /> {t.legend.lost}</div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{t.legend.connection}</p>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#e10600]" /> {t.legend.live}</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#374151]" /> {t.legend.offline}</div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{t.legend.colors}</p>
            <div className="space-y-1.5 text-[11px] text-[#9ca3af]">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#d946ef]" /> {t.legend.sessionBest}</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#22c55e]" /> {t.legend.personalBest}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[#9ca3af]">
              {Object.entries(CLASS_COLORS).map(([cls, color]) => (
                <span key={cls} className="flex items-center gap-1.5"><span className="h-2 w-3" style={{ background: color }} /> {cls}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Mapa del circuito */}
      <section className="border border-[#1f242c] bg-[#11141a]">
        <button type="button" onClick={toggleMap} className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-white/[0.03]">
          <span className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9ca3af]">
            {t.map.title}
            {data?.Track && <span className="text-[#4b5563]">· {formatTrackName(data.Track)}</span>}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{showMap ? t.map.hide : t.map.show}</span>
        </button>
        {showMap && (
          <div className="border-t border-[#1f242c]">
            <TrackMap
              source={championship}
              track={data?.Track || ''}
              config={data?.TrackConfig || ''}
              samples={mapSamples}
              selectedKey={selectedKey}
              onSelect={(key) => setSelectedKey((prev) => (prev === key ? null : key))}
              labels={mapLabels}
            />
          </div>
        )}
      </section>

      {/* Clasificación */}
      <section className="min-w-0 overflow-hidden border border-[#1f242c] bg-[#11141a]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f242c] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {CLASS_FILTERS.map((cls) => {
              const active = filter === cls
              return (
                <button
                  key={cls}
                  onClick={() => setFilter(cls)}
                  className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    active ? 'border-white bg-white text-black' : 'border-[#1f242c] text-[#9ca3af] hover:border-[#374151] hover:text-white'
                  }`}
                  style={!active && cls !== 'ALL' ? { color: classColor(cls) } : undefined}
                >
                  {cls === 'ALL' ? t.filterAll : cls}
                </button>
              )
            })}
          </div>
          <div className="flex border border-[#1f242c]">
            {(['live', 'results'] as Tab[]).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors ${
                  tab === tb ? 'bg-white text-black' : 'text-[#6b7280] hover:text-white'
                }`}
              >
                {tb === 'live' ? t.tabLive : t.tabResults}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === 'live' ? (
            <table className="w-full min-w-[1260px] border-collapse text-left font-mono-data text-[11px] whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-[#11141a]">
                <tr className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#6b7280]">
                  <Th sortKey="Position" onSort={handleSort} sort={sort} className="pl-4 text-center">{t.col.pos}</Th>
                  <Th sortKey="Number" onSort={handleSort} sort={sort} className="text-center">{t.col.number}</Th>
                  <Th sortKey="Class" onSort={handleSort} sort={sort} className="text-center">{t.col.cls}</Th>
                  <Th sortKey="Driver" onSort={handleSort} sort={sort}>{t.col.name}</Th>
                  <Th sortKey="Team" onSort={handleSort} sort={sort}>{t.col.team}</Th>
                  <Th className="text-center">{t.col.tyre}</Th>
                  <Th className="text-right">{t.col.gap}</Th>
                  <Th className="text-right text-[#38bdf8]">{t.col.interval}</Th>
                  <Th sortKey="LastLap" onSort={handleSort} sort={sort} className="text-right">{t.col.last}</Th>
                  <Th sortKey="BestLap" onSort={handleSort} sort={sort} className="text-right">{t.col.best}</Th>
                  <Th className="text-center">S1</Th>
                  <Th className="text-center">S2</Th>
                  <Th className="text-center">S3</Th>
                  <Th sortKey="Laps" onSort={handleSort} sort={sort} className="text-center">{t.col.laps}</Th>
                  <Th className="text-center">{t.col.pits}</Th>
                  <Th className="text-center text-[#f59e0b]">{t.col.stint}</Th>
                  <Th className="text-center">{t.col.state}</Th>
                </tr>
              </thead>
              <tbody>
                {liveRows.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-16 text-center text-xs text-[#4b5563]">{t.noDrivers}</td>
                  </tr>
                ) : (
                  liveRows.map((d) => {
                    const key = carKey(d)
                    const info = d.CarInfo || {}
                    const cls = rowMeta.get(key)?.cls || getClassTagFromModel(info.CarModel)
                    const stats = getCarStats(d)
                    const classBest = fastest.byClass[cls]?.time
                    const move = moves[key]
                    const moveActive = move && nowMs - move.at < 12_000 ? move : null
                    return (
                      <LiveRow
                        key={key}
                        selected={selectedKey === key}
                        onSelect={() => setSelectedKey((prev) => (prev === key ? null : key))}
                        d={d}
                        car={resolveCar(d)}
                        cls={cls}
                        classPos={rowMeta.get(key)?.classPos}
                        interval={rowMeta.get(key)?.interval ?? '-'}
                        stats={stats}
                        stintMs={info.DriverGUID ? stints[info.DriverGUID] || 0 : 0}
                        isClassBest={Boolean(stats.BestLap && classBest && stats.BestLap <= classBest)}
                        isOverallBest={Boolean(stats.BestLap && fastest.overall && stats.BestLap <= fastest.overall.time)}
                        moveDelta={moveActive ? moveActive.delta : null}
                        splits={[0, 1, 2].map((i) => bestSplitFor(d, i, sessionBestSplits))}
                        labels={t}
                      />
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[1100px] border-collapse text-left font-mono-data text-[11px] whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-[#11141a]">
                <tr className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#6b7280]">
                  <Th className="pl-4 text-center">{t.col.pos}</Th>
                  <Th className="text-center">{t.col.number}</Th>
                  <Th className="text-center">{t.col.cls}</Th>
                  <Th>{t.col.name}</Th>
                  <Th>{t.col.team}</Th>
                  <Th className="text-right">{t.col.best}</Th>
                  <Th className="text-center">S1</Th>
                  <Th className="text-center">S2</Th>
                  <Th className="text-center">S3</Th>
                  <Th className="text-center">{t.col.laps}</Th>
                  <Th className="text-center">{t.col.longPits}</Th>
                  <Th className="text-center">{t.col.normalPits}</Th>
                  <Th className="text-center text-[#f59e0b]">{t.col.stint}</Th>
                  <Th className="text-right">{t.col.lastSeen}</Th>
                </tr>
              </thead>
              <tbody>
                {resultRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-16 text-center text-xs text-[#4b5563]">{t.noResults}</td>
                  </tr>
                ) : (
                  resultRows.map((d, idx) => {
                    const info = d.CarInfo || {}
                    const cls = getClassTagFromModel(info.CarModel)
                    const seen =
                      d.LastSeen && !d.LastSeen.startsWith('0001')
                        ? new Date(d.LastSeen).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '-'
                    return (
                      <ResultRow
                        key={`${carKey(d)}-${idx}`}
                        d={d}
                        idx={idx}
                        car={resolveCar(d)}
                        cls={cls}
                        stats={getCarStats(d)}
                        stintMs={info.DriverGUID ? stints[info.DriverGUID] || 0 : 0}
                        sectors={[0, 1, 2].map((i) => bestLapSplit(d, i, resultBestSplits))}
                        seen={seen}
                      />
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-5 border-t border-[#1f242c] px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[#6b7280]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d946ef]" /> {t.legend.sessionBest}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22c55e]" /> {t.legend.personalBest}</span>
          <span className="ml-auto flex flex-wrap items-center gap-3 normal-case tracking-normal">
            {Object.entries(CLASS_COLORS).map(([cls, color]) => (
              <span key={cls} className="flex items-center gap-1.5"><span className="h-2 w-2.5" style={{ background: color }} /> {cls}</span>
            ))}
          </span>
        </footer>
      </section>
    </div>
  )
}
