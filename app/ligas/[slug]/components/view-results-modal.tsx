'use client'

import { formatLapTime } from '@/lib/format-time'
import { useState, useEffect } from 'react'
import { X, Trophy, ShieldCheck, Loader2, Timer, Flag, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react'
import { ClassBadge, getCategoryStyles } from '@/components/class-badge'
import { getEventResultsAction, getEventResultsForReviewAction, saveResultReviewAction } from '@/app/ligas/actions'
import type { EventResultRow } from '@/app/ligas/actions/league-results'
import type { LeagueEvent } from '../hooks/use-league-state'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface ViewResultsModalProps {
  event: LeagueEvent
  leagueId: string
  classTags: string[]
  /** Admins y comisarios: ven el coche detectado de cada posición y pueden confirmarlo o corregirlo */
  canReview?: boolean
  onClose: () => void
}

export function ViewResultsModal({
  event,
  leagueId,
  classTags = ['GT3', 'LMP2'],
  canReview = false,
  onClose,
}: ViewResultsModalProps) {
  const t = useDictionary().ligas.viewResults
  const hasQualy = Boolean(event.hasQualy === true || String(event.hasQualy) === 'true' || event.qualyStartsAt)
  const [sessionFilter, setSessionFilter] = useState<'qualifying' | 'race'>(hasQualy && !event.completedAt ? 'qualifying' : 'race')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')
  const [results, setResults] = useState<EventResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadTick, setReloadTick] = useState(0)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editTeam, setEditTeam] = useState('')
  const [editDorsal, setEditDorsal] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let isMounted = true
    async function loadResults() {
      setLoading(true)
      try {
        const data = canReview
          ? await getEventResultsForReviewAction(leagueId, event.id, sessionFilter)
          : await getEventResultsAction(leagueId, event.id, sessionFilter)
        if (isMounted) {
          setResults(data)
        }
      } catch (err) {
        console.error('Error fetching event results:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadResults()
    return () => {
      isMounted = false
    }
  }, [leagueId, event.id, sessionFilter, canReview, reloadTick])

  const runReview = async (row: EventResultRow, action: 'confirm' | 'override' | 'clear') => {
    if (!row.reviewKey) return
    setBusyKey(row.reviewKey)
    setActionError('')
    try {
      await saveResultReviewAction({
        leagueId,
        eventId: event.id,
        sessionType: sessionFilter,
        reviewKey: row.reviewKey,
        action,
        teamName: editTeam,
        dorsal: editDorsal,
      })
      setEditingKey(null)
      setReloadTick((n) => n + 1)
    } catch {
      setActionError(t.review.saveError)
    } finally {
      setBusyKey(null)
    }
  }

  const startEditing = (row: EventResultRow) => {
    setEditingKey(row.reviewKey || null)
    setEditTeam(row.teamName === 'Independent' ? '' : row.teamName)
    setEditDorsal(row.dorsal || '')
    setActionError('')
  }

  const pendingCount = canReview ? results.filter((r) => r.needsReview).length : 0

  const sessionLabel = sessionFilter === 'qualifying' ? t.sessionQualifying : t.sessionRace
  const availableCategories = Array.from(new Set(results.map((r) => r.classTag).filter(Boolean)))
  const displayCategories =
    selectedCategoryFilter === 'ALL'
      ? availableCategories.length > 0
        ? availableCategories
        : classTags
      : [selectedCategoryFilter]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:items-center md:p-6">
      <div className="relative my-auto flex w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-[#0a0f18] p-5 text-white shadow-[0_0_60px_rgba(0,0,0,0.8)] md:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono-data rounded border border-emerald-800/50 bg-emerald-950 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
              {t.officialResults}
            </span>
            <span className="font-mono-data rounded border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4ea1ff]">
              {canReview ? t.review.mode : t.readOnlyView}
            </span>
          </div>
          <h2 className="font-display-league mt-2 flex items-center gap-2 text-2xl uppercase text-white md:text-3xl">
            <Trophy className="h-6 w-6 text-[#f5c518]" />
            {event.title || event.circuitName}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            {canReview ? t.review.note : t.verifiedNote}
          </p>
        </div>

        {/* Session Filter Tabs */}
        {Boolean(event.hasQualy === true || String(event.hasQualy) === 'true' || event.qualyStartsAt) && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/40 p-1.5">
            <button
              type="button"
              onClick={() => setSessionFilter('qualifying')}
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                sessionFilter === 'qualifying'
                  ? 'border border-[#4ea1ff] bg-[#1274de] text-white shadow-md'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Timer className="h-4 w-4" />
              {t.qualifyingSession}
            </button>
            <button
              type="button"
              onClick={() => setSessionFilter('race')}
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                sessionFilter === 'race'
                  ? 'border border-amber-400 bg-amber-500 text-black shadow-md'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Flag className="h-4 w-4" />
              {t.raceSession}
            </button>
          </div>
        )}

        {canReview && !loading && results.length > 0 && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
              pendingCount > 0 ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {pendingCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {pendingCount > 0 ? t.review.pending.replace('{n}', String(pendingCount)) : t.review.allClear}
          </div>
        )}
        {actionError && <p className="mb-3 text-xs font-bold text-rose-400">{actionError}</p>}

        {/* Category Filters */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto border-b border-white/10 pb-3">
          <span className="mr-2 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">{t.category}</span>
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all ${
              selectedCategoryFilter === 'ALL'
                ? 'border border-[#4ea1ff] bg-[#1274de] text-white shadow-[0_0_12px_rgba(78,161,255,0.45)]'
                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {t.allCategories}
          </button>
          {(availableCategories.length > 0 ? availableCategories : classTags).map((cat) => {
            const isSelected = selectedCategoryFilter === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-wider transition-all ${getCategoryStyles(cat, isSelected)}`}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#4ea1ff]" />
            <p className="font-mono-data text-xs uppercase tracking-wider">{t.loadingClassification.replace('{session}', sessionLabel)}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="my-4 rounded-lg border border-white/10 bg-black/30 p-8 text-center">
            <Trophy className="mx-auto mb-2 h-10 w-10 text-slate-600 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-wider text-slate-300">{t.noResultsTitle.replace('{session}', sessionLabel)}</p>
            <p className="mt-1 text-xs text-slate-500">{t.noResultsBody.replace('{session}', sessionLabel)}</p>
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
            {displayCategories.map((catTag) => {
              const categoryRows = results.filter(
                (r) => String(r.classTag || '').trim().toUpperCase() === String(catTag || '').trim().toUpperCase()
              )
              if (categoryRows.length === 0 && selectedCategoryFilter !== 'ALL') return null

              return (
                <div key={catTag} className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <ClassBadge classTag={catTag} className="px-2.5 py-0.5 text-xs font-black" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        {sessionFilter === 'qualifying' ? t.qualifyingLeaderboard : t.raceLeaderboard} - {catTag}
                      </span>
                    </div>
                    <span className="font-mono-data text-[11px] font-bold text-slate-400">
                      {categoryRows.length} {t.driversEnrolled}
                    </span>
                  </div>

                  {categoryRows.length === 0 ? (
                    <p className="py-2 text-xs italic text-slate-500">{t.noPositionsCategory}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className={`w-full border-collapse text-left text-xs ${canReview ? 'min-w-[980px]' : 'min-w-[560px]'}`}>
                        <thead>
                          <tr className="font-mono-data border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="w-16 p-2 text-center">{t.pos}</th>
                            <th className="p-2">{t.driver}</th>
                            <th className="p-2">{t.team}</th>
                            <th className="w-20 p-2 text-center">{t.carNumber}</th>
                            {canReview && <th className="w-72 p-2">{t.review.detected}</th>}
                            {sessionFilter === 'qualifying' ? (
                              <th className="w-28 p-2 text-right">{t.bestLap}</th>
                            ) : (
                              <>
                                <th className="w-28 p-2 text-right">{t.timeGap}</th>
                                <th className="w-24 p-2 text-right">{t.points}</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {categoryRows.map((row, idx) => {
                            const isP1 = row.position === 1 || idx === 0
                            const isP2 = row.position === 2 || idx === 1
                            const isP3 = row.position === 3 || idx === 2

                            let posBg = 'bg-black/20 text-slate-300'
                            if (isP1) posBg = 'bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/50 font-black'
                            else if (isP2) posBg = 'bg-slate-300/15 text-slate-200 border border-slate-300/40 font-black'
                            else if (isP3) posBg = 'bg-[#c98246]/15 text-[#c98246] border border-[#c98246]/50 font-black'

                            return (
                              <tr key={row.id || idx} className="transition-colors hover:bg-white/[0.04]">
                                <td className="p-2 text-center">
                                  <span className={`font-mono-data inline-block w-9 rounded-md py-0.5 text-center text-xs ${posBg}`}>
                                    P{row.position || idx + 1}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <div>
                                    <p className="font-bold leading-tight text-white">{row.driverName}</p>
                                    {row.steamId && (
                                      <p className="font-mono-data text-[10px] text-slate-500">{t.steam} {row.steamId}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 font-semibold uppercase tracking-wide text-slate-300">{row.teamName}</td>
                                <td className="font-mono-data p-2 text-center font-bold text-[#4ea1ff]">
                                  {row.dorsal ? `#${row.dorsal}` : '—'}
                                </td>
                                {canReview && (
                                  <td className="p-2 align-top">
                                    {(() => {
                                      const warnings = (row.flags || []).filter((f) => f !== 'file-differs')
                                      const infos = (row.flags || []).filter((f) => f === 'file-differs')
                                      const isBusy = busyKey === row.reviewKey
                                      const badge =
                                        row.review?.status === 'override'
                                          ? { text: t.review.adjusted, cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300' }
                                          : row.review?.status === 'confirmed'
                                            ? { text: t.review.confirmed, cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' }
                                            : row.needsReview
                                              ? { text: t.review.toReview, cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' }
                                              : { text: t.review.ok, cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' }
                                      return (
                                        <div className="space-y-1.5">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="truncate font-bold leading-tight text-white">
                                                {row.car?.teamName || t.review.noCar}
                                                {row.car?.dorsal && <span className="font-mono-data ml-1.5 text-[#4ea1ff]">#{row.car.dorsal}</span>}
                                              </p>
                                              <p className="truncate text-[10px] uppercase text-slate-500">
                                                {row.car?.carModel ? `${row.car.carModel} · ` : ''}
                                                {t.review.sources[row.car?.source || 'none']}
                                              </p>
                                            </div>
                                            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${badge.cls}`}>{badge.text}</span>
                                          </div>
                                          {[...warnings, ...infos].map((flag) => (
                                            <p key={flag} className={`text-[10px] leading-tight ${flag === 'file-differs' ? 'text-slate-500' : 'text-amber-300/90'}`}>
                                              {t.review.flags[flag]}
                                            </p>
                                          ))}
                                          {editingKey === row.reviewKey ? (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <input
                                                value={editTeam}
                                                onChange={(e) => setEditTeam(e.target.value)}
                                                placeholder={t.review.teamPlaceholder}
                                                maxLength={60}
                                                className="w-28 rounded border border-white/15 bg-black/50 px-2 py-1 text-[11px] text-white outline-none focus:border-[#4ea1ff]"
                                              />
                                              <input
                                                value={editDorsal}
                                                onChange={(e) => setEditDorsal(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                                placeholder={t.review.numberPlaceholder}
                                                inputMode="numeric"
                                                className="font-mono-data w-14 rounded border border-white/15 bg-black/50 px-2 py-1 text-center text-[11px] text-white outline-none focus:border-[#4ea1ff]"
                                              />
                                              <button type="button" disabled={isBusy} onClick={() => runReview(row, 'override')} className="rounded bg-[#1274de] px-2 py-1 text-[10px] font-black uppercase text-white hover:bg-[#1f82ee] disabled:opacity-50">
                                                {t.review.save}
                                              </button>
                                              <button type="button" onClick={() => setEditingKey(null)} className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase text-slate-300 hover:bg-white/10">
                                                {t.review.cancel}
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              {!row.review && row.needsReview && (
                                                <button type="button" disabled={isBusy} onClick={() => runReview(row, 'confirm')} className="flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-[10px] font-black uppercase text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
                                                  <CheckCircle2 className="h-3 w-3" />
                                                  {t.review.confirm}
                                                </button>
                                              )}
                                              <button type="button" onClick={() => startEditing(row)} className="flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase text-slate-300 hover:bg-white/10">
                                                <Pencil className="h-3 w-3" />
                                                {t.review.edit}
                                              </button>
                                              {row.review && (
                                                <button type="button" disabled={isBusy} onClick={() => runReview(row, 'clear')} className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-slate-500 hover:text-white disabled:opacity-50">
                                                  {t.review.clear}
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })()}
                                  </td>
                                )}
                                {sessionFilter === 'qualifying' ? (
                                  <td className="font-mono-data p-2 text-right text-xs font-bold text-[#4ea1ff]">
                                    {formatLapTime(row.lapTime)}
                                  </td>
                                ) : (
                                  <>
                                    <td className="font-mono-data p-2 text-right text-xs text-slate-300">
                                      {formatLapTime(row.raceTime)}
                                    </td>
                                    <td className="font-mono-data p-2 text-right text-sm font-extrabold text-emerald-400">
                                      {row.points} {t.pts}
                                    </td>
                                  </>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
