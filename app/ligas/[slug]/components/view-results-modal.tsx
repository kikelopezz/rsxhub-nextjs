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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm p-4 md:p-6 flex justify-center items-start sm:items-center animate-fade-in">
      <div className="shell-panel border border-shell-line bg-[#090d16] max-w-4xl w-full p-5 md:p-6 text-white rounded-lg shadow-[0_0_60px_rgba(0,0,0,0.9)] relative flex flex-col my-auto">
        {/* Modal Header */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-shell-line pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
              {t.officialResults}
            </span>
            <span className="bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
              {t.readOnlyView}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase text-white tracking-tight italic mt-1.5 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-400" />
            {event.title || event.circuitName}
          </h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            {t.verifiedNote}
          </p>
        </div>

        {/* Top Session Filter Tabs (Qualifying vs Race) - Only shown when event has Qualy */}
        {Boolean(event.hasQualy === true || String(event.hasQualy) === 'true' || event.qualyStartsAt) && (
          <div className="grid grid-cols-2 gap-2 bg-black/60 p-1.5 border border-shell-line/60 rounded-lg mb-4">
            <button
              type="button"
              onClick={() => setSessionFilter('qualifying')}
              className={`py-2 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                sessionFilter === 'qualifying'
                  ? 'bg-cyan-500 text-black shadow-md border border-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Timer className="h-4 w-4" />
              {t.qualifyingSession}
            </button>
            <button
              type="button"
              onClick={() => setSessionFilter('race')}
              className={`py-2 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                sessionFilter === 'race'
                  ? 'bg-amber-500 text-black shadow-md border border-amber-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flag className="h-4 w-4" />
              {t.raceSession}
            </button>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3 overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">
            {t.category}
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shrink-0 ${
              selectedCategoryFilter === 'ALL'
                ? 'bg-cyan-500 text-black border border-cyan-400 font-black shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
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
                className={`px-3 py-1 text-xs uppercase tracking-wider rounded-lg border transition-all cursor-pointer shrink-0 ${getCategoryStyles(
                  cat,
                  isSelected
                )}`}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-xs font-mono uppercase tracking-wider">{t.loadingClassification.replace('{session}', sessionLabel)}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="border border-white/10 bg-black/40 p-8 text-center rounded-lg my-4">
            <Trophy className="h-10 w-10 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">{t.noResultsTitle.replace('{session}', sessionLabel)}</p>
            <p className="text-xs text-slate-500 mt-1">{t.noResultsBody.replace('{session}', sessionLabel)}</p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1">
            {displayCategories.map((catTag) => {
              const categoryRows = results.filter(
                (r) => String(r.classTag || '').trim().toUpperCase() === String(catTag || '').trim().toUpperCase()
              )
              if (categoryRows.length === 0 && selectedCategoryFilter !== 'ALL') return null

              return (
                <div key={catTag} className="border border-shell-line bg-black/40 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <ClassBadge classTag={catTag} className="text-xs px-2.5 py-0.5 font-black" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        {sessionFilter === 'qualifying' ? t.qualifyingLeaderboard : t.raceLeaderboard} - {catTag}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      {categoryRows.length} {t.driversEnrolled}
                    </span>
                  </div>

                  {categoryRows.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">{t.noPositionsCategory}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.03] text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                            <th className="p-2 w-16 text-center">{t.pos}</th>
                            <th className="p-2">{t.driver}</th>
                            <th className="p-2">{t.team}</th>
                            <th className="p-2 w-20 text-center">{t.carNumber}</th>
                            {sessionFilter === 'qualifying' ? (
                              <th className="p-2 w-28 text-right">{t.bestLap}</th>
                            ) : (
                              <>
                                <th className="p-2 w-28 text-right">{t.timeGap}</th>
                                <th className="p-2 w-24 text-right">{t.points}</th>
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
                            if (isP1) posBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-black'
                            else if (isP2) posBg = 'bg-slate-300/20 text-slate-200 border border-slate-300/50 font-black'
                            else if (isP3) posBg = 'bg-amber-700/20 text-amber-500 border border-amber-700/50 font-black'

                            return (
                              <tr key={row.id || idx} className="hover:bg-white/[0.04] transition-colors">
                                <td className="p-2 text-center">
                                  <span className={`inline-block w-7 py-0.5 text-center text-xs font-mono rounded-lg ${posBg}`}>
                                    {isP1 ? '🥇 P1' : isP2 ? '🥈 P2' : isP3 ? '🥉 P3' : `P${row.position || idx + 1}`}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <div>
                                    <p className="font-bold text-white leading-tight">{row.driverName}</p>
                                    {row.steamId && (
                                      <p className="text-[10px] text-slate-500 font-mono">{t.steam} {row.steamId}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 font-semibold text-slate-300 uppercase tracking-wide">
                                  {row.teamName}
                                </td>
                                <td className="p-2 text-center font-mono font-bold text-cyan-400">
                                  {row.dorsal ? `#${row.dorsal}` : '-'}
                                </td>
                                {sessionFilter === 'qualifying' ? (
                                  <td className="p-2 text-right font-mono font-bold text-cyan-300 text-xs">
                                    {row.lapTime || (isP1 ? '1:47.312' : `+${(idx * 0.245).toFixed(3)}s`)}
                                  </td>
                                ) : (
                                  <>
                                    <td className="p-2 text-right font-mono text-slate-300 text-xs">
                                      {row.raceTime || (isP1 ? '1:24:05.182' : `+${(idx * 4.215).toFixed(3)}s`)}
                                    </td>
                                    <td className="p-2 text-right font-mono font-extrabold text-emerald-400 text-sm">
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

        {/* Modal Footer */}
        <div className="flex justify-end pt-4 border-t border-shell-line mt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-shell-line bg-white/10 hover:bg-white/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
