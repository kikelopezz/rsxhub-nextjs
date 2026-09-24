'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter, unstable_rethrow } from 'next/navigation'
import { toast } from 'sonner'
import { X, AlertCircle, Play, Clock, ChevronDown, Trophy, Calendar } from 'lucide-react'
import { useLeagueState, League, LeagueEvent, Registration, ManagedTeam, LeagueCar, EventConfirmation } from './hooks/use-league-state'
import { LeagueBanner } from './components/league-banner'
import { LeagueRegistration } from './components/league-registration'
import { LeagueSchedule } from './components/league-schedule'
import { LeagueStandings } from './components/league-standings'

// These three are modals only ever mounted after a click (two of them admin-only) — loading
// their code on demand instead of bundling them into every visitor's initial page load.
const FinishRoundModal = dynamic(() => import('./components/finish-round-modal').then((m) => m.FinishRoundModal), { ssr: false })
const ViewResultsModal = dynamic(() => import('./components/view-results-modal').then((m) => m.ViewResultsModal), { ssr: false })
const LeagueEditModal = dynamic(() => import('./components/league-edit-modal').then((m) => m.LeagueEditModal), { ssr: false })
import { deleteLeagueAction, registerTeamAction, unregisterTeamAction, updateTeamPointsAction, updateCarPhotoAction } from '@/app/ligas/actions'
import { saveCalendarEvent, deleteCalendarEvent } from '@/app/calendario/actions'
import { ClassBadge } from '@/components/class-badge'
import { ImagePicker } from '@/components/image-picker'
import { TimeInput24 } from '@/components/time-input-24'
import { useDictionary } from '@/lib/i18n/locale-provider'
import { utcToZonedDatetimeLocal } from '@/lib/utils'
import { COUNTRIES, getCountryFlagUrl, normalizeCountryCode } from '@/lib/countries'

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

type Props = {
  simulators?: Array<{ key: string; name: string; logoUrl: string | null }>
  league: League
  initialEvents: LeagueEvent[]
  isAdmin: boolean
  isSteward?: boolean
  canEditPoints?: boolean
  session: any
  initialRegistrations: Registration[]
  myManagedTeams: ManagedTeam[]
  leagueCars: LeagueCar[]
  teamInfo?: Record<string, { name: string; primaryColor: string | null; logoUrl: string | null }>
  initialConfirmations?: EventConfirmation[]
  initialPointsOverrides?: Record<string, number>
  initialCarPhotos?: Record<string, string>
  skinReviewStatus?: Record<string, 'pending' | 'approved' | 'rejected'>
}

