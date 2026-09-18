'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import JSZip from 'jszip'
import { Calendar, Clock, Plus, Edit2, Trash2, Users, CheckCircle2, Trophy, Eye, Copy, Check, X, FolderDown } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { FormattedDate } from '@/components/formatted-date'
import { formatDateTime } from '@/lib/utils'
import { League, LeagueEvent, Registration, ManagedTeam, EventConfirmation, TeamStanding } from '../hooks/use-league-state'
import { confirmAttendanceAction, cancelAttendanceAction } from '@/app/ligas/actions'
import { useRouter } from 'next/navigation'
import { EventEntryListModal } from './event-entry-list-modal'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface LeagueScheduleProps {
  league: League
  events: LeagueEvent[]
  isAdmin: boolean
  isSteward?: boolean
  classTags: string[]
  confirmations: EventConfirmation[]
  initialRegistrations: Registration[]
  myManagedTeams: ManagedTeam[]
  teamInfo?: Record<string, { name: string; primaryColor: string | null; logoUrl: string | null; cars?: any[]; skinAssignments?: any[] }>
  standings?: Record<string, TeamStanding[]>
  skinReviewStatus?: Record<string, 'pending' | 'approved' | 'rejected'>
  onOpenEventModal: (event?: LeagueEvent) => void
  onDeleteEvent: (eventId: string) => void
  onFinishRound?: (event: LeagueEvent, initialSessionType?: 'qualifying' | 'race') => void
  onViewResults?: (event: LeagueEvent) => void
}

