'use client'

import { Trophy } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface RecentResult {
  round: string
  [key: string]: any
}

interface LeagueResultsProps {
  isAdmin: boolean
  recentResults: RecentResult
  classTags?: string[]
  events?: any[]
  onOpenResultsModal: () => void
}

export function LeagueResults({
  isAdmin,
  recentResults,
  classTags = ['GT3', 'LMP2'],
  events = [],
  onOpenResultsModal,
}: LeagueResultsProps) {
  const t = useDictionary().ligas.results
  // Determine subtitle: title of completed round and circuit only
  const completedEvents = events.filter((e: any) => e.status === 'completed')
  const lastCompletedEvent = completedEvents[completedEvents.length - 1]

  const roundSubtitle = lastCompletedEvent
    ? `${lastCompletedEvent.title} - ${lastCompletedEvent.circuitName}`
    : recentResults?.round && recentResults.round !== 'No rounds completed yet'
    ? recentResults.round
    : t.noRoundsYet

  const tagsToDisplay = classTags.length > 0 ? classTags : ['GT3', 'LMP2']

  // Check if any real results exist in recentResults for any category
  const hasAnyResults = tagsToDisplay.some(
    (tag) => recentResults && Array.isArray(recentResults[tag]) && recentResults[tag].length > 0
  )

  return (
    <section className="shell-panel p-4 md:p-5 rounded-lg space-y-4">
      <div className="flex items-center justify-between border-b border-shell-line pb-3">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            {t.title}
          </h2>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mt-0.5">
            {roundSubtitle}
          </p>
        </div>
      </div>

      {!hasAnyResults ? (
        <div className="bg-black/30 border border-shell-line/30 p-6 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
          {t.noResultsYet}
        </div>
      ) : (
        <div className={`grid gap-4 grid-cols-1 ${tagsToDisplay.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {tagsToDisplay.map((tag) => {
            const categoryResults =
              recentResults && Array.isArray(recentResults[tag]) ? recentResults[tag].slice(0, 3) : []

            return (
              <div key={tag} className="space-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <ClassBadge classTag={tag} className="text-xs px-2.5 py-0.5 font-black" />
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">{t.top3Podium}</span>
                </div>
                {categoryResults.length === 0 ? (
                  <div className="bg-black/30 border border-white/5 p-3 text-center text-xs text-slate-500 italic">
                    {t.noResultsCategory}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {categoryResults.map((r: any) => (
                      <div
                        key={r.pos || r.team}
                        className="flex items-center justify-between bg-black/40 border border-shell-line/30 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-black w-5 text-center text-sm ${
                              r.pos === 1 ? 'text-amber-400' : r.pos === 2 ? 'text-slate-300' : 'text-amber-600'
                            }`}
                          >
                            {r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : '🥉'}
                          </span>
                          <span className="font-bold text-slate-100 truncate">{r.team}</span>
                          {r.dorsal != null && (
                            <span className="text-[10px] font-mono font-black text-cyan-300 shrink-0">
                              #{r.dorsal}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-slate-300 font-bold text-xs shrink-0 ml-2">
                          {r.time || r.gap || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
