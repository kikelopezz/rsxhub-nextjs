import { FormattedDate } from '@/components/formatted-date'
import { ClassBadge } from '@/components/class-badge'
import type { LeagueParticipation, RecentResult } from '../team-utils'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

type TeamLeaguesSectionProps = {
  leagueParticipation: LeagueParticipation[]
  recentResults: RecentResult[]
  accentHard: string
}

export async function TeamLeaguesSection({ leagueParticipation, recentResults, accentHard }: TeamLeaguesSectionProps) {
  const t = getDictionary(await getLocale()).equipos.leaguesSection
  return (
    <>
      <section className="hud-corners shell-panel p-4 md:p-5 rounded-lg">
        <h2 className="text-2xl font-black uppercase italic text-white">{t.teamLeagues}</h2>
        <div className="mt-2 h-1 w-52 rounded-lg" style={{ background: `linear-gradient(90deg, ${accentHard}, transparent)` }} />

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {leagueParticipation.length === 0 ? (
            <p className="text-sm text-slate-300">{t.noParticipation}</p>
          ) : (
            leagueParticipation.map((league) => (
              <article
                key={league.leagueId}
                className="border border-shell-line bg-[#0a101a] p-4 rounded-lg space-y-4 hover:border-cyan-500/40 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xl font-black uppercase italic text-white tracking-wide">{league.title}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">{league.simulator}</p>
                  </div>
                  <div className="border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-center rounded-lg shrink-0">
                    <p className="text-[9px] uppercase tracking-wider text-cyan-300 font-bold">{t.totalDrivers}</p>
                    <p className="text-lg font-black text-cyan-400 leading-none mt-0.5">{league.teamDriversInLeague}</p>
                  </div>
                </div>

                {/* Category Blocks */}
                {league.categories && league.categories.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{t.registeredCategories}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {league.categories.map((cat) => (
                        <div
                          key={cat.classTag}
                          className="border border-white/10 bg-black/40 p-2.5 flex items-center justify-between gap-3 rounded-lg"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <ClassBadge classTag={cat.classTag} className="text-[10px] px-2 py-0.5 font-black" />
                            <p className="text-[10px] text-slate-400 font-medium truncate">
                              {cat.carsCount} {cat.carsCount === 1 ? t.carOne : t.carMany} • {cat.driversCount} {cat.driversCount === 1 ? t.driverOne : t.driverMany}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{t.points}</p>
                            <p className="text-base font-black italic text-emerald-400 leading-none mt-0.5">{cat.points} {t.pts}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Footer: Next race */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t.nextRace}</span>
                  <span className="font-semibold text-white">
                    {league.nextEventAt ? <FormattedDate date={league.nextEventAt} /> : t.noScheduledRaces}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="hud-corners shell-panel p-4 md:p-5 rounded-lg">
        <h2 className="text-2xl font-black uppercase italic text-white">{t.latestResults}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {recentResults.length === 0 ? (
            <p className="text-sm text-slate-300">{t.noResultsYet}</p>
          ) : (
            recentResults.map((result) => (
              <div key={result.id} className="border border-shell-line bg-black/20 p-4 rounded-lg flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 truncate">
                    {result.leagueTitle}
                  </p>
                  <p className="mt-0.5 text-base font-black uppercase italic text-white truncate">
                    {result.eventTitle}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">{t.position}</p>
                    <p className="text-lg font-black italic text-cyan-400 leading-none">P{result.position}</p>
                  </div>
                  <div className="text-right border-l border-white/10 pl-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">{t.points}</p>
                    <p className="text-lg font-black italic text-emerald-400 leading-none">{result.points ?? '0'} {t.pts}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}