export function LeagueSchedule({
  league,
  events,
  isAdmin,
  isSteward = false,
  classTags,
  confirmations,
  initialRegistrations,
  myManagedTeams,
  teamInfo,
  standings,
  skinReviewStatus,
  onOpenEventModal,
  onDeleteEvent,
  onFinishRound,
  onViewResults,
}: LeagueScheduleProps) {
  const router = useRouter()
  const tr = useDictionary().ligas.schedule
  const [localConfirmations, setLocalConfirmations] = useState<EventConfirmation[]>(confirmations)
  const [viewingEntryListEvent, setViewingEntryListEvent] = useState<LeagueEvent | null>(null)

  const [showExpiredRounds, setShowExpiredRounds] = useState(false)
  const accent = league.accentColor || '#1274de'

  useEffect(() => {
    setLocalConfirmations(confirmations)
  }, [confirmations])

  const { activeEvents, expiredCount } = useMemo(() => {
    const now = Date.now()
    const fortyEightHoursMs = 48 * 60 * 60 * 1000

    let expired = 0
    const active = events.filter((ev) => {
      const isCompleted = (ev as any).status === 'completed'
      if (!isCompleted) return true

      const finishTime = (ev as any).completedAt
        ? new Date((ev as any).completedAt).getTime()
        : new Date(ev.endsAt || ev.startsAt).getTime()

      const isExpired = (now - finishTime) > fortyEightHoursMs
      if (isExpired) {
        expired++
        return showExpiredRounds
      }
      return true
    })

    return { activeEvents: active, expiredCount: expired }
  }, [events, showExpiredRounds])

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0d1420] p-4 md:p-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 className="font-display-league text-2xl uppercase text-white">{tr.title}</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => onOpenEventModal()}
            className="flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-[filter] hover:brightness-125"
            style={{ borderColor: `${accent}66`, backgroundColor: `${accent}26`, color: accent }}
          >
            <Plus className="h-3.5 w-3.5" />
            {tr.addRound}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400">{tr.subtitle}</p>

      <div>
        {activeEvents.length === 0 ? (
          <p className="text-sm text-slate-300">{tr.noRounds}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex px-1" style={{ minWidth: 'min-content' }}>
              {activeEvents.map((ev, index) => {
                const isCompleted = (ev as any).status === 'completed' || new Date(ev.startsAt) < new Date()

                return (
                  <div key={ev.id} className="flex w-[420px] shrink-0 flex-col px-2 first:pl-0 last:pr-0">
                    <div className="mb-3 flex shrink-0 items-center">
                      <span
                        className="font-mono-data flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold"
                        style={{ borderColor: accent, color: accent, background: '#0a0f18' }}
                      >
                        {index + 1}
                      </span>
                      {index < activeEvents.length - 1 && <div className="ml-1 h-0.5 flex-1 bg-white/10" />}
                    </div>

                    <div
                      className={`relative flex-1 space-y-3 overflow-hidden rounded-xl border p-4 transition-colors ${
                        isCompleted
                          ? 'border-white/5 bg-black/20 opacity-90'
                          : 'border-white/10 bg-black/30'
                      }`}
                      style={!isCompleted ? { borderColor: `${accent}4D` } : undefined}
                    >
                {/* Round Header */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono-data rounded border px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{ backgroundColor: `${accent}1F`, color: accent, borderColor: `${accent}55` }}
                      >
                        R{index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {ev.circuitName}
                      </span>
                      {isCompleted && (
                        <span className="font-mono-data rounded border border-emerald-800/50 bg-emerald-950 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                          {tr.completed}
                        </span>
                      )}
                    </div>

                    <h3 className="font-display-league text-xl uppercase text-white">
                      {ev.title || tr.round.replace('{n}', String(index + 1)).replace('{circuit}', ev.circuitName)}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1 font-mono">
                      {(ev.hasQualy === true || String(ev.hasQualy) === 'true' || Boolean(ev.qualyStartsAt)) && (
                        <div className="flex items-center gap-1.5 bg-black/60 border border-cyan-500/30 px-2 py-0.5">
                          <Clock className="h-3 w-3 text-cyan-400" />
                          <span className="text-[10px] text-cyan-300 font-bold uppercase">{tr.qualy}</span>
                          <span className="text-xs text-slate-200">
                            {ev.qualyStartsAt ? formatDateTime(ev.qualyStartsAt) : formatDateTime(ev.startsAt)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 bg-black/60 border border-amber-500/30 px-2 py-0.5">
                        <Calendar className="h-3 w-3 text-amber-400" />
                        <span className="text-[10px] text-amber-300 font-bold uppercase">{tr.race}</span>
                        <span className="text-xs text-slate-200">{formatDateTime(ev.startsAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* ADMIN & STEWARD: MANAGE ROUND BUTTON */}
                    {(isAdmin || isSteward) && onFinishRound && (
                      <button
                        type="button"
                        onClick={() => onFinishRound(ev)}
                        className="border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-[filter] hover:brightness-125 flex items-center gap-1.5 cursor-pointer shadow-md"
                        style={{ borderColor: `${accent}66`, backgroundColor: `${accent}29`, color: accent }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: accent }} />
                        {tr.manageRound}
                      </button>
                    )}

                    {/* DRIVERS & NON-ADMINS/NON-STEWARDS: VIEW ROUND BUTTON */}
                    {(!isAdmin && !isSteward) && onViewResults && (
                      <button
                        type="button"
                        onClick={() => onViewResults(ev)}
                        className="border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-[filter] hover:brightness-125 flex items-center gap-1.5 cursor-pointer shadow-md"
                        style={{ borderColor: `${accent}66`, backgroundColor: `${accent}29`, color: accent }}
                      >
                        <Trophy className="h-3.5 w-3.5" style={{ color: accent }} />
                        {tr.viewRound}
                      </button>
                    )}

                    {/* ADMIN ACTIONS ONLY */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 border-l border-shell-line/40 pl-2">
                        <button
                          type="button"
                          onClick={() => setViewingEntryListEvent(ev)}
                          title={tr.viewEntryList}
                          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors rounded-lg cursor-pointer"
                        >
                          <Users className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEventModal(ev)}
                          title={tr.editRound}
                          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors rounded-lg cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(ev.id)}
                          title={tr.deleteRound}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-white/5 transition-colors rounded-lg cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid Occupancy Meter */}
                <div className="flex flex-wrap gap-4 pt-2 z-10 w-full">
                  {classTags.map((tag) => {
                    const limit = (ev as any).classLimits?.[tag] ?? (league as any).classLimits?.[tag] ?? 30
                    const confirmedCount = localConfirmations.filter((c) => {
                      if (c.eventId !== ev.id || String(c.classTag || '').toUpperCase() !== tag.toUpperCase() || c.status !== 'confirmed') {
                        return false
                      }
                      if (initialRegistrations && initialRegistrations.length > 0) {
                        const isRegistered = initialRegistrations.some(
                          (r) =>
                            (r.teamId ? r.teamId === c.teamId : r.userId === (c as any).userId) &&
                            String(r.classTag || '').toUpperCase() === tag.toUpperCase()
                        )
                        if (!isRegistered) return false
                      }
                      return true
                    }).length
                    const pct = Math.min(100, (confirmedCount / limit) * 100)

                    return (
                      <div key={tag} className="flex-1 min-w-[140px] space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <ClassBadge classTag={tag} className="text-[10px] font-extrabold" />
                          <span className="font-mono text-xs font-bold text-slate-300">
                            {confirmedCount} / {limit} {tr.cars}
                          </span>
                        </div>
                        <div className="w-full bg-slate-900/80 border border-white/5 h-2 overflow-hidden rounded-lg">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? '#f43f5e' : (league.accentColor || '#1274de'),
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Driver Occupancy Meter (per-race driver cap) */}
                {Boolean((ev as any).maxDrivers) && (() => {
                  const driverLimit = Number((ev as any).maxDrivers)
                  const distinctDrivers = new Set<string>()
                  localConfirmations
                    .filter((c) => c.eventId === ev.id && c.status === 'confirmed')
                    .forEach((c) => (c.driverUserIds || []).forEach((id) => distinctDrivers.add(id)))
                  const driverCount = distinctDrivers.size
                  const driverPct = Math.min(100, (driverCount / driverLimit) * 100)

                  return (
                    <div className="pt-1 z-10 w-full space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                          <Users className="h-3 w-3" />
                          {tr.drivers}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          {driverCount} / {driverLimit} {tr.drivers}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900/80 border border-white/5 h-2 overflow-hidden rounded-lg">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${driverPct}%`,
                            backgroundColor: driverPct >= 100 ? '#f43f5e' : accent,
                          }}
                        />
                      </div>
                    </div>
                  )
                })()}

                {/* Team Confirmations */}
                {(() => {
                  const myRegisteredTeams = myManagedTeams.filter((t) =>
                    initialRegistrations.some((r) => r.teamId === t.id) ||
                    ((t as any).cars || []).some((c: any) => {
                      const cLeagueId = c.leagueId || c.league_id
                      return cLeagueId === league.id || cLeagueId === league.slug
                    })
                  )
                  if (myRegisteredTeams.length === 0) return null

                  return myRegisteredTeams.map((team) => {
                    const activeCars = ((team as any).cars || []).filter((carObj: any) => {
                      const carLeagueId = carObj.leagueId || carObj.league_id
                      if (carLeagueId && carLeagueId !== league.id && carLeagueId !== league.slug) return false

                      const isReg = initialRegistrations.some(
                        (r) =>
                          r.teamId === team.id &&
                          String(r.classTag || '').toUpperCase() === String(carObj.category || '').toUpperCase() &&
                          (String(r.assignedNumber ?? '').trim() === String(carObj.dorsal ?? '').trim() || !r.assignedNumber || !carObj.dorsal)
                      )

                      return isReg || Boolean(carLeagueId)
                    })

                    if (activeCars.length === 0) return null

                    return (
                      <div key={team.id} className="bg-slate-900/40 border border-cyan-500/10 p-3 z-10 space-y-2 mt-2">
                        <p className="text-[11px] uppercase tracking-wider font-extrabold text-cyan-400 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {tr.confirmAttendance.replace('{team}', team.name)}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeCars.map((carObj: any, carIdx: number) => {
                            const tag = String(carObj.category).toUpperCase()
                            const dorsalDisplay = String(carObj.dorsal || '').trim()
                            const limit = (ev as any).classLimits?.[tag] ?? (league as any).classLimits?.[tag] ?? 30

                            const carDriversList = (() => {
                              const byLeague = carObj.driverUserIdsByLeague || carObj.driver_user_ids_by_league || {}
                              let list: string[] = []
                              if (byLeague[league.id] && Array.isArray(byLeague[league.id])) {
                                list = byLeague[league.id].filter(Boolean)
                              } else if (league.slug && byLeague[league.slug] && Array.isArray(byLeague[league.slug])) {
                                list = byLeague[league.slug].filter(Boolean)
                              } else if (Array.isArray(carObj.driverUserIds)) {
                                list = carObj.driverUserIds.filter(Boolean)
                              } else if (Array.isArray(carObj.driver_user_ids)) {
                                list = carObj.driver_user_ids.filter(Boolean)
                              }
                              if (list.length > 0) return list

                              const regDrivers = initialRegistrations.filter(
                                (r) =>
                                  r.teamId === team.id &&
                                  String(r.classTag || '').toUpperCase() === tag &&
                                  (String(r.assignedNumber ?? '').trim() === dorsalDisplay || !r.assignedNumber || !dorsalDisplay)
                              )
                              return regDrivers.map((r) => r.userId).filter(Boolean)
                            })()

                            const hasDrivers = carDriversList.length > 0

                            const isConfirmed = hasDrivers && localConfirmations.some(
                              (c) =>
                                c.eventId === ev.id &&
                                c.teamId === team.id &&
                                c.classTag === tag &&
                                String((c as any).dorsalDisplay || c.carNumber || '').trim() === dorsalDisplay &&
                                c.status === 'confirmed'
                            )
                            const confirmedCount = localConfirmations.filter(
                              (c) => c.eventId === ev.id && c.classTag === tag && c.status === 'confirmed'
                            ).length
                            const isGridFull = !isConfirmed && confirmedCount >= limit

                            return (
                              <div
                                key={`${tag}_${dorsalDisplay}_${carIdx}`}
                                className={`flex items-center justify-between gap-2 border px-3 py-1.5 transition-colors ${
                                  !hasDrivers
                                    ? 'bg-black/20 border-slate-800/40 opacity-75'
                                    : 'bg-black/40 border-shell-line/30'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <ClassBadge classTag={tag} className="text-[9px]" />
                                  <span className="font-mono-data shrink-0 rounded-md border border-[#4ea1ff]/30 bg-[rgba(78,161,255,.12)] px-2.5 py-1 text-sm font-black text-[#4ea1ff]">#{dorsalDisplay}</span>
                                  {!hasDrivers && (
                                    <span className="text-[10px] text-slate-400 font-mono italic font-medium">
                                      {tr.noDrivers}
                                    </span>
                                  )}
                                </div>

                                {!hasDrivers ? (
                                  <button
                                    type="button"
                                    disabled
                                    title={tr.cannotConfirmTitle}
                                    className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border bg-slate-800/80 border-slate-700/60 text-slate-400/70 cursor-not-allowed flex items-center gap-1"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                                    {tr.noDriversButton}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const wasConfirmed = isConfirmed
                                      if (wasConfirmed) {
                                        setLocalConfirmations((prev) =>
                                          prev.filter(
                                            (c) =>
                                              !(
                                                c.eventId === ev.id &&
                                                c.teamId === team.id &&
                                                c.classTag === tag &&
                                                String((c as any).dorsalDisplay || c.carNumber || '').trim() === dorsalDisplay
                                              )
                                          )
                                        )
                                      } else {
                                        setLocalConfirmations((prev) => [
                                          ...prev,
                                          {
                                            id: `${ev.id}_${team.id}_${tag}_${dorsalDisplay}`,
                                            eventId: ev.id,
                                            leagueId: league.id,
                                            teamId: team.id,
                                            classTag: tag,
                                            carNumber: dorsalDisplay,
                                            carModel: '',
                                            driverUserIds: carDriversList,
                                            status: 'confirmed',
                                          },
                                        ])
                                      }

                                      try {
                                        const fd = new FormData()
                                        fd.set('eventId', ev.id)
                                        fd.set('leagueId', league.id)
                                        fd.set('teamId', team.id)
                                        fd.set('classTag', tag)
                                        fd.set('carNumber', dorsalDisplay)
                                        fd.set('carModel', '')
                                        fd.set('slug', league.slug)

                                        if (wasConfirmed) {
                                          await cancelAttendanceAction(fd)
                                          toast.success(`#${dorsalDisplay} ${tag} unconfirmed`)
                                        } else {
                                          await confirmAttendanceAction(fd)
                                          toast.success(`#${dorsalDisplay} ${tag} confirmed`)
                                        }
                                        router.refresh()
                                      } catch (err: any) {
                                        setLocalConfirmations(confirmations)
                                        alert(err.message || tr.attendanceError)
                                      }
                                    }}
                                    disabled={isGridFull}
                                    className={`px-2 py-1 text-[10px] font-bold uppercase transition-colors rounded-lg border ${
                                      isConfirmed
                                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                                        : isGridFull
                                        ? 'bg-rose-500/5 border-rose-500/20 text-rose-400/50 cursor-not-allowed'
                                        : 'bg-cyan-500/5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/15'
                                    }`}
                                  >
                                    {isConfirmed ? tr.confirmed : isGridFull ? tr.gridFull : tr.confirm}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                })()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {expiredCount > 0 && (
          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={() => setShowExpiredRounds((prev) => !prev)}
              className="text-xs font-semibold text-slate-400 hover:text-cyan-400 underline underline-offset-4 cursor-pointer transition-colors"
            >
              {showExpiredRounds
                ? tr.hideRounds.replace('{n}', String(expiredCount))
                : tr.showRounds.replace('{n}', String(expiredCount))}
            </button>
          </div>
        )}
      </div>

      {/* Entry List Modal (Confirmed teams & driver IDs & skin download) */}
      {viewingEntryListEvent && (
        <EventEntryListModal
          event={viewingEntryListEvent}
          confirmations={localConfirmations.filter((c) => c.eventId === viewingEntryListEvent.id)}
          registrations={initialRegistrations}
          classTags={classTags}
          myManagedTeams={myManagedTeams}
          teamInfo={teamInfo}
          standings={standings}
          skinReviewStatus={skinReviewStatus}
          isAdmin={isAdmin}
          onClose={() => setViewingEntryListEvent(null)}
        />
      )}
    </div>
  )
}
