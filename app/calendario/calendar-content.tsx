'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, MapPin, Plus, Trash2, Edit2, X, Play, ChevronLeft, ChevronRight, Grid, ListFilter } from 'lucide-react'
import { saveCalendarEvent, deleteCalendarEvent } from './actions'
import { ImagePicker } from '@/components/image-picker'
import { getCountryFlag } from '@/lib/countries'

function hexToRgba(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return `rgba(18, 116, 222, ${alpha})`
  let c = hex.trim().replace('#', '')
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('')
  }
  if (c.length !== 6) return `rgba(18, 116, 222, ${alpha})`
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
  monthDaysStr: string[] // ISO strings for serialization
  weekDaysStr: string[]  // ISO strings for serialization
  prevMonthStr: string
  nextMonthStr: string
  prevWeekStr: string
  nextWeekStr: string
}

export default function CalendarContent({
  initialEvents,
  leagues,
  anchorDateStr,
  viewMode,
  isAdmin,
  monthDaysStr,
  weekDaysStr,
  prevMonthStr,
  nextMonthStr,
  prevWeekStr,
  nextWeekStr,
}: Props) {
  const router = useRouter()
  const anchorDate = new Date(anchorDateStr)
  const monthDays = monthDaysStr.map(s => new Date(s))
  const weekDays = weekDaysStr.map(s => new Date(s))

  const leagueById = new Map(leagues.map((league) => [league.id, league]))

  function getLeagueGradient(leagueTitle?: string, leagueSlug?: string, accentColor?: string | null, sessionType?: string) {
    if (accentColor && accentColor.startsWith('#')) {
      return `linear-gradient(to right, ${accentColor} 0%, ${accentColor}dd 55%, ${accentColor}bb 100%)`
    }

    const title = String(leagueTitle || '').toUpperCase()
    const slug = String(leagueSlug || '').toLowerCase()
    
    if (slug.includes('erc-ng') || slug.includes('nextgen') || title.includes('NEXT GEN') || title.includes('NG')) {
      // Next Gen: Smooth Coral-Red to Warm Orange Horizontal Fade (matching sample screenshot)
      return 'linear-gradient(to right, #ea384d 0%, #f96332 55%, #ff8c42 100%)'
    }
    if (slug.includes('erc') || title.includes('ERC') || title.includes('ENDURANCE REAL')) {
      // ERC: Smooth Motorsport Blue to Soft Cyan Horizontal Fade
      return 'linear-gradient(to right, #1d4ed8 0%, #2563eb 55%, #38bdf8 100%)'
    }
    // General fallback: Smooth Teal to Soft Cyan Horizontal Fade
    return 'linear-gradient(to right, #0f766e 0%, #0d9488 55%, #2dd4bf 100%)'
  }

  const [events, setEvents] = useState<LeagueEvent[]>(initialEvents)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  const expandedSessions = useMemo(() => {
    const list: LeagueEvent[] = []
    events.forEach((ev) => {
      const isQualyEnabled = ev.hasQualy === true || String(ev.hasQualy) === 'true' || Boolean(ev.hasQualy)

      // Add Qualy session if enabled
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

      // Add Main Race / Session
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
  const [formColor, setFormColor] = useState('#00f2fe')

  // Programme filter state
  const [programmeFilter, setProgrammeFilter] = useState<'all' | 'race' | 'qualifying' | 'time_attack'>('all')

  // Tracks sim-logo thumbnails that failed to load, so we can show a placeholder instead of a broken image icon
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<string>>(new Set())
  const markLogoBroken = (id: string) => setBrokenLogoIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))

  function pad(value: number) {
    return String(value).padStart(2, '0')
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
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

  function getEventType(event: LeagueEvent, league?: League): 'RACE' | 'QUALIFYING' | 'TIME ATTACK' {
    if (event.eventType === 'qualifying') return 'QUALIFYING'
    if (event.eventType === 'time_attack') return 'TIME ATTACK'
    if (event.eventType === 'race') return 'RACE'

    const title = String(event.title || '').toUpperCase()
    const circuit = String(event.circuitName || '').toUpperCase()

    if (
      title.includes('QUALIFYING') ||
      title.includes('QUALY') ||
      circuit.includes('QUALIFYING') ||
      circuit.includes('QUALY')
    ) {
      return 'QUALIFYING'
    }

    if (
      title.includes('TIME ATTACK') ||
      title.includes('HOTLAP') ||
      title.includes('TIME TRIAL') ||
      title.includes('TA ') ||
      title.includes('TA-') ||
      circuit.includes('TIME ATTACK') ||
      circuit.includes('HOTLAP')
    ) {
      return 'TIME ATTACK'
    }
    return 'RACE'
  }

  function buildCalendarUrl(view: 'month' | 'programme', date: Date) {
    return `/calendario?view=${view}&date=${dateKeyUTC(date)}`
  }

  function monthLabel(date: Date) {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  function dayLabel(date: Date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  }

  const handleCellClick = (date: Date) => {
    if (!isAdmin) return // Only admins can click to manage
    setSelectedDate(date)
    setEditingEvent(null)
    setErrorMessage('')
    // Reset form
    setFormLeagueId(leagues[0]?.id || '')
    setFormTitle('')
    setFormCircuit('')
    setFormStartsAtTime('20:00')
    setFormEndsAtTime('21:30')
    setFormImageUrl('')
    setFormServerLink('')
    setFormEventType('race')
    setFormCountryCode('ESP')
    setFormColor('#00f2fe')
  }

  const handleEditClick = (event: LeagueEvent) => {
    setEditingEvent(event)
    setFormLeagueId(event.leagueId)
    setFormTitle(event.title || '')
    setFormCircuit(event.circuitName)
    setFormEventType((event.eventType as 'race' | 'qualifying' | 'time_attack') || 'race')
    setFormCountryCode(event.countryCode || 'ESP')
    setFormColor((event as any).color || '#00f2fe')
    
    // Parse time in local timezone
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
    setFormColor('#00f2fe')
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
      // Reset form states
      setEditingEvent(null)
      setFormTitle('')
      setFormCircuit('')
      setFormImageUrl('')
      setFormServerLink('')
      router.refresh()
      // Keep modal open so they can see / add multiple events
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

  return (
    <div className="space-y-4 text-white">
      <style>{`
        @keyframes calendar-today-breath {
          0% {
            border-color: #1274de;
            box-shadow: 0 0 6px rgba(18, 116, 222, 0.45), inset 0 0 10px rgba(18, 116, 222, 0.25);
          }
          50% {
            border-color: #3b82f6;
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.95), inset 0 0 16px rgba(59, 130, 246, 0.5);
          }
          100% {
            border-color: #1274de;
            box-shadow: 0 0 6px rgba(18, 116, 222, 0.45), inset 0 0 10px rgba(18, 116, 222, 0.25);
          }
        }
        .today-breath-active {
          animation: calendar-today-breath 2s infinite ease-in-out;
          border: 2px solid #1274de !important;
        }
      `}</style>
      {/* Main Page Title Header */}
      <div className="border-b border-shell-line pb-4">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white italic flex items-center gap-3">
          <Calendar className="h-7 w-7 text-cyan-400" />
          Race Calendar
        </h1>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
          Schedule of upcoming races, endurance events, and official championship sessions.
        </p>
      </div>

      {/* 1. Header controls */}
      <section className="shell-panel p-3.5 md:p-4 rounded-none bg-gradient-to-r from-[#090d16] via-[#0d1322] to-[#090d16] border border-cyan-500/20 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Toggle View Mode: Month Grid vs Official Programme */}
          <div className="inline-flex p-1 bg-black/60 border border-white/10 rounded-none shadow-inner">
            <Link
              href={buildCalendarUrl('month', anchorDate)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-none transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] border border-cyan-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              MONTH GRID
            </Link>
            <Link
              href={buildCalendarUrl('programme', anchorDate)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-none transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'programme'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] border border-cyan-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              PROGRAMME
            </Link>
          </div>

          {/* Date Navigation Controls */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1.5 bg-black/60 p-1 border border-white/10 rounded-none">
              <Link
                href={buildCalendarUrl('month', new Date(prevMonthStr))}
                title="Previous Month"
                className="border border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Prev</span>
              </Link>
              <div className="border border-cyan-500/30 bg-cyan-950/40 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white rounded-none flex items-center gap-2 shadow-inner">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                <span>{monthLabel(anchorDate)}</span>
              </div>
              <Link
                href={buildCalendarUrl('month', new Date(nextMonthStr))}
                title="Next Month"
                className="border border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 2. Official Programme View or Month Grid View */}
      {viewMode === 'programme' ? (
        <section className="shell-panel p-6 md:p-10 rounded-none bg-gradient-to-b from-[#0a0f1d] via-[#090d18] to-[#04060b] border border-white/10 space-y-8">
          {/* Official Programme Title Banner & Filters */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#1274de] italic">OFFICIAL</p>
              <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tight text-white drop-shadow-md">
                PROGRAMME
              </h2>
            </div>

            {/* Event Format Filter Tabs: ALL, RACES, TIME ATTACK */}
            <div className="flex items-center gap-1 bg-black/40 p-1 border border-white/10 self-start md:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setProgrammeFilter('all')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors rounded-none ${
                  programmeFilter === 'all' ? 'bg-[#1274de] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ALL ({expandedSessions.filter(s => getEventType(s, leagueById.get(s.leagueId)) !== 'QUALIFYING').length})
              </button>
              <button
                type="button"
                onClick={() => setProgrammeFilter('race')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors rounded-none flex items-center gap-1.5 ${
                  programmeFilter === 'race' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🏁 RACES ({expandedSessions.filter(s => getEventType(s, leagueById.get(s.leagueId)) === 'RACE').length})
              </button>
              <button
                type="button"
                onClick={() => setProgrammeFilter('time_attack')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors rounded-none flex items-center gap-1.5 ${
                  programmeFilter === 'time_attack' ? 'bg-amber-500 text-black font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                ⏱️ TIME ATTACK ({expandedSessions.filter(s => getEventType(s, leagueById.get(s.leagueId)) === 'TIME ATTACK').length})
              </button>
            </div>
          </div>

          {/* List of Sessions in Programme Format */}
          <div className="space-y-4 max-w-4xl mx-auto">
            {(() => {
              const filteredEvents = [...expandedSessions]
                .filter((event) => {
                  const type = getEventType(event, leagueById.get(event.leagueId))
                  if (type === 'QUALIFYING') return false // El programme solo muestra RACES y TIME ATTACK
                  if (programmeFilter === 'race') return type === 'RACE'
                  if (programmeFilter === 'time_attack') return type === 'TIME ATTACK'
                  return true
                })
                .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

              if (filteredEvents.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-500 italic text-sm border border-dashed border-white/10">
                    No scheduled {programmeFilter === 'all' ? 'events' : programmeFilter === 'race' ? 'races' : 'time attack sessions'} in the programme.
                  </div>
                )
              }

              return filteredEvents.map((event) => {
                const country = getCircuitCountry(event)
                const flag = getCountryFlag(country.code)
                const league = leagueById.get(event.leagueId)
                const eventType = getEventType(event, league)
                const eventDate = new Date(event.startsAt)
                const monthName = eventDate.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }).toUpperCase()
                const dayNumber = eventDate.getUTCDate()
                const eventColor = (event as any).color || league?.accentColor || '#1274de'

                return (
                  <div
                    key={event.id}
                    className="border border-white/10 hover:border-white/25 border-l-4 bg-gradient-to-r from-[#121929]/95 via-[#18233a]/90 to-[#121929]/95 p-4 md:p-5 rounded-none transition-all duration-200 hover:brightness-110 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg group"
                    style={{ borderLeftColor: eventColor }}
                  >
                    {/* Left: Flag + Country Abbreviation */}
                    <div className="flex items-center gap-3 shrink-0">
                      {flag ? (
                        <span className="text-3xl filter drop-shadow">{flag}</span>
                      ) : null}
                      <span className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white font-mono">
                        {country.abbr}
                      </span>
                    </div>

                    {/* Middle: Circuit, Event Type Badge, Date */}
                    <div className="flex-1 space-y-1 sm:px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Event Format Badge: RACE vs QUALIFYING vs TIME ATTACK */}
                        {eventType === 'TIME ATTACK' ? (
                          <span className="border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-none flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                            ⏱️ TIME ATTACK
                          </span>
                        ) : eventType === 'QUALIFYING' ? (
                          <span className="border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-none flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                            ⚡ QUALIFYING
                          </span>
                        ) : (
                          <span className="border border-red-500/40 bg-red-500/15 text-red-300 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-none flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                            🏁 RACE
                          </span>
                        )}
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          {event.circuitName} {league ? `· ${league.title}` : ''}
                        </p>
                      </div>

                      <h3 className="text-lg md:text-2xl font-black uppercase italic tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                        {monthName} <span className="text-slate-300 font-bold text-base md:text-xl">{dayNumber}</span>
                      </h3>
                      <p className="text-xxs text-slate-400 font-mono font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3 text-cyan-400" />
                        {formatTime(event.startsAt)} GMT-4
                      </p>
                    </div>

                    {/* Right: Action Button */}
                    <div className="shrink-0 flex items-center gap-2">
                      {event.serverLink ? (
                        <a
                          href={event.serverLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-[filter] hover:brightness-125 rounded-none inline-flex items-center gap-1.5 cursor-pointer"
                          style={{ backgroundColor: '#09152b', borderColor: eventColor, boxShadow: `0 0 12px ${eventColor}4D` }}
                        >
                          <Play className="h-3 w-3 fill-current" />
                          AVAILABLE
                        </a>
                      ) : (
                        <Link
                          href={league ? `/ligas/${league.slug}` : '/ligas'}
                          className="bg-[#080d16] border px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-[filter] hover:brightness-125 rounded-none inline-flex items-center gap-1.5"
                          style={{ borderColor: `${eventColor}66` }}
                        >
                          {league?.registrationOpen ? 'AVAILABLE' : 'NOTIFY ME'}
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </section>
      ) : (
        <section className="shell-panel overflow-hidden rounded-none">
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              {/* Month Days Header */}
              <div className="grid grid-cols-7 border-b border-shell-line bg-black/40 text-center text-xs font-black uppercase tracking-wider text-slate-300 py-2.5">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="border-r border-shell-line/50 px-2 last:border-r-0 text-slate-300 font-black">
                    <span className="hidden md:inline">{day.toUpperCase()}</span>
                    <span className="md:hidden">{day.slice(0, 3).toUpperCase()}</span>
                  </div>
                ))}
              </div>

              {/* Month Days Grid Cells */}
              <div className="grid grid-cols-7">
                {monthDays.map((date) => {
                  const key = dateKeyUTC(date)
                  const dayEvents = eventsByDay.get(key) || []
                  const inCurrentMonth = date.getUTCMonth() === anchorDate.getUTCMonth()
                  const primaryEvent = dayEvents[0]
                  const today = new Date()
                  const isToday = key === dateKeyUTC(today)

                  return (
                    <div
                      key={key}
                      onClick={() => handleCellClick(date)}
                      className={`relative h-44 border-r border-b border-shell-line last:border-r-0 select-none group/cell transition-colors ${
                        inCurrentMonth ? 'bg-[#0f1521]' : 'bg-[#0b1019]'
                      } ${isToday ? 'today-breath-active z-20' : ''} ${
                        isAdmin ? 'cursor-pointer hover:bg-cyan-950/20' : ''
                      }`}
                    >
                      {/* Plus icon on hover for admin empty cells */}
                      {isAdmin && (
                        <div className="absolute right-2 top-2 z-30 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                          <Plus className="h-4 w-4 text-cyan-400 bg-black/60 p-0.5 border border-cyan-400/30" />
                        </div>
                      )}

                      {primaryEvent ? (
                        dayEvents.length > 1 ? (
                          <div className={`absolute z-10 pointer-events-auto ${isToday ? 'inset-[2px]' : 'inset-0'}`}>
                            {dayEvents.slice(0, 2).map((event, idx) => {
                              const league = leagueById.get(event.leagueId)
                              const raceTitle = event.title?.trim() || event.circuitName
                              const eventColor = (event as any).color || league?.accentColor || '#00f2fe'
                              const simLogo = league?.simulator === 'ac'
                                ? '/branding/ACLogo.png'
                                : league?.simulator === 'lmu'
                                  ? '/branding/LMULogo.png'
                                  : null
                              return (
                                <div
                                  key={event.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(league ? `/ligas/${league.slug}` : '/ligas')
                                  }}
                                  className={`absolute inset-x-0 block cursor-pointer bg-[#090d16] group/card overflow-hidden border border-shell-line/60 hover:border-cyan-400 transition-colors ${
                                    idx === 0 ? 'top-0 h-1/2 border-b border-shell-line' : 'bottom-0 h-1/2'
                                  }`}
                                  style={{
                                    borderLeftWidth: '3px',
                                    borderLeftColor: eventColor,
                                  }}
                                >
                                  <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover/card:scale-105"
                                    style={{
                                      backgroundImage: event.circuitImageUrl
                                        ? `linear-gradient(to top, rgba(9, 13, 22, 0.92) 0%, ${hexToRgba(eventColor, 0.4)} 50%, ${hexToRgba(eventColor, 0.75)} 100%), url(${event.circuitImageUrl})`
                                        : `linear-gradient(135deg, ${hexToRgba(eventColor, 0.85)} 0%, ${hexToRgba(eventColor, 0.35)} 60%, #090d16 100%)`,
                                    }}
                                  />
                                  {/* Top Bar: Time & Sim logo */}
                                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between z-10 pointer-events-none">
                                    <div className="flex items-center gap-1">
                                      {idx === 0 && <span className="text-xs font-black text-white font-mono">{date.getUTCDate()}</span>}
                                      <span className="text-[10px] font-mono font-bold bg-black/90 px-1 py-0.5 border border-white/20 text-white flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5 text-cyan-300" />
                                        {formatTime(event.startsAt)}
                                      </span>
                                    </div>
                                    {simLogo && (
                                      <div className="bg-white p-0.5 shadow-md border border-black/40 rounded-none shrink-0 flex items-center justify-center h-4.5 w-4.5">
                                        {brokenLogoIds.has(event.id) ? (
                                          <Plus className="h-3.5 w-3.5 text-slate-500" strokeWidth={3} />
                                        ) : (
                                          <img
                                            src={simLogo}
                                            alt={league?.simulator}
                                            className="h-4.5 w-auto object-contain max-w-[40px]"
                                            onError={() => markLogoBroken(event.id)}
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Bottom Details */}
                                  <div className="absolute inset-x-1.5 bottom-1 z-10 space-y-0.5">
                                    <div className="flex flex-col gap-0.5">
                                      <div>
                                        <span className="px-1 py-0.2 text-[8px] font-mono font-black uppercase bg-black/95 text-white border border-white/40 shadow-sm inline-block">
                                          {getEventType(event, league)}
                                        </span>
                                      </div>
                                      <span className="text-[9px] font-black text-white uppercase tracking-wider truncate drop-shadow block">
                                        {event.circuitName}
                                      </span>
                                    </div>
                                    <p className="line-clamp-1 text-xs font-black uppercase italic leading-tight text-white drop-shadow-md">
                                      {raceTitle}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                            {dayEvents.length > 2 ? (
                              <div className="absolute right-2 top-2 z-20 border border-white/25 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400 rounded-none shadow-md">
                                +{dayEvents.length - 2}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className={`absolute z-10 pointer-events-auto ${isToday ? 'inset-[2px]' : 'inset-0'}`}>
                            {(() => {
                              const league = leagueById.get(primaryEvent.leagueId)
                              const raceTitle = primaryEvent.title?.trim() || primaryEvent.circuitName
                              const eventColor = (primaryEvent as any).color || league?.accentColor || '#00f2fe'
                              const simLogo = league?.simulator === 'ac'
                                ? '/branding/ACLogo.png'
                                : league?.simulator === 'lmu'
                                  ? '/branding/LMULogo.png'
                                  : null
                              return (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(league ? `/ligas/${league.slug}` : '/ligas')
                                  }}
                                  className="absolute inset-0 block cursor-pointer bg-[#090d16] group/card overflow-hidden border border-shell-line/60 hover:border-cyan-400 transition-colors"
                                  style={{
                                    borderLeftWidth: '4px',
                                    borderLeftColor: eventColor,
                                  }}
                                >
                                  <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover/card:scale-105"
                                    style={{
                                      backgroundImage: primaryEvent.circuitImageUrl
                                        ? `linear-gradient(to top, rgba(9, 13, 22, 0.92) 0%, ${hexToRgba(eventColor, 0.4)} 50%, ${hexToRgba(eventColor, 0.75)} 100%), url(${primaryEvent.circuitImageUrl})`
                                        : `linear-gradient(135deg, ${hexToRgba(eventColor, 0.85)} 0%, ${hexToRgba(eventColor, 0.35)} 60%, #090d16 100%)`,
                                    }}
                                  />
                                  {/* Top Bar: Date + Time + Sim Logo */}
                                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-black text-white font-mono">{date.getUTCDate()}</span>
                                      <span className="text-[10px] font-mono font-bold bg-black/90 px-1.5 py-0.5 border border-white/20 text-white flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-cyan-300" />
                                        {formatTime(primaryEvent.startsAt)}
                                      </span>
                                    </div>

                                    {simLogo && (
                                      <div className="bg-white p-1 shadow-md border border-black/40 rounded-none shrink-0 flex items-center justify-center h-5 w-5">
                                        {brokenLogoIds.has(primaryEvent.id) ? (
                                          <Plus className="h-4 w-4 text-slate-500" strokeWidth={3} />
                                        ) : (
                                          <img
                                            src={simLogo}
                                            alt={league?.simulator}
                                            className="h-5 w-auto object-contain max-w-[48px]"
                                            onError={() => markLogoBroken(primaryEvent.id)}
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Bottom Details */}
                                  <div className="absolute inset-x-2.5 bottom-2 space-y-1 z-10">
                                    <div className="flex flex-col gap-0.5">
                                      <div>
                                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-black uppercase bg-black/95 text-white border border-white/40 shadow-md inline-block">
                                          {getEventType(primaryEvent, league)}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-black text-white uppercase tracking-wider truncate drop-shadow block leading-tight">
                                        {primaryEvent.circuitName}
                                      </span>
                                    </div>

                                    <h4 className="text-sm font-extrabold text-white uppercase italic tracking-tight drop-shadow-md line-clamp-1">
                                      {raceTitle}
                                    </h4>

                                    {league && (
                                      <p className="text-[10px] font-bold text-white/90 truncate drop-shadow">
                                        {league.title}
                                      </p>
                                    )}

                                    {primaryEvent.serverLink && (
                                      <a
                                        href={primaryEvent.serverLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 bg-emerald-950/90 hover:bg-emerald-600 border border-emerald-400/60 text-white hover:text-white px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-colors rounded-none mt-0.5 shadow-md"
                                      >
                                        <Play className="h-2.5 w-2.5 fill-current text-emerald-400" />
                                        JOIN SERVER
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      ) : (
                        <p className={`p-2 text-xs font-semibold ${inCurrentMonth ? 'text-white' : 'text-slate-500'}`}>
                          {date.getUTCDate()}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. "Manage Events" Modal (Only for Admins) */}
      {isAdmin && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in">
          <div className="shell-panel border border-shell-line bg-zinc-950 max-w-4xl w-full p-5 md:p-6 text-white rounded-none shadow-[0_0_50px_rgba(0,0,0,0.8)] relative grid md:grid-cols-[1.1fr_0.9fr] gap-6">
            
            {/* Left side: Form for Add / Edit */}
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white mb-1">
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300 rounded-none">
                    {errorMessage}
                  </div>
                )}

                {/* League Selection */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Select League</label>
                  <select
                    value={formLeagueId}
                    onChange={(e) => setFormLeagueId(e.target.value)}
                    required
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-cyan-400"
                  >
                    {leagues.map((lg) => (
                      <option key={lg.id} value={lg.id}>
                        {lg.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Event Title */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Event Title / Session</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Round 1, Incident Review, Briefing (Optional)"
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-cyan-400"
                  />
                </div>

                {/* Circuit Name Text Input */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Circuit Name (Nombre del Circuito)</label>
                  <input
                    type="text"
                    value={formCircuit}
                    onChange={(e) => setFormCircuit(e.target.value)}
                    placeholder="e.g. Spa-Francorchamps, Monza, Imola, Nürburgring..."
                    required
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-cyan-400 font-semibold"
                  />
                </div>

                {/* Country Flag Selection */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Country Flag (País / Bandera)</label>
                  <select
                    value={formCountryCode}
                    onChange={(e) => setFormCountryCode(e.target.value)}
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-cyan-400 font-mono"
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

                {/* Event Format: Race vs Qualifying vs Time Attack */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Event Format</label>
                  <select
                    value={formEventType}
                    onChange={(e) => setFormEventType(e.target.value as 'race' | 'qualifying' | 'time_attack')}
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-cyan-400"
                  >
                    <option value="race">🏁 Race (Carrera)</option>
                    <option value="qualifying">⚡ Qualifying (Clasificación)</option>
                    <option value="time_attack">⏱️ Time Attack (Hotlap)</option>
                  </select>
                </div>

                {/* Round Visual Color Palette Selection */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Round Visual Color (Color Palette)</label>
                  <div className="space-y-2 bg-black/40 p-2.5 border border-shell-line">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { name: 'Neon Cyan', hex: '#00f2fe' },
                        { name: 'Racing Red', hex: '#ff3b30' },
                        { name: 'Electric Blue', hex: '#1274de' },
                        { name: 'Emerald Green', hex: '#10b981' },
                        { name: 'Hyper Orange', hex: '#ff6b00' },
                        { name: 'Neon Purple', hex: '#a855f7' },
                        { name: 'Gold Amber', hex: '#f59e0b' },
                      ].map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setFormColor(color.hex)}
                          title={color.name}
                          className={`h-6 w-6 rounded-none transition-transform border cursor-pointer ${
                            formColor.toLowerCase() === color.hex.toLowerCase()
                              ? 'scale-125 border-white ring-2 ring-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.6)] z-10'
                              : 'border-white/20 hover:scale-110'
                          }`}
                          style={{ backgroundColor: color.hex }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">Custom:</span>
                      <input
                        type="text"
                        name="color"
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="w-28 border border-shell-line bg-black/60 px-2 py-0.5 text-xs text-white font-mono outline-none rounded-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Time range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Starts At (Local Time)</label>
                    <input
                      type="time"
                      value={formStartsAtTime}
                      onChange={(e) => setFormStartsAtTime(e.target.value)}
                      required
                      className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Ends At (Local Time)</label>
                    <input
                      type="time"
                      value={formEndsAtTime}
                      onChange={(e) => setFormEndsAtTime(e.target.value)}
                      required
                      className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Circuit Image Upload */}
                <div>
                  <ImagePicker
                    name="circuitImageUrl"
                    defaultValue={formImageUrl}
                    label="Circuit Banner Image (PNG/JPG/WebP - compressed automatically)"
                  />
                </div>

                {/* Server Entry Link */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">Server Entry Link (Direct Connection)</label>
                  <input
                    type="text"
                    name="serverLink"
                    value={formServerLink}
                    onChange={(e) => setFormServerLink(e.target.value)}
                    placeholder="e.g. steam://connect/12.34.56.78:27015 or direct web link"
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-none focus:border-white/30"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 pt-2">
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="border border-shell-line bg-transparent hover:bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-none"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-shell-accent hover:bg-red-700 disabled:opacity-50 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-colors"
                  >
                    {isSubmitting ? 'Saving...' : editingEvent ? 'Update Event' : 'Add Event'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right side: List of Current Events on selected date */}
            <div className="flex flex-col border-l border-shell-line/50 pl-6 h-full justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-3 pb-1.5 border-b border-shell-line/40">
                  Scheduled Events ({activeDayEvents.length})
                </h3>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {activeDayEvents.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No events scheduled for this day.</p>
                  ) : (
                    activeDayEvents.map((ev) => {
                      const lg = leagueById.get(ev.leagueId)
                      const startsTime = new Date(ev.startsAt)
                      return (
                        <div key={ev.id} className="border border-shell-line bg-black/30 p-2.5 rounded-none flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xxs uppercase tracking-wider text-cyan-400 font-extrabold leading-tight">
                              {lg?.title || 'League Event'}
                            </p>
                            <p className="text-xs font-bold text-white truncate mt-0.5">{ev.title || ev.circuitName}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono flex items-center gap-1">
                              <Clock className="h-3 w-3 text-cyan-400" />
                              {formatTime(ev.startsAt)} (Local)
                            </p>
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditClick(ev)}
                              title="Edit Event"
                              className="border border-slate-600 hover:border-cyan-400 p-1 text-slate-400 hover:text-cyan-400 transition-colors rounded-none"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(ev.id)}
                              title="Delete Event"
                              className="border border-slate-600 hover:border-rose-500 p-1 text-slate-400 hover:text-rose-500 transition-colors rounded-none"
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

              {/* Close Modal button */}
              <button
                onClick={() => setSelectedDate(null)}
                className="mt-6 border border-slate-600 hover:bg-white/5 py-2 text-xs font-bold uppercase tracking-wider rounded-none text-center w-full"
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
