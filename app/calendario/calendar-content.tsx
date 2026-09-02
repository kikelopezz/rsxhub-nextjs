'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Plus, Trash2, Edit2, X, Play, ChevronLeft, ChevronRight, Grid, ListFilter } from 'lucide-react'
import { saveCalendarEvent, deleteCalendarEvent } from './actions'
import { ImagePicker } from '@/components/image-picker'
import { getCountryFlag } from '@/lib/countries'

function hexToRgba(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return `rgba(78, 161, 255, ${alpha})`
  let c = hex.trim().replace('#', '')
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('')
  }
  if (c.length !== 6) return `rgba(78, 161, 255, ${alpha})`
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

type LeagueEvent = {
  id: string
  leagueId: string
  circuitId: string | null
  title: string | null
  circuitName: string
  circuitImageUrl: string | null
  serverLink?: string | null
  startsAt: string
  endsAt: string
  status: string
  eventType?: 'race' | 'qualifying' | 'time_attack' | string | null
  countryCode?: string | null
  hasQualy?: boolean
  qualyStartsAt?: string | null
  qualyEndsAt?: string | null
}

type League = {
  id: string
  title: string
  slug: string
  simulator?: string
  registrationOpen?: boolean
  accentColor?: string | null
}

type Props = {
  initialEvents: LeagueEvent[]
  leagues: League[]
  anchorDateStr: string
  viewMode: 'month' | 'programme'
  isAdmin: boolean
  monthDaysStr: string[]
  weekDaysStr: string[]
  prevMonthStr: string
  nextMonthStr: string
  prevWeekStr: string
  nextWeekStr: string
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  RACE: '#ef4444',
  QUALIFYING: '#38bdf8',
  'TIME ATTACK': '#f59e0b',
}

