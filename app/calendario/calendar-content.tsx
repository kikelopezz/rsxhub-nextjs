'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Calendar, Clock, Trash2, Edit2, X, Play, ChevronLeft, ChevronRight, Grid, ListFilter, Tag } from 'lucide-react'
import { saveCalendarEvent, deleteCalendarEvent, createCalendarNoteAction, deleteCalendarNoteAction } from './actions'
import { ImagePicker } from '@/components/image-picker'
import { COUNTRIES, getCountryFlagUrl } from '@/lib/countries'

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

// Darker-to-accent diagonal wash for a day cell's background — mixes the event's own
// accent color with black instead of introducing a second, unrelated color, so the
// gradient stays inside the site's existing palette instead of inventing a new one.
function eventCellGradient(hex: string) {
  let c = (hex || '#1274de').trim().replace('#', '')
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('')
  if (c.length !== 6) c = '1274de'
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const darken = (amount: number) => `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`
  return `linear-gradient(135deg, ${darken(0.55)} 0%, #${c} 100%)`
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
  color?: string | null
  maxDrivers?: number | null
  skinsDeadline?: string | null
  entriesDeadline?: string | null
  classLimits?: Record<string, number> | null
}

type League = {
  id: string
  title: string
  slug: string
  simulator?: string
  simulatorLogoUrl?: string | null
  registrationOpen?: boolean
  accentColor?: string | null
  logoUrl?: string | null
}

const EVENT_TYPE_DISPLAY_LABEL: Record<'RACE' | 'QUALIFYING' | 'TIME ATTACK', string> = {
  RACE: 'RACE DAY',
  QUALIFYING: 'QUALIFYING',
  'TIME ATTACK': 'TIME ATTACK',
}

type CalendarNote = {
  id: string
  title: string
  date: string
}

