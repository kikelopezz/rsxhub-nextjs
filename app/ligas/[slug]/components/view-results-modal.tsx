'use client'

import { useState, useEffect } from 'react'
import { X, Trophy, ShieldCheck, Loader2, Timer, Flag } from 'lucide-react'
import { ClassBadge, getCategoryStyles } from '@/components/class-badge'
import { getEventResultsAction } from '@/app/ligas/actions'
import type { LeagueEvent } from '../hooks/use-league-state'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface ViewResultsModalProps {
  event: LeagueEvent
  leagueId: string
  classTags: string[]
  onClose: () => void
}

export type EventResultRow = {
  id: string
  sessionType?: 'qualifying' | 'race'
  position: number
  driverName: string
  teamName: string
  steamId: string
  classTag: string
  dorsal: string | number | null
  points: number
  lapTime?: string | null
  raceTime?: string | null
}

export function ViewResultsModal({
  event,
  leagueId,
  classTags = ['GT3', 'LMP2'],
  onClose,
}: ViewResultsModalProps) {
  const t = useDictionary().ligas.viewResults
  const [sessionFilter, setSessionFilter] = useState<'qualifying' | 'race'>('race')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')
  const [results, setResults] = useState<EventResultRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadResults() {
      setLoading(true)
      try {
        const data = await getEventResultsAction(leagueId, event.id, sessionFilter)
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
  }, [leagueId, event.id, sessionFilter])

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
              {t.readOnlyView}
            </span>
          </div>
          <h2 className="font-display-league mt-2 flex items-center gap-2 text-2xl uppercase text-white md:text-3xl">
            <Trophy className="h-6 w-6 text-[#f5c518]" />
            {event.title || event.circuitName}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            {t.verifiedNote}
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
                      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="font-mono-data border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="w-16 p-2 text-center">{t.pos}</th>
                            <th className="p-2">{t.driver}</th>
                            <th className="p-2">{t.team}</th>
                            <th className="w-20 p-2 text-center">{t.carNumber}</th>
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
                                {sessionFilter === 'qualifying' ? (
                                  <td className="font-mono-data p-2 text-right text-xs font-bold text-[#4ea1ff]">
                                    {row.lapTime || '—'}
                                  </td>
                                ) : (
                                  <>
                                    <td className="font-mono-data p-2 text-right text-xs text-slate-300">
                                      {row.raceTime || '—'}
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
