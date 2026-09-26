'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDictionary } from '@/lib/i18n/locale-provider'
import { getCategoryStyles } from '@/components/class-badge'
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
  type LeaderboardResponse,
  type LiveDriver,
} from '@/lib/live-timing'

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
  const fmt = (curVal / 1e9).toFixed(1)
  if (curVal <= (sessionBest[index] ?? Infinity)) return { text: fmt, tone: 'purple' as const }
  const best = stats.BestSplits ? Object.values(stats.BestSplits).find((s) => s.SplitIndex === index) : undefined
  const pb = best?.SplitTime ?? Infinity
  if (curVal <= pb) return { text: fmt, tone: 'green' as const }
  return { text: fmt, tone: 'yellow' as const }
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
      className="inline-flex h-6 min-w-[40px] items-center justify-center rounded-[3px] px-1.5 font-display-league text-[15px] leading-none text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]"
      style={{ background: classColor(cls) }}
    >
      {number || '0'}
    </span>
  )
}

function Th({
  children,
  sortKey,
  onSort,
  className = '',
}: {
  children?: React.ReactNode
  sortKey?: SortKey
  onSort?: (key: SortKey) => void
  className?: string
}) {
  return (
    <th
      onClick={sortKey && onSort ? () => onSort(sortKey) : undefined}
      className={`border-b border-white/15 bg-[#04070d] px-2 py-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500 ${
        sortKey ? 'cursor-pointer select-none hover:text-white' : ''
      } ${className}`}
    >
      {children}
    </th>
  )
}