export default function LeagueDetailPageContent({
  simulators = [],
  league,
  initialEvents,
  isAdmin,
  isSteward = false,
  canEditPoints = false,
  session,
  initialRegistrations,
  myManagedTeams,
  leagueCars,
  teamInfo = {},
  initialConfirmations = [],
  initialPointsOverrides = {},
  initialCarPhotos = {},
  skinReviewStatus = {}
}: Props) {
  const router = useRouter()
  const tr = useDictionary().ligas.detailPage
  const trEvent = tr.eventModal
  const trReg = tr.registerModal

  const {
    events,
    setEvents,
    confirmations,
    classTags,
    standings,
    customCarImages,
    handleCarImageUpload,
    updateTeamPoints,
    registeredCars,
    groupedRegistrations
  } = useLeagueState({
    league,
    initialEvents,
    initialRegistrations,
    myManagedTeams,
    teamInfo,
    initialConfirmations,
    initialPointsOverrides,
    initialCarPhotos
  })

  const handleUpdateTeamPoints = async (tag: string, teamId: string, carNumber: string, newPoints: number) => {
    updateTeamPoints(tag, `${teamId}_${carNumber}`, newPoints)
    try {
      const fd = new FormData()
      fd.set('leagueId', league.id)
      fd.set('classTag', tag)
      fd.set('teamId', teamId)
      fd.set('carNumber', carNumber)
      fd.set('points', String(newPoints))
      fd.set('slug', league.slug)
      await updateTeamPointsAction(fd)
    } catch (err) {
      console.error('Failed to update team points:', err)
    }
  }

  // Accent color hex
  const accentHex = league.accentColor || '#1274de'

  // Top section switcher: standings vs. schedule
  const [activeSection, setActiveSection] = useState<'standings' | 'schedule'>('standings')

  // Modals visibility
  const [isEditLeagueOpen, setIsEditLeagueOpen] = useState(false)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [finishingEventData, setFinishingEventData] = useState<{ event: LeagueEvent; initialSessionType?: 'qualifying' | 'race' } | null>(null)
  const [viewingResultsEvent, setViewingResultsEvent] = useState<LeagueEvent | null>(null)

  // Event Form States
  const [editingEvent, setEditingEvent] = useState<LeagueEvent | null>(null)
  const [formEventTitle, setFormEventTitle] = useState('')
  const [formEventCircuit, setFormEventCircuit] = useState('')
  const [formEventCountryCode, setFormEventCountryCode] = useState('ES')
  const [formEventColor, setFormEventColor] = useState('#00f2fe')
  const [formEventType, setFormEventType] = useState<'race' | 'qualifying' | 'time_attack'>('race')
  const [formHasQualy, setFormHasQualy] = useState(true)
  const [formQualyDate, setFormQualyDate] = useState('')
  const [formQualyStartsTime, setFormQualyStartsTime] = useState('19:30')
  const [formQualyEndsTime, setFormQualyEndsTime] = useState('20:00')
  const [formEventDate, setFormEventDate] = useState('')
  const [formEventStartsTime, setFormEventStartsTime] = useState('20:15')
  const [formEventEndsTime, setFormEventEndsTime] = useState('22:00')
  const [formSkinsDate, setFormSkinsDate] = useState('')
  const [formSkinsTime, setFormSkinsTime] = useState('23:59')
  const [formEntriesDate, setFormEntriesDate] = useState('')
  const [formEntriesTime, setFormEntriesTime] = useState('23:59')
  const [formEventImageUrl, setFormEventImageUrl] = useState('')
  const [formEventServerLink, setFormEventServerLink] = useState('')
  const [formEventMaxDrivers, setFormEventMaxDrivers] = useState<string>('')
  const [formEventClassLimits, setFormEventClassLimits] = useState<Record<string, string>>({})
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [isEventSubmitting, setIsEventSubmitting] = useState(false)
  const [eventErrorMessage, setEventErrorMessage] = useState('')

  // Team Register Modal States
  const [selectedTeamId, setSelectedTeamId] = useState<string>(myManagedTeams[0]?.id || '')
  const [selectedClassTag, setSelectedClassTag] = useState<string>(classTags[0] || 'GT3')
  const [isRegSubmitting, setIsRegSubmitting] = useState(false)
  const [regErrorMessage, setRegErrorMessage] = useState('')
  const selectedTeam = myManagedTeams.find((t) => t.id === selectedTeamId)

  // Lock body scrolling when any modal is open to prevent double scrollbars
  useEffect(() => {
    const isAnyModalOpen = isEditLeagueOpen || isEventModalOpen || isRegisterOpen || Boolean(finishingEventData) || Boolean(viewingResultsEvent)
    if (!isAnyModalOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isEditLeagueOpen, isEventModalOpen, isRegisterOpen, finishingEventData, viewingResultsEvent])

  // Close the country dropdown when clicking outside of it
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isCountryDropdownOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCountryDropdownOpen])

  const filteredCountries = useMemo(() => {
    const s = countrySearch.trim().toLowerCase()
    if (!s) return COUNTRIES
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s))
  }, [countrySearch])

  // Handlers
  const handleLeagueDelete = async () => {
    if (!confirm(tr.deleteLeagueConfirm)) return
    try {
      await deleteLeagueAction(league.id, league.slug)
      router.push('/ligas')
    } catch (e: any) {
      unstable_rethrow(e)
      alert(e.message || tr.deleteLeagueFailed)
    }
  }

  // Events are stored as absolute UTC instants, so re-populating the edit form has to
  // convert back through the league's own timezone (Madrid) rather than slicing the ISO
  // string directly — otherwise the modal would show the UTC hour instead of the hour the
  // admin originally typed.
  const formatLocalTimeInput = (isoStr?: string | null, fallback = '20:00') => {
    if (!isoStr) return fallback
    const zoned = utcToZonedDatetimeLocal(isoStr)
    return zoned ? zoned.split('T')[1] : fallback
  }

  const formatLocalDateInput = (isoStr?: string | null, fallback = '') => {
    if (!isoStr) return fallback
    const zoned = utcToZonedDatetimeLocal(isoStr)
    return zoned ? zoned.split('T')[0] : fallback
  }

  const handleOpenEventModal = (event?: LeagueEvent) => {
    if (event) {
      setEditingEvent(event)
      setFormEventTitle(event.title || '')
      setFormEventCircuit(event.circuitName || '')
      setFormEventCountryCode(normalizeCountryCode((event as any).countryCode) || 'FR')
      setFormEventColor((event as any).color || '#00f2fe')
      setFormEventType((event as any).eventType || 'race')
      setFormHasQualy(event.hasQualy ?? true)
      setFormQualyDate(formatLocalDateInput(event.qualyStartsAt || event.startsAt))
      setFormQualyStartsTime(formatLocalTimeInput(event.qualyStartsAt, '19:30'))
      setFormQualyEndsTime(formatLocalTimeInput(event.qualyEndsAt, '20:00'))
      setFormEventDate(formatLocalDateInput(event.startsAt))
      setFormEventStartsTime(formatLocalTimeInput(event.startsAt, '20:15'))
      setFormEventEndsTime(formatLocalTimeInput(event.endsAt, '22:00'))
      setFormSkinsDate(formatLocalDateInput(event.skinsDeadline))
      setFormSkinsTime(formatLocalTimeInput(event.skinsDeadline, '23:59'))
      setFormEntriesDate(formatLocalDateInput(event.entriesDeadline))
      setFormEntriesTime(formatLocalTimeInput(event.entriesDeadline, '23:59'))
      setFormEventImageUrl(event.circuitImageUrl || '')
      setFormEventServerLink(event.serverLink || '')
      setFormEventMaxDrivers((event as any).maxDrivers != null ? String((event as any).maxDrivers) : '')
      setFormEventClassLimits(
        Object.fromEntries(
          classTags.map((tag) => [
            tag,
            String(
              (event as any).classLimits?.[tag] ?? (league as any).classLimits?.[tag] ?? 30
            ),
          ])
        )
      )
    } else {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      setEditingEvent(null)
      setFormEventTitle('')
      setFormEventCircuit('Circuit de la Sarthe, Le Mans')
      setFormEventCountryCode('FR')
      // Defaults to the championship's own color so a new round matches its calendar
      // cells unless the admin deliberately picks a different one from the palette below.
      setFormEventColor(league.accentColor || '#4ea1ff')
      setFormEventType('race')
      setFormHasQualy(true)
      setFormQualyDate(todayStr)
      setFormQualyStartsTime('19:30')
      setFormQualyEndsTime('20:00')
      setFormEventDate(todayStr)
      setFormEventStartsTime('20:15')
      setFormEventEndsTime('22:00')
      setFormSkinsDate('')
      setFormSkinsTime('23:59')
      setFormEntriesDate('')
      setFormEntriesTime('23:59')
      setFormEventImageUrl('')
      setFormEventServerLink('')
      setFormEventMaxDrivers('')
      setFormEventClassLimits(
        Object.fromEntries(classTags.map((tag) => [tag, String((league as any).classLimits?.[tag] ?? 30)]))
      )
    }
    setEventErrorMessage('')
    setIsEventModalOpen(true)
  }

  const handleEventSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsEventSubmitting(true)
    setEventErrorMessage('')

    try {
      // The server derives startsAt/endsAt/qualyStartsAt/qualyEndsAt itself from these raw
      // date + time-of-day fields (interpreted as Spanish wall-clock time) rather than from
      // a pre-combined ISO string, so it isn't at the mercy of the Node process's own timezone.
      const formData = new FormData(e.currentTarget)
      formData.set('leagueId', league.id)
      formData.set('circuitName', formEventCircuit || 'Circuit')
      formData.set('title', formEventTitle)
      formData.set('countryCode', formEventCountryCode)
      formData.set('color', formEventColor)
      formData.set('eventType', formEventType)
      formData.set('date', formEventDate)
      formData.set('startsAtTime', formEventStartsTime || '20:15')
      formData.set('endsAtTime', formEventEndsTime || '22:00')
      formData.set('hasQualy', formHasQualy ? 'true' : 'false')
      formData.set('qualyDate', formQualyDate || formEventDate)
      formData.set('qualyStartsAtTime', formQualyStartsTime || '19:30')
      formData.set('qualyEndsAtTime', formQualyEndsTime || '20:00')
      formData.set('maxDrivers', formEventMaxDrivers)
      formData.set('skinsDeadlineDate', formSkinsDate)
      formData.set('skinsDeadlineTime', formSkinsTime || '23:59')
      formData.set('entriesDeadlineDate', formEntriesDate)
      formData.set('entriesDeadlineTime', formEntriesTime || '23:59')
      for (const tag of classTags) {
        formData.set(`max_cars_${tag}`, formEventClassLimits[tag] || '')
      }

      if (editingEvent) {
        formData.set('eventId', editingEvent.id)
      }

      const res = await saveCalendarEvent(formData)
      if (res && res.error) {
        setEventErrorMessage(res.error)
        return
      }

      setIsEventModalOpen(false)
      toast.success(editingEvent ? 'Round updated' : 'Round created')
      router.refresh()
    } catch (err: any) {
      setEventErrorMessage(err.message || tr.saveEventFailed)
    } finally {
      setIsEventSubmitting(false)
    }
  }

  const handleEventDelete = async (eventId: string) => {
    if (!confirm(tr.deleteRoundConfirm)) return
    try {
      await deleteCalendarEvent(eventId)
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId))
      toast.success('Round deleted')
      router.refresh()
    } catch (err: any) {
      alert(err.message || tr.deleteRoundFailed)
    }
  }

  const handleWithdrawTeam = async (teamId: string, classTag: string) => {
    if (!confirm(tr.withdrawConfirm.replace('{tag}', classTag))) return
    try {
      const formData = new FormData()
      formData.set('slug', league.slug || '')
      formData.set('leagueId', league.id)
      formData.set('teamId', teamId)
      formData.set('classTag', classTag)
      await unregisterTeamAction(formData)
      toast.success('Withdrawn from championship')
      router.refresh()
    } catch (e: any) {
      alert(e.message || tr.withdrawFailed)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedTeamId) return

    setIsRegSubmitting(true)
    setRegErrorMessage('')

    try {
      const formData = new FormData()
      formData.set('slug', league.slug || '')
      formData.set('leagueId', league.id)
      formData.set('teamId', selectedTeamId)
      formData.set('classTag', selectedClassTag || classTags[0] || 'GT3')

      await registerTeamAction(formData)
      setIsRegisterOpen(false)
      toast.success('Team registered')
      router.refresh()
    } catch (err: any) {
      setRegErrorMessage(err.message || tr.registerTeamFailed)
    } finally {
      setIsRegSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* 1. Header Banner */}
      <LeagueBanner
        league={league}
        accentHex={accentHex}
        isAdmin={isAdmin}
        onEditSettings={() => setIsEditLeagueOpen(true)}
        onDeleteLeague={handleLeagueDelete}
        registrationElement={
          <LeagueRegistration
            league={league}
            session={session}
            myManagedTeams={myManagedTeams}
            groupedRegistrations={groupedRegistrations}
            registeredCarsCount={registeredCars.length}
            initialRegistrations={initialRegistrations}
            onOpenRegisterModal={() => setIsRegisterOpen(true)}
            onWithdrawTeam={handleWithdrawTeam}
          />
        }
      />

      {/* 2. Section switcher — pick between standings and schedule */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-[#0d1420] p-1.5">
        <button
          type="button"
          onClick={() => setActiveSection('standings')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            activeSection === 'standings' ? 'bg-[#1274de] text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Trophy className="h-4 w-4" />
          {tr.standingsTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('schedule')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            activeSection === 'schedule' ? 'bg-[#1274de] text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Calendar className="h-4 w-4" />
          {tr.scheduleTab}
        </button>
      </div>

      {/* 3. Championship Ladder — full-width, dominant */}
      {activeSection === 'standings' && (
        <LeagueStandings
          isAdmin={isAdmin}
          canEditPoints={canEditPoints}
          classTags={classTags}
          standings={standings}
          customCarImages={customCarImages}
          onCarImageUpload={handleCarImageUpload}
          onUpdateTeamPoints={handleUpdateTeamPoints}
        />
      )}

      {/* 4. Race Trail — horizontal schedule timeline */}
      {activeSection === 'schedule' && (
        <LeagueSchedule
          league={league}
          events={events}
          isAdmin={isAdmin}
          isSteward={isSteward}
          classTags={classTags}
          confirmations={confirmations}
          initialRegistrations={initialRegistrations}
          myManagedTeams={myManagedTeams}
          teamInfo={teamInfo}
          standings={standings}
          skinReviewStatus={skinReviewStatus}
          onOpenEventModal={handleOpenEventModal}
          onDeleteEvent={handleEventDelete}
          onFinishRound={(ev, initialSessionType) => setFinishingEventData({ event: ev, initialSessionType })}
          onViewResults={(ev) => setViewingResultsEvent(ev)}
        />
      )}

      {/* View Results Modal (Read-Only for Pilots & Users) */}
      {viewingResultsEvent && (
        <ViewResultsModal
          event={viewingResultsEvent}
          leagueId={league.id}
          classTags={classTags}
          onClose={() => setViewingResultsEvent(null)}
        />
      )}

      {/* Finish Round Modal (Admin Only) */}
      {finishingEventData && (
        <FinishRoundModal
          event={finishingEventData.event}
          initialSessionType={finishingEventData.initialSessionType}
          leagueId={league.id}
          classTags={classTags}
          onClose={() => setFinishingEventData(null)}
          onSuccess={() => {
            setFinishingEventData(null)
            router.refresh()
          }}
        />
      )}

      {/* MODALS */}
      {isAdmin && (
        <LeagueEditModal
          simulators={simulators}
          league={league}
          isOpen={isEditLeagueOpen}
          onClose={() => setIsEditLeagueOpen(false)}
        />
      )}

      {isAdmin && isEventModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm p-4 md:p-6 flex justify-center items-start sm:items-center animate-fade-in">
          <div className="shell-panel border border-shell-line bg-[#090d16] max-w-4xl w-full p-5 md:p-6 text-white rounded-lg shadow-[0_0_60px_rgba(0,0,0,0.9)] relative grid md:grid-cols-[1.1fr_0.9fr] gap-6 my-auto">
            <button
              onClick={() => setIsEventModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Left side: Form for Add / Edit */}
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-white mb-1">
                {editingEvent ? trEvent.editTitle : trEvent.addTitle}
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                {trEvent.subtitle}
              </p>

              <form onSubmit={handleEventSubmit} className="space-y-4">
                {eventErrorMessage && (
                  <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300 rounded-lg">
                    {eventErrorMessage}
                  </div>
                )}

                {/* Event Title */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">{trEvent.eventTitleLabel}</label>
                  <input
                    type="text"
                    value={formEventTitle}
                    onChange={(e) => setFormEventTitle(e.target.value)}
                    placeholder={trEvent.eventTitlePlaceholder}
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-cyan-400"
                  />
                </div>

                {/* Circuit Name Text Input */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">{trEvent.circuitName}</label>
                  <input
                    type="text"
                    value={formEventCircuit}
                    onChange={(e) => setFormEventCircuit(e.target.value)}
                    placeholder={trEvent.circuitNamePlaceholder}
                    required
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-semibold"
                  />
                </div>

                {/* Country Flag Selection */}
                <div ref={countryDropdownRef} className="relative">
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">{trEvent.countryFlag}</label>
                  <button
                    type="button"
                    onClick={() => setIsCountryDropdownOpen((open) => !open)}
                    className="w-full flex items-center justify-between border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {getCountryFlagUrl(formEventCountryCode) && (
                        <span className="relative h-3.5 w-5 shrink-0 overflow-hidden rounded-sm border border-white/10">
                          <Image src={getCountryFlagUrl(formEventCountryCode)!} alt="" fill className="object-cover" />
                        </span>
                      )}
                      {(() => {
                        const selected = COUNTRIES.find((c) => c.code === formEventCountryCode)
                        return selected ? `${selected.name} (${selected.code})` : formEventCountryCode
                      })()}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isCountryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isCountryDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full border border-shell-line bg-[#090d16] rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                      <input
                        type="text"
                        autoFocus
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder={trEvent.countrySearchPlaceholder}
                        className="w-full border-b border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none font-mono"
                      />
                      <div className="max-h-44 overflow-y-auto">
                        {filteredCountries.length === 0 ? (
                          <p className="px-3 py-2 text-xs italic text-slate-500">{trEvent.countryNoResults}</p>
                        ) : (
                          filteredCountries.map((country) => {
                            const flagUrl = getCountryFlagUrl(country.code)
                            return (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  setFormEventCountryCode(country.code)
                                  setIsCountryDropdownOpen(false)
                                  setCountrySearch('')
                                }}
                                className={`flex w-full items-center gap-2 text-left px-3 py-2 text-xs font-mono cursor-pointer transition-colors ${
                                  country.code === formEventCountryCode
                                    ? 'bg-cyan-500/15 text-cyan-300'
                                    : 'text-white hover:bg-white/5'
                                }`}
                              >
                                {flagUrl && (
                                  <span className="relative h-3.5 w-5 shrink-0 overflow-hidden rounded-sm border border-white/10">
                                    <Image src={flagUrl} alt="" fill className="object-cover" />
                                  </span>
                                )}
                                {country.name} ({country.code})
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Round Visual Color Palette Selection */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">{trEvent.roundColor}</label>
                  <div className="space-y-2 bg-black/40 p-2.5 border border-shell-line">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { name: 'Neon Cyan', hex: '#00f2fe' },
                        { name: 'Racing Red', hex: '#ff3b30' },
                        { name: 'Electric Blue', hex: '#1274de' },
                        { name: 'Emerald Green', hex: '#10b981' },
                        { name: 'Hyper Orange', hex: '#ff6b00' },
                        { name: 'Neon Purple', hex: '#1f82ee' },
                        { name: 'Gold Amber', hex: '#f59e0b' },
                      ].map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setFormEventColor(color.hex)}
                          title={color.name}
                          className={`h-6 w-6 rounded-lg transition-transform border cursor-pointer ${
                            formEventColor.toLowerCase() === color.hex.toLowerCase()
                              ? 'scale-125 border-white ring-2 ring-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.6)] z-10'
                              : 'border-white/20 hover:scale-110'
                          }`}
                          style={{ backgroundColor: color.hex }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{trEvent.custom}</span>
                      <input
                        type="text"
                        name="color"
                        value={formEventColor}
                        onChange={(e) => setFormEventColor(e.target.value)}
                        className="w-28 border border-shell-line bg-black/60 px-2 py-0.5 text-xs text-white font-mono outline-none rounded-lg focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Sessions Schedule Section */}
                <div className="border border-shell-line bg-black/60 p-3 space-y-3 rounded-lg">
                  <h4 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5 border-b border-white/10 pb-2">
                    📅 {trEvent.sessionSchedules}
                  </h4>

                  {/* Qualifying Session Inputs */}
                  <div className="space-y-2 border-b border-white/10 pb-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formHasQualy}
                          onChange={(e) => setFormHasQualy(e.target.checked)}
                          className="accent-cyan-500 cursor-pointer"
                        />
                        ⏱️ {trEvent.includeQualy}
                      </label>
                    </div>

                    {formHasQualy && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">{trEvent.qualyDate}</label>
                          <input
                            type="date"
                            value={formQualyDate}
                            onChange={(e) => setFormQualyDate(e.target.value)}
                            className="w-full border border-shell-line bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono"
                          />
                        </div>
                        <TimeInput24
                          label={trEvent.qualyStarts}
                          value={formQualyStartsTime}
                          onChange={(val) => setFormQualyStartsTime(val)}
                        />
                        <TimeInput24
                          label={trEvent.qualyEnds}
                          value={formQualyEndsTime}
                          onChange={(val) => setFormQualyEndsTime(val)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Deadlines — optional, per round */}
                  <div className="space-y-2 border-b border-white/10 pb-3">
                    <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wide">
                      ⏳ {trEvent.deadlinesTitle}
                    </label>
                    {[
                      { label: trEvent.skinsDeadline, date: formSkinsDate, setDate: setFormSkinsDate, time: formSkinsTime, setTime: setFormSkinsTime },
                      { label: trEvent.entriesDeadline, date: formEntriesDate, setDate: setFormEntriesDate, time: formEntriesTime, setTime: setFormEntriesTime },
                    ].map((row) => (
                      <div key={row.label} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">{row.label}</label>
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => row.setDate(e.target.value)}
                            className="w-full border border-shell-line bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono"
                          />
                        </div>
                        <TimeInput24 label={trEvent.deadlineTime} value={row.time} onChange={(val) => row.setTime(val)} />
                        <button
                          type="button"
                          onClick={() => row.setDate('')}
                          disabled={!row.date}
                          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          {row.date ? trEvent.deadlineClear : trEvent.deadlineNone}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Race Session Inputs */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-amber-400 uppercase tracking-wide">
                      🏁 {trEvent.raceSession}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">{trEvent.raceDate}</label>
                        <input
                          type="date"
                          value={formEventDate}
                          onChange={(e) => setFormEventDate(e.target.value)}
                          required
                          className="w-full border border-shell-line bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono"
                        />
                      </div>
                      <TimeInput24
                        label={trEvent.raceStarts}
                        value={formEventStartsTime}
                        onChange={(val) => setFormEventStartsTime(val)}
                      />
                      <TimeInput24
                        label={trEvent.raceEnds}
                        value={formEventEndsTime}
                        onChange={(val) => setFormEventEndsTime(val)}
                      />
                    </div>
                  </div>
                </div>

                {/* Race Limits Section */}
                <div className="border border-shell-line bg-black/60 p-3 space-y-3 rounded-lg">
                  <h4 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5 border-b border-white/10 pb-2">
                    🏎️ {trEvent.raceLimitsTitle}
                  </h4>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">{trEvent.maxDriversLabel}</label>
                    <input
                      type="number"
                      min={1}
                      value={formEventMaxDrivers}
                      onChange={(e) => setFormEventMaxDrivers(e.target.value)}
                      placeholder={trEvent.maxDriversPlaceholder}
                      className="w-full border border-shell-line bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono"
                    />
                  </div>

                  {classTags.length > 0 && (
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">{trEvent.carsPerCategory}</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {classTags.map((tag) => (
                          <div key={tag} className="flex items-center gap-1.5">
                            <ClassBadge classTag={tag} className="text-[9px] shrink-0" />
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={formEventClassLimits[tag] ?? ''}
                              onChange={(e) =>
                                setFormEventClassLimits((prev) => ({ ...prev, [tag]: e.target.value }))
                              }
                              className="w-full border border-shell-line bg-black/40 px-2 py-1.5 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono text-center"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Circuit Image Upload */}
                <div>
                  <ImagePicker
                    name="circuitImageUrl"
                    defaultValue={formEventImageUrl}
                    label={trEvent.circuitBanner}
                  />
                </div>

                {/* Server Entry Link */}
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">{trEvent.serverLink}</label>
                  <input
                    type="text"
                    name="serverLink"
                    value={formEventServerLink}
                    onChange={(e) => setFormEventServerLink(e.target.value)}
                    placeholder={trEvent.serverLinkPlaceholder}
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 pt-2 border-t border-shell-line/50">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className="border border-shell-line bg-black/40 hover:bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 rounded-lg transition-colors"
                  >
                    {trEvent.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isEventSubmitting}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold disabled:opacity-50 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                  >
                    {isEventSubmitting ? trEvent.saving : editingEvent ? trEvent.saveUpdates : trEvent.addRound}
                  </button>
                </div>
              </form>
            </div>

            {/* Right side: Event Card Live Preview */}
            <div className="flex flex-col border-l border-shell-line/50 pl-6 h-full justify-between hidden md:flex">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 mb-3 pb-1.5 border-b border-shell-line/40">
                  {trEvent.livePreview}
                </h3>

                <div
                  className="border overflow-hidden relative group transition-all rounded-lg shadow-lg"
                  style={{ borderColor: `${formEventColor}60` }}
                >
                  <div
                    className="h-44 w-full relative overflow-hidden transition-all duration-300 flex flex-col justify-between p-3"
                    style={{
                      borderLeft: `4px solid ${formEventColor}`,
                      backgroundImage: formEventImageUrl
                        ? `linear-gradient(to top, rgba(9, 13, 22, 0.95) 0%, ${hexToRgba(formEventColor, 0.45)} 50%, ${hexToRgba(formEventColor, 0.75)} 100%), url(${formEventImageUrl})`
                        : `linear-gradient(135deg, ${hexToRgba(formEventColor, 0.85)} 0%, ${hexToRgba(formEventColor, 0.3)} 60%, #090d16 100%)`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!formEventImageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 text-white text-xs font-black uppercase tracking-widest italic">
                        <span>{formEventCircuit || trEvent.noCircuitBanner}</span>
                      </div>
                    )}
                    
                    <div className="relative z-10 space-y-1 mt-auto">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-black uppercase bg-black/95 text-white border border-white/40 shadow-md shrink-0">
                          {formEventType.toUpperCase()}
                        </span>
                        <span className="text-xs font-black text-white uppercase tracking-wider drop-shadow">
                          {formEventCircuit || trEvent.circuitNameFallback}
                        </span>
                      </div>

                      <h4 className="text-base font-extrabold text-white uppercase italic tracking-tight drop-shadow-md">
                        {formEventTitle || formEventCircuit || trEvent.roundTitleFallback}
                      </h4>

                      <div className="flex items-center gap-2 text-xs text-white font-mono font-bold pt-0.5 drop-shadow">
                        <Clock className="h-3.5 w-3.5 text-cyan-300" />
                        <span>{formEventDate} @ {formEventStartsTime}</span>
                      </div>
                    </div>
                  </div>

                  {formEventServerLink && (
                    <div className="p-3 bg-black/90 border-t border-shell-line/40 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold flex items-center gap-1">
                        <Play className="h-3 w-3 fill-current" /> {trEvent.directServerReady}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">
                        {formEventServerLink}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRegisterOpen && myManagedTeams.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:items-center md:p-6">
          <div className="relative my-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f18] p-5 text-white shadow-[0_0_60px_rgba(0,0,0,0.8)]">
            <button
              onClick={() => setIsRegisterOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-display-league mb-4 text-2xl uppercase text-white">{trReg.title}</h2>
            {regErrorMessage && (
              <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                {regErrorMessage}
              </div>
            )}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{trReg.selectTeam}</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]"
                >
                  {myManagedTeams.map((team) => (
                    <option key={team.id} value={team.id} disabled={team.status !== 'approved'}>
                      {team.name}
                      {team.status === 'pending' ? ' (pendiente de aprobación)' : team.status === 'rejected' ? ' (rechazado)' : ''}
                    </option>
                  ))}
                </select>
                {selectedTeam && selectedTeam.status !== 'approved' && (
                  <p className="mt-1.5 text-[11px] font-semibold text-amber-400">
                    {selectedTeam.status === 'rejected'
                      ? 'Este equipo ha sido rechazado y no puede inscribirse en campeonatos.'
                      : 'Este equipo todavía está pendiente de aprobación por un admin — no puede inscribirse hasta entonces.'}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{trReg.selectCategory}</label>
                <select
                  value={selectedClassTag}
                  onChange={(e) => setSelectedClassTag(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]"
                >
                  {classTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold uppercase transition-colors hover:bg-white/5"
                >
                  {trReg.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isRegSubmitting || !selectedTeam || selectedTeam.status !== 'approved'}
                  className="rounded-lg border border-[#4ea1ff] bg-[#1274de] px-5 py-2 text-xs font-bold uppercase text-white shadow-[0_0_15px_rgba(78,161,255,0.4)] transition-all hover:bg-[#1f82ee] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRegSubmitting ? trReg.registering : trReg.confirmRegistration}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