type Props = {
  initialEvents: LeagueEvent[]
  initialNotes: CalendarNote[]
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

function getEventColor(event: LeagueEvent, league?: League) {
  // The championship's own color wins so every race/qualy day lights up consistently
  // (ERC = blue, ERC Next Gen = orange); the per-event color is only a fallback.
  return league?.accentColor || event.color || '#4ea1ff'
}

function getSimLogo(league?: League) {
  if (league?.simulatorLogoUrl) return league.simulatorLogoUrl
  return league?.simulator === 'ac' ? '/branding/ACLogo.png' : '/branding/LMULogo.png'
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

// One calendar day box. A day with only an event, or only a note, renders that single
// full-size face. A day with both carousels between them every 20s instead of cramming
// both into the same box — a stable component (not an inline function in the parent's
// render) so its interval survives the parent's own periodic re-renders (the countdown
// clock ticks every 30s).
function DayCell({
  date,
  dayEvents,
  dayNotes,
  isAdmin,
  isToday,
  inCurrentMonth,
  leagueById,
  formatTime,
  onCellClick,
  onEventNavigate,
}: {
  date: Date
  dayEvents: LeagueEvent[]
  dayNotes: CalendarNote[]
  isAdmin: boolean
  isToday: boolean
  inCurrentMonth: boolean
  leagueById: Map<string, League>
  formatTime: (iso: string) => string
  onCellClick: () => void
  onEventNavigate: (event: LeagueEvent, league?: League) => void
}) {
  const shownEvents = dayEvents.slice(0, 2)
  const extraCount = dayEvents.length - shownEvents.length
  const hasEvents = shownEvents.length > 0
  const hasNotes = dayNotes.length > 0
  const isCarousel = hasEvents && hasNotes
  const glowColor = hasEvents ? getEventColor(shownEvents[0], leagueById.get(shownEvents[0].leagueId)) : null
  const glowStyle = glowColor
    ? { boxShadow: `inset 0 0 0 2px ${glowColor}, 0 0 20px ${hexToRgba(glowColor, 0.55)}` }
    : undefined

  const [showNote, setShowNote] = useState(false)
  useEffect(() => {
    if (!isCarousel) {
      setShowNote(false)
      return
    }
    const id = setInterval(() => setShowNote((v) => !v), 20_000)
    return () => clearInterval(id)
  }, [isCarousel])

  if (!hasEvents && !hasNotes) {
    return (
      <div
        onClick={onCellClick}
        className={`group/cell relative flex min-h-[168px] flex-col border-b border-r border-white/10 transition-colors last:border-r-0 ${
          isAdmin ? 'cursor-pointer hover:bg-[rgba(78,161,255,.05)]' : ''
        } ${isToday ? 'z-[1] bg-[#1274de]/[0.14] shadow-[inset_0_0_0_2px_#4ea1ff,0_0_18px_rgba(78,161,255,0.45)]' : ''}`}
      >
        <div className="p-2 pb-1">
          <span className={`font-mono-data text-[11px] ${isToday ? 'font-bold text-[#4ea1ff]' : inCurrentMonth ? 'text-slate-400' : 'text-slate-700'}`}>
            {date.getUTCDate()}
          </span>
        </div>
      </div>
    )
  }

  const eventFace = (
    <div className="flex h-full flex-col">
      {shownEvents.map((event) => {
        const league = leagueById.get(event.leagueId)
        const roundName = event.title?.trim() || ''
        const color = getEventColor(event, league)
        const type = getEventType(event)
        return (
          <div
            key={event.id}
            onClick={() => onEventNavigate(event, league)}
            className="relative flex flex-1 cursor-pointer flex-col gap-1.5 overflow-hidden p-2.5 text-white transition-all hover:brightness-110"
            style={{ background: eventCellGradient(color) }}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <span className="flex h-6 min-w-[22px] items-center justify-center rounded-md bg-black/25 px-1.5 font-mono-data text-[13px] font-black text-white">
                  {date.getUTCDate()}
                </span>
                <span className="flex h-6 items-center rounded-md bg-black/25 px-1.5 text-[9.5px] font-black uppercase tracking-wide text-white">
                  {EVENT_TYPE_DISPLAY_LABEL[type]}
                </span>
                <span className="flex h-6 items-center rounded-md bg-black/25 px-1.5 font-mono-data text-[10.5px] font-bold text-white">
                  {formatTime(event.startsAt)}
                </span>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-sm">
                <Image src={getSimLogo(league)} alt="" width={18} height={18} unoptimized className="h-full w-full object-contain" />
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
              {league && (
                <p className="truncate text-[10.5px] font-black uppercase italic leading-none text-white/85">{league.title}</p>
              )}
              {roundName && (
                <p className="truncate text-[14px] font-black uppercase italic leading-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
                  {roundName}
                </p>
              )}
              <p className="truncate text-[10px] font-bold uppercase italic leading-tight text-white/80">{event.circuitName}</p>
            </div>

            {event.serverLink ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(event.serverLink!, '_blank', 'noopener,noreferrer')
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-950 transition-colors hover:bg-emerald-300"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-800" />
                Join Server
              </button>
            ) : (
              <div className="rounded-lg bg-white/10 px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-wider text-white/70">
                Ver liga
              </div>
            )}
          </div>
        )
      })}
      {extraCount > 0 && <div className="bg-black/60 px-1.5 py-0.5 text-[9px] text-slate-400">+{extraCount} more</div>}
    </div>
  )

  const noteFace = hasNotes ? (
    <div
      onClick={onCellClick}
      className="flex h-full cursor-pointer flex-col gap-1.5 overflow-hidden p-2.5 text-white"
      style={{ background: 'linear-gradient(135deg, #92400e 0%, #ea580c 100%)' }}
    >
      <div className="flex items-center gap-1">
        <span className="flex h-6 min-w-[22px] items-center justify-center rounded-md bg-black/30 px-1.5 font-mono-data text-[13px] font-black text-white">
          {date.getUTCDate()}
        </span>
        <span className="flex h-6 items-center rounded-md bg-black/30 px-1.5 text-[9.5px] font-black uppercase tracking-wide text-white">
          Nota
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden rounded-lg bg-black/15 p-2.5">
        {dayNotes.slice(0, 4).map((note) => (
          <p key={note.id} className="truncate text-[12px] font-black uppercase italic leading-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
            {note.title}
          </p>
        ))}
      </div>
    </div>
  ) : null

  if (!isCarousel) {
    return (
      <div style={glowStyle} className={`group/cell relative flex min-h-[168px] flex-col border-b border-r border-white/10 last:border-r-0 ${hasEvents ? 'z-[1]' : ''}`}>
        {hasEvents ? eventFace : noteFace}
      </div>
    )
  }

  return (
    <div style={glowStyle} className="group/cell relative z-[1] min-h-[168px] border-b border-r border-white/10 last:border-r-0">
      <div className={`absolute inset-0 transition-opacity duration-700 ${showNote ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        {eventFace}
      </div>
      <div className={`absolute inset-0 transition-opacity duration-700 ${showNote ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {noteFace}
      </div>
    </div>
  )
}

export default function CalendarContent({
  initialEvents,
  initialNotes,
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

  const [events, setEvents] = useState<LeagueEvent[]>(initialEvents)
  const [notes, setNotes] = useState<CalendarNote[]>(initialNotes)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  useEffect(() => {
    setNotes(initialNotes)
  }, [initialNotes])

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

  const notesByDay = useMemo(() => {
    const map = new Map<string, CalendarNote[]>()
    for (const note of notes) {
      const key = dateKeyUTC(new Date(note.date))
      const arr = map.get(key) || []
      arr.push(note)
      map.set(key, arr)
    }
    return map
  }, [notes])

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
  const [formCountryCode, setFormCountryCode] = useState('ES')

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
    setFormCountryCode('ES')
  }

  const handleEditClick = (clickedEvent: LeagueEvent) => {
    // "Scheduled Events" also lists a virtual qualy session (id `${realId}_qualy`,
    // see expandedSessions) so admins can see qualy start times at a glance. It isn't
    // a real LeagueEvent row — editing it directly used to submit that fake id, miss
    // the upsert's `where`, and silently create a duplicate event. Always resolve back
    // to the real round before opening the editor.
    const realId = clickedEvent.id.endsWith('_qualy') ? clickedEvent.id.slice(0, -'_qualy'.length) : clickedEvent.id
    const event = events.find((ev) => ev.id === realId) || clickedEvent

    setEditingEvent(event)
    setFormLeagueId(event.leagueId)
    setFormTitle(event.title || '')
    setFormCircuit(event.circuitName)
    setFormEventType((event.eventType as 'race' | 'qualifying' | 'time_attack') || 'race')
    setFormCountryCode(event.countryCode || 'ES')

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
    setFormCountryCode('ES')
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

    // This modal has no UI for qualy session times, round color, driver cap or
    // per-class car limits — pass through whatever the round already had so saving
    // through this simpler editor doesn't silently wipe them (saveCalendarEvent
    // treats missing fields as "unset").
    if (editingEvent) {
      formData.set('hasQualy', editingEvent.hasQualy ? 'true' : 'false')
      if (editingEvent.qualyStartsAt) formData.set('qualyStartsAt', editingEvent.qualyStartsAt)
      if (editingEvent.qualyEndsAt) formData.set('qualyEndsAt', editingEvent.qualyEndsAt)
      formData.set('color', editingEvent.color || '#00f2fe')
      if (editingEvent.maxDrivers) formData.set('maxDrivers', String(editingEvent.maxDrivers))
      if (editingEvent.skinsDeadline) formData.set('skinsDeadlineIso', editingEvent.skinsDeadline)
      if (editingEvent.entriesDeadline) formData.set('entriesDeadlineIso', editingEvent.entriesDeadline)
      for (const [tag, limit] of Object.entries(editingEvent.classLimits || {})) {
        formData.set(`max_cars_${tag}`, String(limit))
      }
    }

    try {
      const res = await saveCalendarEvent(formData)
      if (res && !res.success) {
        setErrorMessage(res.error || 'Failed to save event.')
        setIsSubmitting(false)
        return
      }
      const wasEditing = Boolean(editingEvent)

      // Paint the event immediately instead of waiting on the round-trip
      // router.refresh() needs to re-fetch and re-render the whole route —
      // the refresh still runs right after, to reconcile with the real
      // server data (real id, computed fields), but the user isn't staring
      // at a stale grid until it lands.
      const optimisticEvent: LeagueEvent = {
        id: editingEvent?.id || `optimistic-${Date.now()}`,
        leagueId: formLeagueId,
        circuitId: editingEvent?.circuitId ?? null,
        title: formTitle || null,
        circuitName: formCircuit,
        circuitImageUrl: uploadedImageUrl || null,
        serverLink: serverLinkUrl || null,
        startsAt: startsIso,
        endsAt: endsIso,
        status: editingEvent?.status || 'scheduled',
        eventType: formEventType,
        countryCode: formCountryCode,
        hasQualy: editingEvent?.hasQualy ?? false,
        qualyStartsAt: editingEvent?.qualyStartsAt ?? null,
        qualyEndsAt: editingEvent?.qualyEndsAt ?? null,
        color: editingEvent?.color ?? null,
        maxDrivers: editingEvent?.maxDrivers ?? null,
        classLimits: editingEvent?.classLimits ?? null,
      }
      setEvents((prev) =>
        wasEditing ? prev.map((ev) => (ev.id === optimisticEvent.id ? { ...ev, ...optimisticEvent } : ev)) : [...prev, optimisticEvent],
      )

      setEditingEvent(null)
      setFormTitle('')
      setFormCircuit('')
      setFormImageUrl('')
      setFormServerLink('')
      toast.success(wasEditing ? 'Event updated' : 'Event created')
      router.refresh()

      // After updating an existing event, close the manager instead of silently
      // flipping into a blank "Add Event" form — leaving it open in Add mode made
      // it easy to click "Add Event" again by mistake and create a real duplicate.
      if (wasEditing) {
        setSelectedDate(null)
      }
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
        setEvents((prev) => prev.filter((ev) => ev.id !== eventId))
        if (editingEvent?.id === eventId) {
          setEditingEvent(null)
        }
        toast.success('Event deleted')
        router.refresh()
      } catch (err: any) {
        alert(err.message || 'Failed to delete event.')
      }
    }
  }

  const activeDayKey = selectedDate ? dateKeyUTC(selectedDate) : ''
  const activeDayEvents = selectedDate ? (eventsByDay.get(activeDayKey) || []) : []
  const activeDayNotes = selectedDate ? (notesByDay.get(activeDayKey) || []) : []

  const handleAddNote = async () => {
    if (!selectedDate || !newNoteTitle.trim()) return
    setIsSavingNote(true)
    try {
      const formData = new FormData()
      formData.set('title', newNoteTitle.trim())
      formData.set('date', dateKeyUTC(selectedDate))
      const res = await createCalendarNoteAction(formData)
      if (res && !res.success) {
        alert(res.error || 'Failed to add note.')
        return
      }
      setNotes((prev) => [...prev, { id: `optimistic-${Date.now()}`, title: newNoteTitle.trim(), date: dateKeyUTC(selectedDate) }])
      setNewNoteTitle('')
      toast.success('Note added')
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Failed to add note.')
    } finally {
      setIsSavingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const formData = new FormData()
      formData.set('id', noteId)
      await deleteCalendarNoteAction(formData)
      setNotes((prev) => prev.filter((note) => note.id !== noteId))
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Failed to delete note.')
    }
  }

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
        const flagUrl = getCountryFlagUrl(country.abbr)
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
                <p className="font-mono-data mt-3 flex items-center gap-1.5 text-[11px] tracking-[0.1em] text-slate-400">
                  {flagUrl && (
                    <span className="relative h-3 w-4 shrink-0 overflow-hidden rounded-sm">
                      <Image src={flagUrl} alt="" fill className="object-cover" />
                    </span>
                  )}
                  {nextLeague ? nextLeague.title.toUpperCase() : 'RSX LEAGUE'}
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
            <div className="min-w-[1050px]">
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
                  const dayNotes = notesByDay.get(key) || []
                  const inCurrentMonth = date.getUTCMonth() === anchorDate.getUTCMonth()
                  const today = new Date()
                  const isToday = key === dateKeyUTC(today)

                  return (
                    <DayCell
                      key={key}
                      date={date}
                      dayEvents={dayEvents}
                      dayNotes={dayNotes}
                      isAdmin={isAdmin}
                      isToday={isToday}
                      inCurrentMonth={inCurrentMonth}
                      leagueById={leagueById}
                      formatTime={formatTime}
                      onCellClick={() => { if (isAdmin) handleCellClick(date) }}
                      onEventNavigate={(event, league) => {
                        if (event.serverLink) {
                          window.open(event.serverLink, '_blank', 'noopener,noreferrer')
                        } else {
                          router.push(league ? `/ligas/${league.slug}` : '/ligas')
                        }
                      }}
                    />
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
              const flagUrl = getCountryFlagUrl(country.abbr)
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
                      <h3 className="font-display-condensed flex items-center gap-1.5 text-xl font-extrabold uppercase leading-tight text-white">
                        {flagUrl && (
                          <span className="relative h-3.5 w-5 shrink-0 overflow-hidden rounded-sm">
                            <Image src={flagUrl} alt="" fill className="object-cover" />
                          </span>
                        )}
                        {event.circuitName}
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

            {editingEvent ? (
            <div>
              <h2 className="font-display-condensed text-2xl font-bold uppercase tracking-tight text-white">
                Edit Event
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
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name} ({country.code})
                      </option>
                    ))}
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
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-[#1274de] py-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-[#1f82ee] hover:shadow-[0_0_16px_rgba(78,161,255,0.5)] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Update Event'}
                  </button>
                </div>
              </form>
            </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 p-6 text-center text-slate-500">
                <Edit2 className="h-5 w-5 text-slate-600" />
                <p className="text-xs">Select an event from the list to edit it.</p>
              </div>
            )}

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

              <div className="mt-4 border-t border-white/10 pt-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black uppercase tracking-wider text-slate-300">
                  <Tag className="h-3.5 w-3.5 text-amber-400" />
                  Notes for teams
                </h3>
                <div className="mb-3 space-y-2">
                  {activeDayNotes.length === 0 ? (
                    <p className="text-xs italic text-slate-400">No notes for this day.</p>
                  ) : (
                    activeDayNotes.map((note) => (
                      <div key={note.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                        <span className="text-xs text-amber-200">{note.title}</span>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                          className="shrink-0 rounded-md border border-white/10 p-1 text-slate-400 transition-colors hover:border-rose-500 hover:text-rose-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="e.g. Skin submission deadline"
                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400/60"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={isSavingNote || !newNoteTitle.trim()}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    Add
                  </button>
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