function HeaderStat({ label, value, tone = 'text-white' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="px-4 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`font-mono-data mt-0.5 text-lg font-bold leading-none tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

const LEGEND_COLUMNS = ['pos', 'cls', 'classPos', 'number', 'driverCar', 'team', 'tyre', 'gap', 'interval', 'last', 'best', 'laps', 'pits', 'stint', 'state'] as const

export default function LiveTimingPage() {
  const t = useDictionary().liveTiming
  const [tab, setTab] = useState<Tab>('live')
  const [filter, setFilter] = useState('ALL')
  const [championship, setChampionship] = useState<ChampionshipId>('erc')
  const activeServers = CHAMPIONSHIPS.find((c) => c.id === championship)?.servers ?? CHAMPIONSHIPS[0].servers
  const [selectedServer, setSelectedServer] = useState(activeServers[0])
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [serverStatus, setServerStatus] = useState<Record<string, LeaderboardResponse | null>>({})
  const [stints, setStints] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'Position', dir: 'asc' })
  const [clock, setClock] = useState('')
  const [showLegend, setShowLegend] = useState(false)
  // Cambios de posición recientes (flechas verde/roja que se apagan solas a los 12 s)
  const [moves, setMoves] = useState<Record<string, { delta: number; at: number }>>({})
  const prevPositions = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const poll = useCallback(async () => {
    const key = serverStatusKey(championship, selectedServer)
    try {
      const [stintsMap, res] = await Promise.all([
        fetchOfficialStints(),
        fetch(`/api/live-timing/leaderboard?server=${selectedServer}&source=${championship}`, { cache: 'no-store' }),
      ])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: LeaderboardResponse = await res.json()
      setStints(stintsMap)
      setData(json)
      setServerStatus((prev) => ({ ...prev, [key]: json }))
      setStatus(isServerLive(json) ? 'online' : 'offline')
    } catch {
      // A single failed poll (e.g. the upstream's rate limit) shouldn't blank the page if we
      // already have a recent snapshot of this server from the status sweep — fall back to
      // that instead of leaving the board empty until the next successful poll.
      setData((prev) => prev ?? serverStatus[key] ?? prev)
      setStatus('offline')
    }
  }, [championship, selectedServer, serverStatus])

  // Lightweight status check across all servers (both championships), to populate the selector cards.
  // Fired one at a time with a small gap instead of all 6 at once — the upstream source has a
  // tight per-IP rate limit, and 6 simultaneous requests (plus the selected-server poll landing
  // at the same instant) was tripping a 429 that left the whole page blank until the next retry.
  const pollAllStatuses = useCallback(async () => {
    for (const { championshipId, server } of ALL_SERVERS) {
      const key = serverStatusKey(championshipId, server)
      try {
        const res = await fetch(`/api/live-timing/leaderboard?server=${server}&source=${championshipId}`, { cache: 'no-store' })
        const json = res.ok ? ((await res.json()) as LeaderboardResponse) : null
        setServerStatus((prev) => ({ ...prev, [key]: json }))
      } catch {
        setServerStatus((prev) => ({ ...prev, [key]: null }))
      }
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }, [])

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
    // Slight delay so this doesn't land in the same instant as the all-servers status sweep above.
    // The selected server is the only thing polled this often — the burst that used to trip the
    // upstream's rate limit was 6+ servers fetched at once, not one server fetched frequently.
    const kickoff = setTimeout(() => pollRef.current(), 400)
    const id = setInterval(() => pollRef.current(), 6000)
    return () => {
      clearTimeout(kickoff)
      clearInterval(id)
    }
  }, [selectedServer, championship])

  const connected = useMemo(() => data?.ConnectedDrivers ?? [], [data])
  const disconnected = useMemo(() => data?.DisconnectedDrivers ?? [], [data])

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

  // Repinta cada 4 s para que las flechas caduquen aunque el servidor no mande cambios
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 4000)
    return () => clearInterval(id)
  }, [])

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
            valA = parseInt(a.CarInfo?.RaceNumber || '0', 10)
            valB = parseInt(b.CarInfo?.RaceNumber || '0', 10)
            break
          case 'Driver':
            valA = (a.CarInfo?.DriverName || '').toLowerCase()
            valB = (b.CarInfo?.DriverName || '').toLowerCase()
            break
          case 'Team':
            valA = (a.CarInfo?.TeamName || '').toLowerCase()
            valB = (b.CarInfo?.TeamName || '').toLowerCase()
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
    [sort]
  )

  const handleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'Laps' ? 'desc' : 'asc' }))
  }

  const liveRows = useMemo(() => sortDrivers(filterDrivers(connected)), [connected, filterDrivers, sortDrivers])
  const resultRows = useMemo(() => sortDrivers(filterDrivers(disconnected)), [disconnected, filterDrivers, sortDrivers])

  const totalSeconds = data?.Time ? data.Time * 60 : 0
  const elapsedSeconds = data?.ElapsedMilliseconds ? data.ElapsedMilliseconds / 1000 : 0
  const timeLeft = totalSeconds > 0 ? Math.max(0, totalSeconds - elapsedSeconds) : 0
  const progress = totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0
  const leaderLaps = useMemo(() => connected.reduce((max, d) => Math.max(max, d.TotalNumLaps || 0), 0), [connected])
  const inPitCount = useMemo(() => connected.filter((d) => d.IsInPits).length, [connected])
  const nowMs = Date.now()

  const fastestClasses = Object.keys(fastest.byClass).sort((a, b) => fastest.byClass[a].time - fastest.byClass[b].time)

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-3">
      {/* Cabecera de retransmisión: título, campeonato, servidores y reloj */}
      <div className="relative overflow-hidden border border-white/10 bg-[#04070d]">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#e10600] via-[#0072f0] to-[#009f00]" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${status === 'online' ? 'animate-ping bg-rose-500' : 'bg-slate-600'} opacity-75`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status === 'online' ? 'bg-rose-500' : 'bg-slate-600'}`} />
            </span>
            <div>
              <h1 className="font-display-league text-2xl uppercase leading-none tracking-wide text-white md:text-3xl">{t.title}</h1>
              <p className="mt-1 hidden text-[10px] uppercase tracking-[0.2em] text-slate-500 md:block">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Campeonato */}
            <div className="flex border border-white/10">
              {CHAMPIONSHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setChampionship(c.id)
                    setSelectedServer(c.servers[0])
                  }}
                  className={`relative px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    championship === c.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {c.label}
                  {championship === c.id && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#4ea1ff]" />}
                </button>
              ))}
            </div>

            {/* Servidores */}
            <div className="flex gap-1">
              {activeServers.map((server, idx) => {
                const info = serverStatus[serverStatusKey(championship, server)]
                const live = isServerLive(info)
                const isSelected = server === selectedServer
                return (
                  <button
                    key={server}
                    type="button"
                    onClick={() => setSelectedServer(server)}
                    title={live ? formatTrackName(info?.Track) || t.statusOnline : t.statusOffline}
                    className={`flex items-center gap-2 border px-3 py-2 text-left transition-colors ${
                      isSelected ? 'border-[#4ea1ff] bg-[#4ea1ff]/10' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                    <span className="font-mono-data text-[11px] font-bold text-white">{String(idx + 1).padStart(2, '0')}</span>
                    <span className={`hidden max-w-[110px] truncate text-[10px] font-bold uppercase tracking-wider sm:block ${live ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {live ? formatTrackName(info?.Track) || t.statusOnline : t.statusOffline}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="font-mono-data border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-bold tabular-nums text-white">{clock}</div>
            <button
              type="button"
              onClick={() => setShowLegend((v) => !v)}
              title={t.legend.title}
              aria-label={t.legend.title}
              className={`flex h-9 w-9 items-center justify-center border transition-colors ${
                showLegend ? 'border-[#4ea1ff] text-[#4ea1ff]' : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Banda de sesión: circuito, tiempo restante con barra de progreso, vueltas y temperaturas */}
        <div className="border-t border-white/10 bg-gradient-to-r from-[#0a1220] via-[#060a12] to-[#0a1220]">
          <div className="flex flex-wrap items-stretch divide-x divide-white/10">
            <div className="min-w-[220px] flex-1 px-4 py-2.5 md:px-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{t.track}</p>
              <p className="font-display-condensed truncate text-xl font-extrabold uppercase leading-tight text-white md:text-2xl">{formatTrackName(data?.Track) || '—'}</p>
              <p className="truncate font-mono-data text-[10px] text-slate-500">{data?.ServerName || t.serverConnecting}</p>
            </div>
            <div className="min-w-[200px] px-4 py-2.5 md:px-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{t.remaining}</p>
              <p className="font-mono-data text-3xl font-bold leading-none tabular-nums text-white">{formatSeconds(timeLeft)}</p>
              <div className="mt-1.5 h-1 w-full overflow-hidden bg-white/10">
                <div className="h-full bg-[#4ea1ff] transition-[width] duration-1000" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <HeaderStat label={t.lap} value={leaderLaps || '—'} />
            <HeaderStat label={t.cars} value={connected.length ? `${connected.length}${inPitCount ? ` · ${inPitCount} ${t.pit}` : ''}` : '—'} />
            <HeaderStat label={t.air} value={data?.AmbientTemp != null ? `${data.AmbientTemp}°` : '—'} tone="text-amber-400" />
            <HeaderStat label={t.trackTemp} value={data?.RoadTemp != null ? `${data.RoadTemp}°` : '—'} tone="text-orange-500" />
            <div className="flex items-center px-4 py-2.5">
              <span
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  status === 'online' ? 'text-emerald-400' : status === 'offline' ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {status === 'online' ? <Signal className="h-3.5 w-3.5" /> : <SignalZero className="h-3.5 w-3.5" />}
                {status === 'online' ? t.statusOnline : status === 'offline' ? t.statusOffline : t.statusConnecting}
              </span>
            </div>
          </div>
        </div>

        {/* Mejor vuelta por categoría */}
        {fastestClasses.length > 0 && (
          <div className="flex flex-wrap items-stretch gap-px border-t border-white/10 bg-white/10">
            <div className="flex items-center bg-[#04070d] px-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{t.fastestLaps}</div>
            {fastestClasses.map((cls) => {
              const item = fastest.byClass[cls]
              const info = item.driver.CarInfo || {}
              return (
                <div key={cls} className="flex min-w-[210px] flex-1 items-center gap-3 bg-[#04070d] px-4 py-2">
                  <span className="rounded-[3px] px-1.5 py-0.5 text-[10px] font-black text-white" style={{ background: classColor(cls) }}>
                    {CLASS_SHORT[cls] || cls}
                  </span>
                  <NumberPlate number={info.RaceNumber} cls={cls} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold uppercase text-white">{info.TeamName || info.DriverName || '-'}</p>
                    <p className="truncate text-[9px] uppercase text-slate-500">{info.DriverName || '-'}</p>
                  </div>
                  <span className={`font-mono-data text-sm font-bold tabular-nums ${fastest.overall?.driver === item.driver ? 'text-fuchsia-400' : 'text-white'}`}>
                    {formatNanos(item.time)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {showLegend && (
          <div className="border-t border-white/10 bg-[#04070d] px-5 py-4">
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.legend.columns}</p>
                <dl className="space-y-1 text-[11px]">
                  {LEGEND_COLUMNS.map((key) => (
                    <div key={key} className="flex items-baseline gap-2">
                      <dt className="w-16 shrink-0 font-mono-data font-bold text-[#4ea1ff]">{(t.col as Record<string, string>)[key]}</dt>
                      <dd className="text-slate-400">{(t.legend.colDesc as Record<string, string>)[key]}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline gap-2">
                    <dt className="w-16 shrink-0 font-mono-data font-bold text-[#4ea1ff]">S1 / S2 / S3</dt>
                    <dd className="text-slate-400">{t.legend.sector}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.legend.positions}</p>
                  <div className="space-y-1.5 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-3.5 w-3.5 text-emerald-400" /> {t.legend.gained}
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-3.5 w-3.5 text-rose-400" /> {t.legend.lost}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.legend.connection}</p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
                      <span className="text-slate-400">{t.legend.live}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-600" />
                      <span className="text-slate-400">{t.legend.offline}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.legend.colors}</p>
                <div className="space-y-3">
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-fuchsia-400" />
                      <span className="text-slate-400">{t.legend.sessionBest}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                      <span className="text-slate-400">{t.legend.personalBest}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
                    {Object.entries(CLASS_COLORS).map(([cls, color]) => (
                      <span key={cls} className="flex items-center gap-1.5 text-slate-400">
                        <span className="h-2 w-3 shrink-0" style={{ background: color }} /> {cls}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clasificación */}
      <div className="min-w-0 overflow-hidden border border-white/10 bg-[#04070d]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {CLASS_FILTERS.map((cls) => {
              const active = filter === cls
              const styles = cls === 'ALL' ? '' : getCategoryStyles(cls, active)
              return (
                <button
                  key={cls}
                  onClick={() => setFilter(cls)}
                  className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    cls === 'ALL'
                      ? active
                        ? 'border-white bg-white text-black'
                        : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/40'
                      : styles
                  }`}
                >
                  {cls === 'ALL' ? t.filterAll : cls}
                </button>
              )
            })}
          </div>
          <div className="flex border border-white/10">
            {(['live', 'results'] as Tab[]).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`relative px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  tab === tb ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tb === 'live' ? t.tabLive : t.tabResults}
                {tab === tb && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#4ea1ff]" />}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === 'live' ? (
            <table className="w-full min-w-[1180px] border-collapse text-left font-mono-data text-[11px] whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr>
                  <Th sortKey="Position" onSort={handleSort} className="w-14 text-center">{t.col.pos}</Th>
                  <Th sortKey="Number" onSort={handleSort} className="w-16 text-center">{t.col.number}</Th>
                  <Th sortKey="Class" onSort={handleSort} className="w-24 text-center">{t.col.cls}</Th>
                  <Th sortKey="Team" onSort={handleSort}>{t.col.team} / {t.col.driverCar}</Th>
                  <Th className="text-center">{t.col.tyre}</Th>
                  <Th className="text-right">{t.col.gap}</Th>
                  <Th className="text-right !text-[#4ea1ff]">{t.col.interval}</Th>
                  <Th sortKey="LastLap" onSort={handleSort} className="text-right">{t.col.last}</Th>
                  <Th sortKey="BestLap" onSort={handleSort} className="text-right">{t.col.best}</Th>
                  <Th className="w-12 text-center !text-slate-600">S1</Th>
                  <Th className="w-12 text-center !text-slate-600">S2</Th>
                  <Th className="w-12 text-center !text-slate-600">S3</Th>
                  <Th sortKey="Laps" onSort={handleSort} className="text-center">{t.col.laps}</Th>
                  <Th className="text-center">{t.col.pits}</Th>
                  <Th className="text-center !text-orange-400">{t.col.stint}</Th>
                  <Th className="text-center">{t.col.state}</Th>
                </tr>
              </thead>
              <tbody>
                {liveRows.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-14 text-center text-xs text-slate-600">
                      {t.noDrivers}
                    </td>
                  </tr>
                ) : (
                  liveRows.map((d) => {
                    const key = carKey(d)
                    const info = d.CarInfo || {}
                    const stats = getCarStats(d)
                    const meta = rowMeta.get(key)
                    const cls = meta?.cls || getClassTagFromModel(info.CarModel)
                    const color = classColor(cls)
                    const interval = meta?.interval ?? '-'

                    const longPits = d.NumLongPits || 0
                    const totalPits = d.NumPits || 0
                    const normalPits = Math.max(0, totalPits - longPits)
                    const stintMs = info.DriverGUID ? stints[info.DriverGUID] || 0 : 0
                    const tyre = tyreStyle(info.Tyres)

                    const classBest = fastest.byClass[cls]?.time
                    const isClassBest = Boolean(stats.BestLap && classBest && stats.BestLap <= classBest)
                    const isOverallBest = Boolean(stats.BestLap && fastest.overall && stats.BestLap <= fastest.overall.time)
                    const lastIsPersonalBest = Boolean(stats.LastLap && stats.BestLap && stats.LastLap <= stats.BestLap)
                    const lastTone = lastIsPersonalBest ? (isClassBest ? 'text-fuchsia-400 font-bold' : 'text-emerald-400 font-semibold') : 'text-slate-300'

                    const move = moves[key]
                    const moveActive = move && nowMs - move.at < 12_000 ? move : null

                    const splits = [0, 1, 2].map((i) => bestSplitFor(d, i, sessionBestSplits))

                    return (
                      <tr
                        key={key}
                        className={`border-t border-white/[0.05] transition-colors hover:bg-white/[0.05] ${
                          d.IsInPits ? 'bg-amber-500/[0.05]' : d.Position % 2 === 0 ? 'bg-white/[0.018]' : ''
                        }`}
                        style={{ boxShadow: `inset 4px 0 0 0 ${color}` }}
                      >
                        <td className="py-1.5 pl-3 pr-2">
                          <div className="flex items-center justify-center gap-1">
                            <span className="w-6 text-right font-display-league text-[17px] leading-none text-white">{d.Position}</span>
                            <span className="flex w-4 justify-center">
                              {moveActive && moveActive.delta > 0 && <ArrowUp className="h-3 w-3 text-emerald-400" />}
                              {moveActive && moveActive.delta < 0 && <ArrowDown className="h-3 w-3 text-rose-400" />}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <NumberPlate number={info.RaceNumber} cls={cls} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[9px] font-black tracking-wider" style={{ color }}>
                              {CLASS_SHORT[cls] || cls}
                            </span>
                            <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-[3px] px-1 text-[11px] font-black text-white" style={{ background: color }}>
                              {meta?.classPos ?? '-'}
                            </span>
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="max-w-[240px] truncate text-[12px] font-bold uppercase leading-tight text-white">{info.TeamName || info.DriverName || '-'}</div>
                          <div className="max-w-[240px] truncate text-[10px] leading-tight text-slate-500">
                            {info.DriverName || '-'}
                            <span className="text-slate-700"> · </span>
                            <span className="uppercase">{info.CarName || info.CarModel || '-'}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {tyre ? (
                            <span
                              title={info.Tyres}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-black text-white"
                              style={{ borderColor: tyre.color }}
                            >
                              {tyre.letter}
                            </span>
                          ) : (
                            <span className="text-slate-700">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{d.Position === 1 ? '-' : d.Split || '-'}</td>
                        <td className="px-2 py-1.5 text-right font-bold tabular-nums text-[#4ea1ff]">{interval}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${lastTone}`}>{formatNanos(stats.LastLap)}</td>
                        <td
                          className={`px-2 py-1.5 text-right font-bold tabular-nums ${isOverallBest ? 'text-fuchsia-400' : isClassBest ? 'text-fuchsia-300' : 'text-white'}`}
                          title={isClassBest ? t.legend.sessionBest : undefined}
                        >
                          {formatNanos(stats.BestLap)}
                        </td>
                        {splits.map((s, i) => (
                          <td key={i} className={`px-1 py-1.5 text-center tabular-nums ${SPLIT_TONE_CLASS[s.tone]}`}>
                            {s.text}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center font-bold tabular-nums text-white">{d.TotalNumLaps || 0}</td>
                        <td
                          className="px-2 py-1.5 text-center text-slate-300"
                          title={`${normalPits} ${t.col.normalPits} · ${longPits} ${t.col.longPits}${d.LastPitStop ? ` · ${t.col.lastPit}: ${d.LastPitStop}` : ''}`}
                        >
                          {totalPits}
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold tabular-nums text-orange-400">{formatStintMs(stintMs)}</td>
                        <td className="px-2 py-1.5 text-center">
                          {d.IsInPits ? (
                            <span className="animate-pulse rounded-[3px] bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-black">{t.pit}</span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-500">{t.onTrack}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[900px] border-collapse text-left font-mono-data text-[11px] whitespace-nowrap">
              <thead>
                <tr>
                  <Th sortKey="Position" onSort={handleSort} className="w-12 text-center">{t.col.pos}</Th>
                  <Th sortKey="Number" onSort={handleSort} className="w-16 text-center">{t.col.number}</Th>
                  <Th sortKey="Class" onSort={handleSort} className="w-20 text-center">{t.col.cls}</Th>
                  <Th sortKey="Team" onSort={handleSort}>{t.col.team} / {t.col.driverCar}</Th>
                  <Th sortKey="BestLap" onSort={handleSort} className="text-right">{t.col.best}</Th>
                  <Th sortKey="Laps" onSort={handleSort} className="text-center">{t.col.laps}</Th>
                  <Th className="text-center !text-orange-400">{t.col.stint}</Th>
                  <Th className="text-center">{t.col.longPits}</Th>
                  <Th className="text-center">{t.col.normalPits}</Th>
                  <Th className="text-right">{t.col.lastSeen}</Th>
                </tr>
              </thead>
              <tbody>
                {resultRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-14 text-center text-xs text-slate-600">
                      {t.noResults}
                    </td>
                  </tr>
                ) : (
                  resultRows.map((d, idx) => {
                    const info = d.CarInfo || {}
                    const stats = getCarStats(d)
                    const cls = getClassTagFromModel(info.CarModel)
                    const color = classColor(cls)
                    const longPits = d.NumLongPits || 0
                    const normalPits = Math.max(0, (d.NumPits || 0) - longPits)
                    const stintMs = info.DriverGUID ? stints[info.DriverGUID] || 0 : 0
                    const seen =
                      d.LastSeen && !d.LastSeen.startsWith('0001')
                        ? new Date(d.LastSeen).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '-'

                    return (
                      <tr
                        key={`${carKey(d)}-${idx}`}
                        className={`border-t border-white/[0.05] hover:bg-white/[0.05] ${idx % 2 === 1 ? 'bg-white/[0.018]' : ''}`}
                        style={{ boxShadow: `inset 4px 0 0 0 ${color}` }}
                      >
                        <td className="py-1.5 pl-3 pr-2 text-center font-display-league text-[15px] text-slate-400">{idx + 1}</td>
                        <td className="px-2 py-1.5 text-center">
                          <NumberPlate number={info.RaceNumber} cls={cls} />
                        </td>
                        <td className="px-2 py-1.5 text-center text-[9px] font-black tracking-wider" style={{ color }}>
                          {CLASS_SHORT[cls] || cls}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="text-[12px] font-bold uppercase leading-tight text-white">{info.TeamName || info.DriverName || '-'}</div>
                          <div className="text-[10px] leading-tight text-slate-500">
                            {info.DriverName || '-'}
                            <span className="text-slate-700"> · </span>
                            <span className="uppercase">{info.CarModel || '-'}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-bold tabular-nums text-white">{formatNanos(stats.BestLap)}</td>
                        <td className="px-2 py-1.5 text-center font-bold tabular-nums text-white">{d.TotalNumLaps || 0}</td>
                        <td className="px-2 py-1.5 text-center font-bold tabular-nums text-orange-400">{formatStintMs(stintMs)}</td>
                        <td className="px-2 py-1.5 text-center text-slate-400">{longPits}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500">{normalPits}</td>
                        <td className="px-2 py-1.5 text-right text-slate-500">{seen}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-white/10 bg-[#04070d] px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-fuchsia-400" /> {t.legend.sessionBest}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> {t.legend.personalBest}
          </span>
          <span className="ml-auto flex items-center gap-3 normal-case tracking-normal text-slate-600">
            {Object.entries(CLASS_COLORS).map(([cls, color]) => (
              <span key={cls} className="flex items-center gap-1.5">
                <span className="h-2 w-1 shrink-0" style={{ background: color }} /> {cls}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