export default function CalendarContent({
  initialEvents,
  leagues,
  anchorDateStr,
  viewMode,
  isAdmin,
  monthDaysStr,
  prevMonthStr,
  nextMonthStr,
}: Props) {
  const router = useRouter()
  const anchorDate = new Date(anchorDateStr)
  const monthDays = monthDaysStr.map((s) => new Date(s))

  const leagueById = new Map(leagues.map((league) => [league.id, league]))

  function getEventColor(event: LeagueEvent, league?: League) {
    return (event as any).color || league?.accentColor || '#4ea1ff'
  }

  const [events, setEvents] = useState<LeagueEvent[]>(initialEvents)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  const expandedSessions = useMemo(() => {
    const list: LeagueEvent[] = []
    events.forEach((ev) => {
      const isQualyEnabled = ev.hasQualy === true || String(ev.hasQualy) === 'true' || Boolean(ev.hasQualy)

      if (isQualyEnabled && (ev.qualyStartsAt || ev.startsAt)) {
        list.push({
          ...ev,
          id: `${ev.id}_qualy`,
          title: ev.title ? ev.title : (ev.circuitName ? ev.circuitName : 'Round Session'),
          eventType: 'qualifying',
          startsAt: ev.qualyStartsAt || ev.startsAt,
          endsAt: ev.qualyEndsAt || ev.qualyStartsAt || ev.startsAt,
        })
      }

      list.push({
        ...ev,
        eventType: ev.eventType || 'race',
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
      })
    })
    return list
  }, [events])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, LeagueEvent[]>()
    for (const session of expandedSessions) {
      const key = dateKeyUTC(new Date(session.startsAt))
      const arr = map.get(key) || []
      arr.push(session)
      map.set(key, arr)
    }
    map.forEach((arr) => {
      arr.sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || ''))
    })
    return map
  }, [expandedSessions])

  // Modal States
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingEvent, setEditingEvent] = useState<LeagueEvent | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Form states
  const [formLeagueId, setFormLeagueId] = useState(leagues[0]?.id || '')
  const [formTitle, setFormTitle] = useState('')
  const [formCircuit, setFormCircuit] = useState('')
  const [formStartsAtTime, setFormStartsAtTime] = useState('20:00')
  const [formEndsAtTime, setFormEndsAtTime] = useState('21:30')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formServerLink, setFormServerLink] = useState('')
  const [formEventType, setFormEventType] = useState<'race' | 'qualifying' | 'time_attack'>('race')
  const [formCountryCode, setFormCountryCode] = useState('ESP')
  const [formColor, setFormColor] = useState('#4ea1ff')

  // Programme filter state
  const [programmeFilter, setProgrammeFilter] = useState<'all' | 'race' | 'time_attack'>('all')

  function pad(value: number) {
    return String(value).padStart(2, '0')
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Live countdown clock for the "next session" spotlight — only ticks after mount
  // so the server render (no clock) always matches the client's first paint.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  function formatTime(startsAt: string) {
    const startsTime = new Date(startsAt)
    if (!mounted) {
      return `${pad(startsTime.getUTCHours())}:${pad(startsTime.getUTCMinutes())}`
    }
    return `${pad(startsTime.getHours())}:${pad(startsTime.getMinutes())}`
  }

  function dateKeyUTC(date: Date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  }

  function getCircuitCountry(event: LeagueEvent) {
    if (event.countryCode) {
      const abbr = event.countryCode.toUpperCase()
      return { code: abbr.slice(0, 2), abbr }
    }
    const name = String(event.circuitName || '').toLowerCase()
    if (name.includes('imola') || name.includes('monza') || name.includes('misano') || name.includes('mugello')) return { code: 'IT', abbr: 'ITA' }
    if (name.includes('spa') || name.includes('francorchamps') || name.includes('zolder')) return { code: 'BE', abbr: 'BEL' }
    if (name.includes('sao paulo') || name.includes('interlagos') || name.includes('brazil')) return { code: 'BR', abbr: 'BRA' }
    if (name.includes('cota') || name.includes('austin') || name.includes('daytona') || name.includes('sebring') || name.includes('indianapolis') || name.includes('watkins')) return { code: 'US', abbr: 'USA' }
    if (name.includes('fuji') || name.includes('suzuka') || name.includes('motegi')) return { code: 'JP', abbr: 'JPN' }
    if (name.includes('qatar') || name.includes('lusail')) return { code: 'QA', abbr: 'QAT' }
    if (name.includes('barcelona') || name.includes('catalunya') || name.includes('jerez') || name.includes('aragon') || name.includes('valencia')) return { code: 'ES', abbr: 'ESP' }
    if (name.includes('nurburgring') || name.includes('hockenheim')) return { code: 'DE', abbr: 'GER' }
    if (name.includes('silverstone') || name.includes('brands') || name.includes('donington')) return { code: 'GB', abbr: 'GBR' }
    if (name.includes('le mans') || name.includes('paul ricard') || name.includes('magny')) return { code: 'FR', abbr: 'FRA' }
    if (name.includes('portimao') || name.includes('estoril')) return { code: 'PT', abbr: 'POR' }
    if (name.includes('bahrain') || name.includes('sakhir')) return { code: 'BH', abbr: 'BHR' }
    return { code: 'ES', abbr: 'ESP' }
  }

  function getEventType(event: LeagueEvent): 'RACE' | 'QUALIFYING' | 'TIME ATTACK' {
    if (event.eventType === 'qualifying') return 'QUALIFYING'
    if (event.eventType === 'time_attack') return 'TIME ATTACK'
    if (event.eventType === 'race') return 'RACE'

    const title = String(event.title || '').toUpperCase()
    const circuit = String(event.circuitName || '').toUpperCase()

    if (title.includes('QUALIFYING') || title.includes('QUALY') || circuit.includes('QUALIFYING') || circuit.includes('QUALY')) {
      return 'QUALIFYING'
    }
    if (title.includes('TIME ATTACK') || title.includes('HOTLAP') || title.includes('TIME TRIAL') || title.includes('TA ') || title.includes('TA-') || circuit.includes('TIME ATTACK') || circuit.includes('HOTLAP')) {
      return 'TIME ATTACK'
    }
    return 'RACE'
  }

  function buildCalendarUrl(view: 'month' | 'programme', date: Date) {
    return `/calendario?view=${view}&date=${dateKeyUTC(date)}`
  }

  function monthLabel(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }

  const handleCellClick = (date: Date) => {
    if (!isAdmin) return
    setSelectedDate(date)
    setEditingEvent(null)
    setErrorMessage('')
    setFormLeagueId(leagues[0]?.id || '')
    setFormTitle('')
    setFormCircuit('')
    setFormStartsAtTime('20:00')
    setFormEndsAtTime('21:30')
    setFormImageUrl('')
    setFormServerLink('')
    setFormEventType('race')
    setFormCountryCode('ESP')
    setFormColor('#4ea1ff')
  }

  const handleEditClick = (event: LeagueEvent) => {
    setEditingEvent(event)
    setFormLeagueId(event.leagueId)
    setFormTitle(event.title || '')
    setFormCircuit(event.circuitName)
    setFormEventType((event.eventType as 'race' | 'qualifying' | 'time_attack') || 'race')
    setFormCountryCode(event.countryCode || 'ESP')
    setFormColor((event as any).color || '#4ea1ff')

    const startsDate = new Date(event.startsAt)
    const endsDate = new Date(event.endsAt)
    setSelectedDate(startsDate)
    setFormStartsAtTime(`${pad(startsDate.getHours())}:${pad(startsDate.getMinutes())}`)
    setFormEndsAtTime(`${pad(endsDate.getHours())}:${pad(endsDate.getMinutes())}`)
    setFormImageUrl(event.circuitImageUrl || '')
    setFormServerLink(event.serverLink || '')
  }

  const handleCancelEdit = () => {
    setEditingEvent(null)
    setFormLeagueId(leagues[0]?.id || '')
    setFormTitle('')
    setFormCircuit('')
    setFormStartsAtTime('20:00')
    setFormEndsAtTime('21:30')
    setFormImageUrl('')
    setFormServerLink('')
    setFormEventType('race')
    setFormCountryCode('ESP')
    setFormColor('#4ea1ff')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedDate) return
    setIsSubmitting(true)
    setErrorMessage('')

    const nativeFormData = new FormData(e.currentTarget)
    const uploadedImageUrl = String(nativeFormData.get('circuitImageUrl') || '').trim()
    const serverLinkUrl = String(nativeFormData.get('serverLink') || '').trim()

    let startsIso = ''
    let endsIso = ''
    try {
      const [year, month, day] = dateKeyUTC(selectedDate).split('-').map(Number)
      const [sHour, sMin] = formStartsAtTime.split(':').map(Number)
      const [eHour, eMin] = formEndsAtTime.split(':').map(Number)
      const localStartsDate = new Date(year, month - 1, day, sHour, sMin)
      const localEndsDate = new Date(year, month - 1, day, eHour, eMin)

      if (isNaN(localStartsDate.getTime()) || isNaN(localEndsDate.getTime())) {
        throw new Error('Invalid Date input')
      }
      startsIso = localStartsDate.toISOString()
      endsIso = localEndsDate.toISOString()
    } catch (err) {
      setErrorMessage('Invalid date or time parameters.')
      setIsSubmitting(false)
      return
    }

    const formData = new FormData()
    if (editingEvent) {
      formData.set('eventId', editingEvent.id)
    }
    formData.set('leagueId', formLeagueId)
    formData.set('title', formTitle)
    formData.set('circuitName', formCircuit)
    formData.set('date', dateKeyUTC(selectedDate))
    formData.set('startsAt', startsIso)
    formData.set('endsAt', endsIso)
    formData.set('circuitImageUrl', uploadedImageUrl)
    formData.set('serverLink', serverLinkUrl)
    formData.set('eventType', formEventType)
    formData.set('countryCode', formCountryCode)
    formData.set('color', formColor)

    try {
      const res = await saveCalendarEvent(formData)
      if (res && !res.success) {
        setErrorMessage(res.error || 'Failed to save event.')
        setIsSubmitting(false)
        return
      }
      setEditingEvent(null)
      setFormTitle('')
      setFormCircuit('')
      setFormImageUrl('')
      setFormServerLink('')
      router.refresh()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save event.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      try {
        const res = await deleteCalendarEvent(eventId)
        if (res && !res.success) {
          alert(res.error || 'Failed to delete event.')
          return
        }
        if (editingEvent?.id === eventId) {
          setEditingEvent(null)
        }
        router.refresh()
      } catch (err: any) {
        alert(err.message || 'Failed to delete event.')
      }
    }
  }

  const activeDayKey = selectedDate ? dateKeyUTC(selectedDate) : ''
  const activeDayEvents = selectedDate ? (eventsByDay.get(activeDayKey) || []) : []

  // Next upcoming session, for the spotlight strip
  const nextSession = useMemo(() => {
    const nowMs = Date.now()
    const future = expandedSessions
      .filter((s) => new Date(s.startsAt).getTime() > nowMs)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    return future[0] || null
  }, [expandedSessions])

  const nextLeague = nextSession ? leagueById.get(nextSession.leagueId) : undefined

  const countdown = useMemo(() => {
    if (!nextSession || now === null) return null
    const diff = Math.max(0, new Date(nextSession.startsAt).getTime() - now)
    return {
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff % 86_400_000) / 3_600_000),
      mins: Math.floor((diff % 3_600_000) / 60_000),
    }
  }, [nextSession, now])

  return (
    <div className="space-y-6 text-white">
      <style>{`
        @keyframes today-ring-pulse {
          0%, 100% { opacity: .55; box-shadow: 0 0 8px rgba(78,161,255,.6); transform: translate(-50%, -50%) scale(.92); }
          50% { opacity: 1; box-shadow: 0 0 16px rgba(78,161,255,.9); transform: translate(-50%, -50%) scale(1.06); }
        }
        .today-ring::after {
          content: '';
          position: absolute;
          left: 50%; top: 15px;
          width: 24px; height: 24px;
          transform: translate(-50%, -50%);
          border: 1.5px solid #4ea1ff;
          border-radius: 999px;
          pointer-events: none;
          animation: today-ring-pulse 2.2s ease-in-out infinite;
        }
      `}</style>

      {/* Page title */}
      <div className="border-b border-shell-line pb-5">
        <span className="font-mono-data text-[11px] font-medium tracking-[0.35em] text-[#4ea1ff]">
          TEMPORADA {anchorDate.getUTCFullYear()}
        </span>
        <h1 className="font-display-condensed mt-1 flex items-center gap-3 text-4xl font-extrabold uppercase tracking-tight text-white md:text-5xl">
          <Calendar className="h-7 w-7 text-[#4ea1ff]" />
          Race Calendar
        </h1>
        <p className="mt-2 max-w-xl text-xs text-slate-400 md:text-sm">
          Schedule of upcoming races, endurance events, and official championship sessions.
        </p>
      </div>

      {/* Spotlight: next session */}
      {nextSession && (() => {
        const country = getCircuitCountry(nextSession)
        const flag = getCountryFlag(country.abbr)
        const type = getEventType(nextSession)
        const typeColor = EVENT_TYPE_COLOR[type]
        const raceTitle = nextSession.title?.trim() || nextSession.circuitName

        return (
          <section className="grid overflow-hidden rounded-2xl border border-white/10 bg-[#0d1420] shadow-lg md:grid-cols-[1.1fr_0.9fr]">
            <div
              className="relative hidden min-h-[190px] overflow-hidden md:block"
              style={{
                backgroundImage: nextSession.circuitImageUrl
                  ? `linear-gradient(90deg, #0d1420 0%, rgba(13,20,32,.55) 55%, rgba(13,20,32,.15) 100%), url(${nextSession.circuitImageUrl})`
                  : `radial-gradient(600px 300px at 80% 20%, ${hexToRgba(typeColor, 0.35)}, transparent 60%), linear-gradient(160deg, #0d2038 0%, #071120 60%, #050a14 100%)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="flex flex-col justify-between gap-4 p-6 md:p-8">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#4ea1ff]" style={{ borderColor: 'rgba(78,161,255,.5)', backgroundColor: 'rgba(78,161,255,.14)' }}>
                    Próxima Sesión
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest"
                    style={{ borderColor: `${typeColor}66`, backgroundColor: `${typeColor}26`, color: typeColor }}
                  >
                    {type === 'RACE' ? '🏁 Race' : type === 'QUALIFYING' ? '⚡ Qualifying' : '⏱ Time Attack'}
                  </span>
                </div>
                <p className="font-mono-data mt-3 text-[11px] tracking-[0.1em] text-slate-400">
                  {flag ? `${flag} ` : ''}{nextLeague ? nextLeague.title.toUpperCase() : 'RSX LEAGUE'}
                </p>
                <h2 className="font-display-condensed text-3xl font-extrabold uppercase leading-none text-white md:text-4xl">
                  {nextSession.circuitName}
                </h2>
                {raceTitle && raceTitle !== nextSession.circuitName && (
                  <p className="mt-1 text-xs text-slate-400">{raceTitle}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex gap-2">
                  {[
                    { v: countdown ? pad(countdown.days) : '--', l: 'Días' },
                    { v: countdown ? pad(countdown.hours) : '--', l: 'Horas' },
                    { v: countdown ? pad(countdown.mins) : '--', l: 'Min' },
                  ].map((box) => (
                    <div key={box.l} className="min-w-[52px] rounded-lg border border-white/10 bg-[#0a0f18] px-3 py-1.5 text-center">
                      <b className="font-mono-data block text-lg text-[#4ea1ff]">{box.v}</b>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{box.l}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={nextLeague ? `/ligas/${nextLeague.slug}` : '/ligas'}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#4ea1ff] bg-[#1274de] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_18px_rgba(78,161,255,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f82ee] hover:shadow-[0_0_24px_rgba(78,161,255,0.7)]"
                >
                  Ver Detalles →
                </Link>
              </div>
            </div>
          </section>
        )
      })()}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex gap-0.5 rounded-lg border border-white/10 bg-black/40 p-1">
          <Link
            href={buildCalendarUrl('month', anchorDate)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'month' ? 'bg-[#1274de] text-white shadow-[0_0_14px_rgba(78,161,255,0.55)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            Month Grid
          </Link>
          <Link
            href={buildCalendarUrl('programme', anchorDate)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
              viewMode === 'programme' ? 'bg-[#1274de] text-white shadow-[0_0_14px_rgba(78,161,255,0.55)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Programme
          </Link>
        </div>

        {viewMode === 'month' ? (
          <div className="flex items-center gap-3">
            <Link
              href={buildCalendarUrl('month', new Date(prevMonthStr))}
              title="Previous Month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-slate-300 transition-all hover:border-[#4ea1ff] hover:text-[#4ea1ff] hover:shadow-[0_0_14px_rgba(78,161,255,0.5)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="font-display-condensed min-w-[150px] text-center text-lg font-bold uppercase tracking-wide text-white">
              {monthLabel(anchorDate)}
            </div>
            <Link
              href={buildCalendarUrl('month', new Date(nextMonthStr))}
              title="Next Month"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-slate-300 transition-all hover:border-[#4ea1ff] hover:text-[#4ea1ff] hover:shadow-[0_0_14px_rgba(78,161,255,0.5)]"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'All' },
              { key: 'race', label: '🏁 Races' },
              { key: 'time_attack', label: '⏱ Time Attack' },
            ] as const).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setProgrammeFilter(f.key)}
                className={`rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                  programmeFilter === f.key
                    ? 'border-[#4ea1ff] bg-[rgba(78,161,255,.16)] text-[#4ea1ff]'
                    : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Month Grid or Programme */}
      {viewMode === 'month' ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f18]">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-7 border-b border-white/10">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {day.slice(0, 3)}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {monthDays.map((date) => {
                  const key = dateKeyUTC(date)
                  const dayEvents = eventsByDay.get(key) || []
                  const inCurrentMonth = date.getUTCMonth() === anchorDate.getUTCMonth()
                  const today = new Date()
                  const isToday = key === dateKeyUTC(today)
                  const shownEvents = dayEvents.slice(0, 2)
                  const extraCount = dayEvents.length - shownEvents.length

                  return (
                    <div
                      key={key}
                      onClick={() => handleCellClick(date)}
                      className={`group/cell relative min-h-[112px] border-b border-r border-white/10 p-2 transition-colors last:border-r-0 ${
                        isAdmin ? 'cursor-pointer hover:bg-[rgba(78,161,255,.05)]' : ''
                      } ${isToday ? 'today-ring bg-[rgba(78,161,255,.07)]' : ''}`}
                    >
                      {isAdmin && (
                        <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover/cell:opacity-100">
                          <Plus className="h-3.5 w-3.5 rounded border border-[#4ea1ff]/40 bg-black/60 p-0.5 text-[#4ea1ff]" />
                        </div>
                      )}

                      <span className={`font-mono-data text-[11px] ${isToday ? 'font-bold text-[#4ea1ff]' : inCurrentMonth ? 'text-slate-400' : 'text-slate-700'}`}>
                        {date.getUTCDate()}
                      </span>

                      {shownEvents.map((event) => {
                        const league = leagueById.get(event.leagueId)
                        const raceTitle = event.title?.trim() || event.circuitName
                        const color = getEventColor(event, league)
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(league ? `/ligas/${league.slug}` : '/ligas')
                            }}
                            className="mt-1.5 flex items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-[9.5px] font-bold transition-all hover:-translate-y-px"
                            style={{
                              borderColor: 'rgba(255,255,255,.12)',
                              borderLeft: `2px solid ${color}`,
                              backgroundColor: hexToRgba(color, 0.08),
                            }}
                          >
                            <span className="font-mono-data shrink-0 text-[#4ea1ff]">{formatTime(event.startsAt)}</span>
                            <span className="truncate text-white">{raceTitle}</span>
                          </div>
                        )
                      })}
                      {extraCount > 0 && (
                        <div className="mt-1 pl-1 text-[9px] text-slate-500">+{extraCount} more</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto max-w-3xl pl-7">
          <div className="absolute bottom-1.5 left-[5px] top-1.5 w-px bg-white/10" aria-hidden="true" />
          {(() => {
            const filteredEvents = [...expandedSessions]
              .filter((event) => {
                const type = getEventType(event)
                if (type === 'QUALIFYING') return false
                if (programmeFilter === 'race') return type === 'RACE'
                if (programmeFilter === 'time_attack') return type === 'TIME ATTACK'
                return true
              })
              .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

            if (filteredEvents.length === 0) {
              return (
                <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-sm italic text-slate-500">
                  No scheduled {programmeFilter === 'all' ? 'events' : programmeFilter === 'race' ? 'races' : 'time attack sessions'} in the programme.
                </div>
              )
            }

            const nowMs = Date.now()

            return filteredEvents.map((event) => {
              const country = getCircuitCountry(event)
              const flag = getCountryFlag(country.abbr)
              const league = leagueById.get(event.leagueId)
              const type = getEventType(event)
              const typeColor = EVENT_TYPE_COLOR[type]
              const eventDate = new Date(event.startsAt)
              const isPast = eventDate.getTime() < nowMs
              const dayNumber = eventDate.getUTCDate()
              const monthShort = eventDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()

              return (
                <div key={event.id} className={`relative pb-6 last:pb-0 ${isPast ? 'opacity-50' : ''}`}>
                  <span
                    className="absolute -left-7 top-4 h-2.5 w-2.5 rounded-full border-2"
                    style={{
                      borderColor: isPast ? '#5c6577' : '#4ea1ff',
                      backgroundColor: '#05070c',
                      boxShadow: isPast ? 'none' : '0 0 10px rgba(78,161,255,.6)',
                    }}
                  />
                  <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#0d1420] p-4 transition-all duration-200 hover:-translate-x-0.5 hover:border-[#4ea1ff]/70 hover:shadow-[0_0_18px_rgba(78,161,255,0.3)] sm:flex-row sm:items-center md:p-5">
                    <div className="flex w-14 shrink-0 flex-col items-center text-center sm:items-start">
                      <span className="font-display-condensed text-3xl font-extrabold leading-none text-white">{dayNumber}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{monthShort}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span
                        className="mb-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                        style={{ borderColor: `${typeColor}66`, backgroundColor: `${typeColor}26`, color: typeColor }}
                      >
                        {type === 'RACE' ? '🏁 Race' : type === 'QUALIFYING' ? '⚡ Qualifying' : '⏱ Time Attack'}
                      </span>
                      <h3 className="font-display-condensed text-xl font-extrabold uppercase leading-tight text-white">
                        {flag ? `${flag} ` : ''}{event.circuitName}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {league ? league.title : 'RSX League'} · <span className="font-mono-data">{formatTime(event.startsAt)}</span>
                      </p>
                    </div>

                    <div className="shrink-0">
                      {event.serverLink ? (
                        <a
                          href={event.serverLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#4ea1ff] bg-[rgba(78,161,255,.14)] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#4ea1ff] transition-all hover:bg-[#1274de] hover:text-white hover:shadow-[0_0_16px_rgba(78,161,255,0.6)]"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          Available
                        </a>
                      ) : (
                        <Link
                          href={league ? `/ligas/${league.slug}` : '/ligas'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:border-[#4ea1ff] hover:shadow-[0_0_14px_rgba(78,161,255,0.4)]"
                        >
                          {league?.registrationOpen ? 'Available' : 'Notify Me'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Manage Events Modal (Admins only) */}
      {isAdmin && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative grid w-full max-w-4xl gap-6 rounded-2xl border border-white/10 bg-[#0a0f18] p-6 text-white shadow-[0_0_60px_rgba(0,0,0,0.8)] md:grid-cols-[1.1fr_0.9fr] md:p-7">
            <button
              onClick={() => setSelectedDate(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <h2 className="font-display-condensed text-2xl font-bold uppercase tracking-tight text-white">
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </h2>
              <p className="mb-4 font-mono-data text-xs text-[#4ea1ff]">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {errorMessage && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                    {errorMessage}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Select League</label>
                  <select
                    value={formLeagueId}
                    onChange={(e) => setFormLeagueId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]"
                  >
                    {leagues.map((lg) => (
                      <option key={lg.id} value={lg.id}>{lg.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Event Title / Session</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Round 1, Incident Review, Briefing (Optional)"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Circuit Name</label>
                  <input
                    type="text"
                    value={formCircuit}
                    onChange={(e) => setFormCircuit(e.target.value)}
                    placeholder="e.g. Spa-Francorchamps, Monza, Imola, Nürburgring..."
                    required
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-white outline-none transition-colors focus:border-[#4ea1ff]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Country Flag</label>
                  <select
                    value={formCountryCode}
                    onChange={(e) => setFormCountryCode(e.target.value)}
                    className="font-mono-data w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]"
                  >
                    <option value="ESP">🇪🇸 España (ESP)</option>
                    <option value="ITA">🇮🇹 Italia (ITA)</option>
                    <option value="FRA">🇫🇷 Francia (FRA)</option>
                    <option value="GER">🇩🇪 Alemania (GER)</option>
                    <option value="GBR">🇬🇧 Reino Unido (GBR)</option>
                    <option value="BEL">🇧🇪 Bélgica (BEL)</option>
                    <option value="USA">🇺🇸 Estados Unidos (USA)</option>
                    <option value="JPN">🇯🇵 Japón (JPN)</option>
                    <option value="BRA">🇧🇷 Brasil (BRA)</option>
                    <option value="QAT">🇶🇦 Qatar (QAT)</option>
                    <option value="POR">🇵🇹 Portugal (POR)</option>
                    <option value="ARG">🇦🇷 Argentina (ARG)</option>
                    <option value="MEX">🇲🇽 México (MEX)</option>
                    <option value="CHI">🇨🇱 Chile (CHI)</option>
                    <option value="COL">🇨🇴 Colombia (COL)</option>
                    <option value="AUS">🇦🇺 Australia (AUS)</option>
                    <option value="NED">🇳🇱 Países Bajos (NED)</option>
                    <option value="CAN">🇨🇦 Canadá (CAN)</option>
                    <option value="AUT">🇦🇹 Austria (AUT)</option>
                    <option value="SGP">🇸🇬 Singapur (SGP)</option>
                    <option value="ARE">🇦🇪 Emiratos Árabes (ARE)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Event Format</label>
                  <select
                    value={formEventType}
                    onChange={(e) => setFormEventType(e.target.value as 'race' | 'qualifying' | 'time_attack')}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]"
                  >
                    <option value="race">🏁 Race (Carrera)</option>
                    <option value="qualifying">⚡ Qualifying (Clasificación)</option>
                    <option value="time_attack">⏱️ Time Attack (Hotlap)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Round Visual Color</label>
                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { name: 'Light Blue', hex: '#4ea1ff' },
                        { name: 'Racing Red', hex: '#ef4444' },
                        { name: 'Electric Blue', hex: '#1274de' },
                        { name: 'Emerald Green', hex: '#10b981' },
                        { name: 'Hyper Orange', hex: '#f59e0b' },
                        { name: 'Neon Purple', hex: '#a855f7' },
                        { name: 'Cyan', hex: '#38bdf8' },
                      ].map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setFormColor(color.hex)}
                          title={color.name}
                          className={`h-6 w-6 rounded-md border transition-transform ${
                            formColor.toLowerCase() === color.hex.toLowerCase()
                              ? 'z-10 scale-125 border-white shadow-[0_0_10px_rgba(78,161,255,0.7)] ring-2 ring-[#4ea1ff]'
                              : 'border-white/20 hover:scale-110'
                          }`}
                          style={{ backgroundColor: color.hex }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-data text-[10px] text-slate-400">Custom:</span>
                      <input
                        type="text"
                        name="color"
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="font-mono-data w-28 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-xs text-white outline-none focus:border-[#4ea1ff]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Starts At (Local Time)</label>
                    <input
                      type="time"
                      value={formStartsAtTime}
                      onChange={(e) => setFormStartsAtTime(e.target.value)}
                      required
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Ends At (Local Time)</label>
                    <input
                      type="time"
                      value={formEndsAtTime}
                      onChange={(e) => setFormEndsAtTime(e.target.value)}
                      required
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]"
                    />
                  </div>
                </div>

                <div>
                  <ImagePicker
                    name="circuitImageUrl"
                    defaultValue={formImageUrl}
                    label="Circuit Banner Image (PNG/JPG/WebP - compressed automatically)"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-300">Server Entry Link</label>
                  <input
                    type="text"
                    name="serverLink"
                    value={formServerLink}
                    onChange={(e) => setFormServerLink(e.target.value)}
                    placeholder="e.g. steam://connect/12.34.56.78:27015 or direct web link"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-[#1274de] py-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-[#1f82ee] hover:shadow-[0_0_16px_rgba(78,161,255,0.5)] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingEvent ? 'Update Event' : 'Add Event'}
                  </button>
                </div>
              </form>
            </div>

            <div className="flex h-full flex-col justify-between border-l border-white/10 pl-6">
              <div>
                <h3 className="mb-3 border-b border-white/10 pb-2 text-sm font-black uppercase tracking-wider text-slate-300">
                  Scheduled Events ({activeDayEvents.length})
                </h3>
                <div className="max-h-[300px] space-y-2.5 overflow-y-auto pr-1">
                  {activeDayEvents.length === 0 ? (
                    <p className="text-xs italic text-slate-400">No events scheduled for this day.</p>
                  ) : (
                    activeDayEvents.map((ev) => {
                      const lg = leagueById.get(ev.leagueId)
                      return (
                        <div key={ev.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wider text-[#4ea1ff]">
                              {lg?.title || 'League Event'}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-bold text-white">{ev.title || ev.circuitName}</p>
                            <p className="font-mono-data mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="h-3 w-3 text-[#4ea1ff]" />
                              {formatTime(ev.startsAt)} (Local)
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditClick(ev)}
                              title="Edit Event"
                              className="rounded-md border border-white/10 p-1 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(ev.id)}
                              title="Delete Event"
                              className="rounded-md border border-white/10 p-1 text-slate-400 transition-colors hover:border-rose-500 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedDate(null)}
                className="mt-6 w-full rounded-lg border border-white/10 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
