'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, Play, Clock } from 'lucide-react'
import { useLeagueState, League, LeagueEvent, Registration, ManagedTeam, LeagueCar, EventConfirmation } from './hooks/use-league-state'
import { LeagueBanner } from './components/league-banner'
import { LeagueRegistration } from './components/league-registration'
import { LeagueSchedule } from './components/league-schedule'
import { LeagueStandings } from './components/league-standings'
import { LeagueResults } from './components/league-results'
import { FinishRoundModal } from './components/finish-round-modal'
import { ViewResultsModal } from './components/view-results-modal'
import { LeagueEditModal } from './components/league-edit-modal'
import { updateLeagueDetailsAction, deleteLeagueAction, registerTeamAction, unregisterTeamAction, updateTeamPointsAction } from '@/app/ligas/actions'
import { saveCalendarEvent, deleteCalendarEvent } from '@/app/calendario/actions'
import { ClassBadge } from '@/components/class-badge'
import { ImagePicker } from '@/components/image-picker'
import { TimeInput24 } from '@/components/time-input-24'
import { useDictionary } from '@/lib/i18n/locale-provider'

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
}

export default function LeagueDetailPageContent({
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
  initialPointsOverrides = {}
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
    standingsIndices,
    customCarImages,
    handleCarImageUpload,
    scrollStandings,
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
    initialPointsOverrides
  })

  const handleUpdateTeamPoints = async (tag: string, teamId: string, newPoints: number) => {
    updateTeamPoints(tag, teamId, newPoints)
    try {
      const fd = new FormData()
      fd.set('leagueId', league.id)
      fd.set('classTag', tag)
      fd.set('teamId', teamId)
      fd.set('points', String(newPoints))
      fd.set('slug', league.slug)
      await updateTeamPointsAction(fd)
    } catch (err) {
      console.error('Failed to update team points:', err)
    }
  }

  // Accent color hex
  const accentHex = league.accentColor || '#1274de'

  // Modals visibility
  const [isEditLeagueOpen, setIsEditLeagueOpen] = useState(false)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [isResultsOpen, setIsResultsOpen] = useState(false)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [finishingEventData, setFinishingEventData] = useState<{ event: LeagueEvent; initialSessionType?: 'qualifying' | 'race' } | null>(null)
  const [viewingResultsEvent, setViewingResultsEvent] = useState<LeagueEvent | null>(null)

  // Edit League Form States
  const [formTitle, setFormTitle] = useState(league.title)
  const [formSlug, setFormSlug] = useState(league.slug)
  const [formSimulator, setFormSimulator] = useState(league.simulator || 'ac')
  const [formFormat, setFormFormat] = useState(league.format || 'sprint')
  const [formStatus, setFormStatus] = useState(league.status || 'open')
  const [formRegistrationMode, setFormRegistrationMode] = useState((league as any).registrationMode || 'team')
  const [formClassTags, setFormClassTags] = useState((league.classTags || []).join(', '))
  const [formStartsAt, setFormStartsAt] = useState(league.startsAt.split('T')[0])
  const [formEndsAt, setFormEndsAt] = useState(league.endsAt.split('T')[0])
  const [formClassLimits, setFormClassLimits] = useState<Record<string, number>>((league as any).classLimits || {})
  const [formRegistrationOpen, setFormRegistrationOpen] = useState(league.registrationOpen)
  const [formMaxDriversPerCar, setFormMaxDriversPerCar] = useState<number>((league as any).maxDriversPerCar ?? 4)
  const [formSlogan, setFormSlogan] = useState(league.slogan || '')
  const [formAccentColor, setFormAccentColor] = useState(accentHex)
  const [formBannerUrl, setFormBannerUrl] = useState(league.bannerUrl || '')
  const [formLogoUrl, setFormLogoUrl] = useState((league as any).logoUrl || '')
  const [isLeagueSubmitting, setIsLeagueSubmitting] = useState(false)

  // Event Form States
  const [editingEvent, setEditingEvent] = useState<LeagueEvent | null>(null)
  const [formEventTitle, setFormEventTitle] = useState('')
  const [formEventCircuit, setFormEventCircuit] = useState('')
  const [formEventCountryCode, setFormEventCountryCode] = useState('ESP')
  const [formEventColor, setFormEventColor] = useState('#00f2fe')
  const [formEventType, setFormEventType] = useState<'race' | 'qualifying' | 'time_attack'>('race')
  const [formHasQualy, setFormHasQualy] = useState(true)
  const [formQualyDate, setFormQualyDate] = useState('')
  const [formQualyStartsTime, setFormQualyStartsTime] = useState('19:30')
  const [formQualyEndsTime, setFormQualyEndsTime] = useState('20:00')
  const [formEventDate, setFormEventDate] = useState('')
  const [formEventStartsTime, setFormEventStartsTime] = useState('20:15')
  const [formEventEndsTime, setFormEventEndsTime] = useState('22:00')
  const [formEventImageUrl, setFormEventImageUrl] = useState('')
  const [formEventServerLink, setFormEventServerLink] = useState('')
  const [isEventSubmitting, setIsEventSubmitting] = useState(false)
  const [eventErrorMessage, setEventErrorMessage] = useState('')

  // Team Register Modal States
  const [selectedTeamId, setSelectedTeamId] = useState<string>(myManagedTeams[0]?.id || '')
  const [isRegSubmitting, setIsRegSubmitting] = useState(false)
  const [regErrorMessage, setRegErrorMessage] = useState('')

  // Recent results mock state
  const [recentResults] = useState<{
    round: string
    GT3: Array<{ pos: number; team: string; dorsal?: number | null; time: string; gap: string; points: number }>
    HYPERCAR: Array<{ pos: number; team: string; dorsal?: number | null; time: string; gap: string; points: number }>
  }>({
    round: 'No rounds completed yet',
    GT3: [],
    HYPERCAR: []
  })

  // Lock body scrolling when any modal is open to prevent double scrollbars
  useEffect(() => {
    const isAnyModalOpen = isEditLeagueOpen || isEventModalOpen || isRegisterOpen || isResultsOpen || Boolean(finishingEventData) || Boolean(viewingResultsEvent)
    if (!isAnyModalOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isEditLeagueOpen, isEventModalOpen, isRegisterOpen, isResultsOpen, finishingEventData, viewingResultsEvent])

  // Handlers
  const handleLeagueDelete = async () => {
    if (!confirm(tr.deleteLeagueConfirm)) return
    try {
      await deleteLeagueAction(league.id, league.slug)
      router.push('/ligas')
    } catch (e: any) {
      alert(e.message || tr.deleteLeagueFailed)
    }
  }

  const handleLeagueUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLeagueSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('leagueId', league.id)
      formData.set('title', formTitle)
      formData.set('slug', formSlug)
      formData.set('simulator', formSimulator)
      formData.set('format', formFormat)
      formData.set('status', formStatus)
      formData.set('registrationMode', formRegistrationMode)
      formData.set('classTags', formClassTags)
      formData.set('startsAt', formStartsAt)
      formData.set('endsAt', formEndsAt)
      formData.set('classLimitsJson', JSON.stringify(formClassLimits))
      formData.set('registrationOpen', formRegistrationOpen ? 'true' : 'false')
      formData.set('maxDriversPerCar', String(formMaxDriversPerCar))
      formData.set('slogan', formSlogan)
      formData.set('accentColor', formAccentColor)
      formData.set('bannerUrl', String(formData.get('bannerUrl') || formBannerUrl))
      formData.set('logoUrl', String(formData.get('logoUrl') || formLogoUrl))

      await updateLeagueDetailsAction(formData)
      setIsEditLeagueOpen(false)
      router.refresh()
    } catch (err: any) {
      alert(err.message || tr.updateSettingsFailed)
    } finally {
      setIsLeagueSubmitting(false)
    }
  }

  const formatLocalTimeInput = (isoStr?: string | null, fallback = '20:00') => {
    if (!isoStr) return fallback
    if (isoStr.includes('T')) {
      const timePart = isoStr.split('T')[1]?.substring(0, 5)
      if (timePart && /^\d{2}:\d{2}$/.test(timePart)) return timePart
    }
    return fallback
  }

  const formatLocalDateInput = (isoStr?: string | null, fallback = '') => {
    if (!isoStr) return fallback
    if (isoStr.includes('T')) {
      const datePart = isoStr.split('T')[0]
      if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
    }
    return fallback
  }

  const createLocalISO = (dateStr: string, timeStr: string) => {
    const d = dateStr || '2026-08-08'
    const t = timeStr || '20:00'
    return `${d}T${t}:00`
  }

  const handleOpenEventModal = (event?: LeagueEvent) => {
    if (event) {
      setEditingEvent(event)
      setFormEventTitle(event.title || '')
      setFormEventCircuit(event.circuitName || '')
      setFormEventCountryCode((event as any).countryCode || 'FRA')
      setFormEventColor((event as any).color || '#00f2fe')
      setFormEventType((event as any).eventType || 'race')
      setFormHasQualy(event.hasQualy ?? true)
      setFormQualyDate(formatLocalDateInput(event.qualyStartsAt || event.startsAt))
      setFormQualyStartsTime(formatLocalTimeInput(event.qualyStartsAt, '19:30'))
      setFormQualyEndsTime(formatLocalTimeInput(event.qualyEndsAt, '20:00'))
      setFormEventDate(formatLocalDateInput(event.startsAt))
      setFormEventStartsTime(formatLocalTimeInput(event.startsAt, '20:15'))
      setFormEventEndsTime(formatLocalTimeInput(event.endsAt, '22:00'))
      setFormEventImageUrl(event.circuitImageUrl || '')
      setFormEventServerLink(event.serverLink || '')
    } else {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      setEditingEvent(null)
      setFormEventTitle('')
      setFormEventCircuit('Circuit de la Sarthe, Le Mans')
      setFormEventCountryCode('FRA')
      setFormEventColor('#00f2fe')
      setFormEventType('race')
      setFormHasQualy(true)
      setFormQualyDate(todayStr)
      setFormQualyStartsTime('19:30')
      setFormQualyEndsTime('20:00')
      setFormEventDate(todayStr)
      setFormEventStartsTime('20:15')
      setFormEventEndsTime('22:00')
      setFormEventImageUrl('')
      setFormEventServerLink('')
    }
    setEventErrorMessage('')
    setIsEventModalOpen(true)
  }

  const handleEventSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsEventSubmitting(true)
    setEventErrorMessage('')

    try {
      const startsAtFull = createLocalISO(formEventDate, formEventStartsTime || '20:15')
      const endsAtFull = createLocalISO(formEventDate, formEventEndsTime || '22:00')
      const qualyStartsAtFull = formHasQualy ? createLocalISO(formQualyDate || formEventDate, formQualyStartsTime || '19:30') : null
      const qualyEndsAtFull = formHasQualy ? createLocalISO(formQualyDate || formEventDate, formQualyEndsTime || '20:00') : null

      const formData = new FormData(e.currentTarget)
      formData.set('leagueId', league.id)
      formData.set('circuitName', formEventCircuit || 'Circuit')
      formData.set('title', formEventTitle)
      formData.set('countryCode', formEventCountryCode)
      formData.set('color', formEventColor)
      formData.set('eventType', formEventType)
      formData.set('date', formEventDate)
      formData.set('hasQualy', formHasQualy ? 'true' : 'false')
      formData.set('qualyDate', formQualyDate || formEventDate)
      formData.set('qualyStartsAtTime', formQualyStartsTime)
      formData.set('qualyEndsAtTime', formQualyEndsTime)
      formData.set('qualyStartsAt', qualyStartsAtFull || '')
      formData.set('qualyEndsAt', qualyEndsAtFull || '')
      formData.set('startsAt', startsAtFull)
      formData.set('endsAt', endsAtFull)

      if (editingEvent) {
        formData.set('eventId', editingEvent.id)
      }

      const res = await saveCalendarEvent(formData)
      if (res && res.error) {
        setEventErrorMessage(res.error)
        return
      }

      setIsEventModalOpen(false)
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
      formData.set('classTag', classTags[0] || 'GT3')

      await registerTeamAction(formData)
      setIsRegisterOpen(false)
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

      {/* 2. Main Content Grid */}
      <section className="grid gap-4 md:grid-cols-[1.6fr_1.4fr]">
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
          onOpenEventModal={handleOpenEventModal}
          onDeleteEvent={handleEventDelete}
          onFinishRound={(ev, initialSessionType) => setFinishingEventData({ event: ev, initialSessionType })}
          onViewResults={(ev) => setViewingResultsEvent(ev)}
        />

        <LeagueStandings
          isAdmin={isAdmin}
          canEditPoints={canEditPoints}
          classTags={classTags}
          standings={standings}
          standingsIndices={standingsIndices}
          customCarImages={customCarImages}
          onScrollStandings={scrollStandings}
          onCarImageUpload={handleCarImageUpload}
          onUpdateTeamPoints={handleUpdateTeamPoints}
        />
      </section>

      {/* 4. Recent Race Results */}
      <LeagueResults
        isAdmin={isAdmin}
        recentResults={recentResults}
        classTags={classTags}
        events={events}
        onOpenResultsModal={() => setIsResultsOpen(true)}
      />

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
                <div>
                  <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">{trEvent.countryFlag}</label>
                  <select
                    value={formEventCountryCode}
                    onChange={(e) => setFormEventCountryCode(e.target.value)}
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-cyan-400 font-mono"
                  >
                    <option value="FRA">🇫🇷 France (FRA)</option>
                    <option value="ESP">🇪🇸 Spain (ESP)</option>
                    <option value="ITA">🇮🇹 Italy (ITA)</option>
                    <option value="GER">🇩🇪 Germany (GER)</option>
                    <option value="GBR">🇬🇧 United Kingdom (GBR)</option>
                    <option value="BEL">🇧🇪 Belgium (BEL)</option>
                    <option value="USA">🇺🇸 United States (USA)</option>
                    <option value="JPN">🇯🇵 Japan (JPN)</option>
                    <option value="BRA">🇧🇷 Brazil (BRA)</option>
                    <option value="ARG">🇦🇷 Argentina (ARG)</option>
                    <option value="MEX">🇲🇽 Mexico (MEX)</option>
                  </select>
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm p-4 md:p-6 flex justify-center items-start sm:items-center animate-fade-in">
          <div className="shell-panel border border-shell-line bg-[#090d16] max-w-md w-full p-5 text-white rounded-lg relative my-auto">
            <button onClick={() => setIsRegisterOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white mb-2">{trReg.title}</h2>
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{trReg.selectTeam}</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  required
                  className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg"
                >
                  {myManagedTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-shell-line/50">
                <button type="button" onClick={() => setIsRegisterOpen(false)} className="border border-shell-line px-4 py-2 text-xs font-bold uppercase">
                  {trReg.cancel}
                </button>
                <button type="submit" disabled={isRegSubmitting} className="bg-shell-accent px-5 py-2 text-xs font-bold uppercase text-white">
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
