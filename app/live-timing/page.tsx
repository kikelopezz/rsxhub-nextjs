'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDictionary } from '@/lib/i18n/locale-provider'
import { ClassBadge, getCategoryStyles } from '@/components/class-badge'
import { Signal, SignalZero } from 'lucide-react'
import {
  CLASS_COLORS,
  fetchOfficialStints,
  formatNanos,
  formatSeconds,
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

const POS_CHIP: Record<number, string> = {
  1: 'bg-[#f5c518] text-black',
  2: 'bg-[#c7cdd6] text-black',
  3: 'bg-[#c98246] text-black',
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

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
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
    // Slight delay so this doesn't land in the same instant as the all-servers status sweep above.
    // The selected server is the only thing polled this often — the burst that used to trip the
    // upstream's rate limit was 6+ servers fetched at once, not one server fetched frequently.
    const kickoff = setTimeout(() => pollRef.current(), 400)
    const id = setInterval(() => pollRef.current(), 6000)
    return () => {
      clearTimeout(kickoff)
      clearInterval(id)
    }
  }, [selectedServer])

  const connected = data?.ConnectedDrivers ?? []
  const disconnected = data?.DisconnectedDrivers ?? []

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

  let timeLeft = 0
  if (data?.Time && data?.ElapsedMilliseconds) {
    timeLeft = Math.max(0, data.Time * 60 - data.ElapsedMilliseconds / 1000)
  }

  const classCounters: Record<string, number> = {}
  let prevGap = 0

  const Th = ({ children, sortKey, className = '' }: { children: React.ReactNode; sortKey?: SortKey; className?: string }) => (
    <th
      onClick={sortKey ? () => handleSort(sortKey) : undefined}
      className={`bg-[#060a12] border-b border-white/10 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${sortKey ? 'cursor-pointer select-none hover:text-[#4ea1ff]' : ''} ${className}`}
    >
      {children}
    </th>
  )

  const Stat = ({ label, value, className = '', span = false }: { label: string; value: React.ReactNode; className?: string; span?: boolean }) => (
    <div className={`bg-[#060a12] px-3 py-2.5 ${span ? 'col-span-2' : ''}`}>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate font-mono-data text-sm font-bold ${className || 'text-white'}`}>{value}</p>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      {/* Broadcast title bar */}
      <div className="relative overflow-hidden border border-white/10 bg-[#060a12]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#4ea1ff] to-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${status === 'online' ? 'animate-ping bg-rose-500' : 'bg-slate-600'} opacity-75`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status === 'online' ? 'bg-rose-500' : 'bg-slate-600'}`} />
            </span>
            <div>
              <h1 className="font-display-league flex items-center gap-2 text-2xl uppercase leading-none text-white md:text-3xl">
                {t.title}
              </h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex border border-white/10">
              {(['live', 'results'] as Tab[]).map((tb) => (
                <button
                  key={tb}
                  onClick={() => setTab(tb)}
                  className={`relative px-5 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    tab === tb ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tb === 'live' ? t.tabLive : t.tabResults}
                  {tab === tb && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#4ea1ff] shadow-[0_0_8px_rgba(78,161,255,0.9)]" />}
                </button>
              ))}
            </div>
            <div className="font-mono-data border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-bold tabular-nums text-white">{clock}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        {/* Cockpit rail: championship + servers + telemetry */}
        <aside className="space-y-3 lg:sticky lg:top-4">
          <div className="flex border border-white/10">
            {CHAMPIONSHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setChampionship(c.id)
                  setSelectedServer(c.servers[0])
                }}
                className={`relative flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  championship === c.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {c.label}
                {championship === c.id && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#4ea1ff] shadow-[0_0_8px_rgba(78,161,255,0.9)]" />}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {activeServers.map((server, idx) => {
              const info = serverStatus[serverStatusKey(championship, server)]
              const live = isServerLive(info)
              const isSelected = server === selectedServer
              return (
                <button
                  key={server}
                  type="button"
                  onClick={() => setSelectedServer(server)}
                  className={`flex w-full items-center gap-3 border bg-[#060a12] px-3 py-2.5 text-left transition-colors ${
                    isSelected ? 'border-[#4ea1ff]' : 'border-white/10 hover:border-white/25'
                  }`}
                  style={{ boxShadow: `inset 3px 0 0 0 ${live ? '#10b981' : '#f43f5e'}${isSelected ? ', 0 0 16px rgba(78,161,255,0.35)' : ''}` }}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono-data text-xs font-bold text-white">{String(idx + 1).padStart(2, '0')} | RSX</p>
                    <p className={`truncate text-[10px] font-bold uppercase tracking-wider ${live ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {live ? (info?.Track || t.statusOnline) : t.statusOffline}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Telemetry readouts */}
          <div className="hud-corners grid grid-cols-2 gap-[1px] overflow-hidden border border-white/10 bg-white/10">
            <Stat label={t.track} value={data?.Track || '—'} span />
            <Stat label={t.air} value={data?.AmbientTemp != null ? `${data.AmbientTemp}°` : '—'} className="text-amber-400" />
            <Stat label={t.trackTemp} value={data?.RoadTemp != null ? `${data.RoadTemp}°` : '—'} className="text-orange-500" />
            <Stat label={t.sessionTime} value={formatSeconds(timeLeft)} span />
            <div className="col-span-2 flex items-center justify-between bg-[#060a12] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{t.server}</p>
                <p className="truncate font-mono-data text-[11px] font-bold text-slate-300">{data?.ServerName || t.serverConnecting}</p>
              </div>
              <span
                className={`ml-2 flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  status === 'online' ? 'text-emerald-400' : status === 'offline' ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {status === 'online' ? <Signal className="h-3 w-3" /> : <SignalZero className="h-3 w-3" />}
                {status === 'online' ? t.statusOnline : status === 'offline' ? t.statusOffline : t.statusConnecting}
              </span>
            </div>
          </div>
        </aside>

        {/* Leaderboard */}
        <div className="min-w-0 overflow-hidden border border-white/10 bg-[#060a12]">
          <div className="flex flex-wrap gap-1.5 border-b border-white/10 bg-[#060a12] px-4 py-2.5">
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

          <div className="overflow-x-auto">
            {tab === 'live' ? (
              <table className="w-full min-w-[1100px] border-collapse text-left text-[11px] font-mono-data whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <Th sortKey="Position" className="w-10 text-center">{t.col.pos}</Th>
                    <Th sortKey="Class" className="w-16 text-center">{t.col.cls}</Th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.classPos}</th>
                    <Th sortKey="Number" className="w-12 text-center">{t.col.number}</Th>
                    <Th sortKey="Driver">{t.col.driverCar}</Th>
                    <Th sortKey="Team">{t.col.team}</Th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.tyre}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.gap}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#4ea1ff]">{t.col.interval}</th>
                    <Th sortKey="BestLap" className="text-right">{t.col.best}</Th>
                    <th className="bg-[#060a12] border-b border-white/10 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">S1</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">S2</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">S3</th>
                    <Th sortKey="LastLap" className="text-right">{t.col.last}</Th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.longPits}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.normalPits}</th>
                    <Th sortKey="Laps" className="text-center">{t.col.laps}</Th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.lastPit}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-orange-400">{t.col.stint}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.state}</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRows.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="px-4 py-14 text-center text-xs text-slate-600">
                        {t.noDrivers}
                      </td>
                    </tr>
                  ) : (
                    liveRows.map((d) => {
                      const info = d.CarInfo || {}
                      const stats = getCarStats(d)
                      const cls = getClassTagFromModel(info.CarModel)
                      classCounters[cls] = (classCounters[cls] || 0) + 1
                      const classPos = classCounters[cls]

                      let interval = '-'
                      const splitStr = d.Split || ''
                      if (d.Position === 1) {
                        interval = '-'
                        prevGap = 0
                      } else if (splitStr.toUpperCase().includes('L')) {
                        interval = splitStr
                      } else {
                        const gapVal = parseGapSeconds(splitStr)
                        if (gapVal != null) {
                          const diff = Math.max(0, gapVal - prevGap)
                          interval = `+${diff.toFixed(3)}`
                          prevGap = gapVal
                        } else {
                          interval = splitStr || '-'
                        }
                      }

                      const longPits = d.NumLongPits || 0
                      const normalPits = Math.max(0, (d.NumPits || 0) - longPits)
                      const stintMs = info.DriverGUID ? stints[info.DriverGUID] || 0 : 0

                      const isPodium = d.Position <= 3
                      return (
                        <tr
                          key={`${info.DriverGUID || info.DriverName}-${d.Position}`}
                          className="border-t border-white/[0.04] transition-colors odd:bg-white/[0.012] hover:bg-[#4ea1ff]/[0.06]"
                          style={{ boxShadow: `inset 3px 0 0 0 ${CLASS_COLORS[cls] || '#334155'}` }}
                        >
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-flex h-6 w-6 items-center justify-center font-display-league text-sm ${isPodium ? POS_CHIP[d.Position] : 'text-white'}`}>
                              {d.Position}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <ClassBadge classTag={cls} />
                          </td>
                          <td className="px-2 py-2 text-center text-slate-400">{classPos}</td>
                          <td className="px-2 py-2 text-center font-display-league text-sm text-[#4ea1ff]">{info.RaceNumber || '0'}</td>
                          <td className="px-2 py-2">
                            <div className="max-w-[160px] truncate text-[11px] font-bold text-white">{info.DriverName || '-'}</div>
                            <div className="max-w-[160px] truncate text-[9px] uppercase text-slate-500">{info.CarName || info.CarModel || '-'}</div>
                          </td>
                          <td className="max-w-[180px] truncate px-2 py-2 text-[11px] font-bold uppercase text-slate-400">{info.TeamName || '-'}</td>
                          <td className="px-2 py-2 text-center text-amber-400">{info.Tyres || '-'}</td>
                          <td className="px-2 py-2 text-right text-slate-400">{d.Split || '-'}</td>
                          <td className="px-2 py-2 text-right font-bold text-[#4ea1ff]">{interval}</td>
                          <td className="px-2 py-2 text-right font-bold text-white">{formatNanos(stats.BestLap)}</td>
                          <td className={`px-1 py-2 text-center ${SPLIT_TONE_CLASS[bestSplitFor(d, 0, sessionBestSplits).tone]}`}>{bestSplitFor(d, 0, sessionBestSplits).text}</td>
                          <td className={`px-1 py-2 text-center ${SPLIT_TONE_CLASS[bestSplitFor(d, 1, sessionBestSplits).tone]}`}>{bestSplitFor(d, 1, sessionBestSplits).text}</td>
                          <td className={`px-1 py-2 text-center ${SPLIT_TONE_CLASS[bestSplitFor(d, 2, sessionBestSplits).tone]}`}>{bestSplitFor(d, 2, sessionBestSplits).text}</td>
                          <td className="px-2 py-2 text-right text-slate-300">{formatNanos(stats.LastLap)}</td>
                          <td className="px-2 py-2 text-center text-slate-400">{longPits}</td>
                          <td className="px-2 py-2 text-center text-slate-500">{normalPits}</td>
                          <td className="px-2 py-2 text-center font-bold text-white">{d.TotalNumLaps || 0}</td>
                          <td className="px-2 py-2 text-center text-slate-400">{d.LastPitStop || '-'}</td>
                          <td className="px-2 py-2 text-center font-bold text-orange-400">{formatStintMs(stintMs)}</td>
                          <td className="px-2 py-2 text-center">
                            {d.IsInPits ? (
                              <span className="animate-pulse rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-400">{t.pit}</span>
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
              <table className="w-full min-w-[900px] border-collapse text-left text-[11px] font-mono-data whitespace-nowrap">
                <thead>
                  <tr>
                    <Th sortKey="Position" className="w-10 text-center">{t.col.pos}</Th>
                    <Th sortKey="Class" className="w-16 text-center">{t.col.cls}</Th>
                    <Th sortKey="Number" className="w-12 text-center">{t.col.number}</Th>
                    <Th sortKey="Driver">{t.col.driverCar}</Th>
                    <Th sortKey="Team">{t.col.team}</Th>
                    <Th sortKey="BestLap" className="text-right">{t.col.best}</Th>
                    <Th sortKey="Laps" className="text-center">{t.col.laps}</Th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-orange-400">{t.col.stint}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.longPits}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.normalPits}</th>
                    <th className="bg-[#060a12] border-b border-white/10 px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.col.lastSeen}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-14 text-center text-xs text-slate-600">
                        {t.noResults}
                      </td>
                    </tr>
                  ) : (
                    resultRows.map((d, idx) => {
                      const info = d.CarInfo || {}
                      const stats = getCarStats(d)
                      const cls = getClassTagFromModel(info.CarModel)
                      const longPits = d.NumLongPits || 0
                      const normalPits = Math.max(0, (d.NumPits || 0) - longPits)
                      const stintMs = info.DriverGUID ? stints[info.DriverGUID] || 0 : 0
                      const seen = d.LastSeen && !d.LastSeen.startsWith('0001')
                        ? new Date(d.LastSeen).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '-'

                      return (
                        <tr
                          key={`${info.DriverGUID || info.DriverName}-${idx}`}
                          className="border-t border-white/[0.04] odd:bg-white/[0.012] hover:bg-[#4ea1ff]/[0.06]"
                          style={{ boxShadow: `inset 3px 0 0 0 ${CLASS_COLORS[cls] || '#334155'}` }}
                        >
                          <td className="px-2 py-2 text-center text-slate-500">{idx + 1}</td>
                          <td className="px-2 py-2 text-center">
                            <ClassBadge classTag={cls} />
                          </td>
                          <td className="px-2 py-2 text-center font-display-league text-sm text-[#4ea1ff]">{info.RaceNumber || '0'}</td>
                          <td className="px-2 py-2">
                            <div className="text-[11px] font-bold text-white">{info.DriverName || '-'}</div>
                            <div className="text-[9px] uppercase text-slate-500">{info.CarModel || '-'}</div>
                          </td>
                          <td className="px-2 py-2 text-[11px] font-bold uppercase text-slate-400">{info.TeamName || '-'}</td>
                          <td className="px-2 py-2 text-right font-bold text-white">{formatNanos(stats.BestLap)}</td>
                          <td className="px-2 py-2 text-center font-bold text-white">{d.TotalNumLaps || 0}</td>
                          <td className="px-2 py-2 text-center font-bold text-orange-400">{formatStintMs(stintMs)}</td>
                          <td className="px-2 py-2 text-center text-slate-400">{longPits}</td>
                          <td className="px-2 py-2 text-center text-slate-500">{normalPits}</td>
                          <td className="px-2 py-2 text-right text-slate-500">{seen}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-white/10 bg-[#060a12] px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
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
    </div>
  )
}
