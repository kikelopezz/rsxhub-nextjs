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
      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
        <h2 className="font-display-league text-2xl text-white">{t.teamLeagues}</h2>
        <div className="mt-2 h-1 w-52 rounded-lg" style={{ background: `linear-gradient(90deg, ${accentHard}, transparent)` }} />

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {leagueParticipation.length === 0 ? (
            <p className="text-sm text-slate-300">{t.noParticipation}</p>
          ) : (
            leagueParticipation.map((league) => (
              <article
                key={league.leagueId}
                className="space-y-4 rounded-xl border border-white/10 bg-[#111114] p-4 transition-colors hover:border-white/20"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="font-display-league text-xl text-white">{league.title}</h3>
                    <p className="mt-1 font-mono-data text-[10.5px] uppercase tracking-[0.16em] text-slate-500">{league.simulator}</p>
                  </div>
                  <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-center">
                    <p className="font-mono-data text-[9px] font-bold uppercase tracking-wider text-slate-400">{t.totalDrivers}</p>
                    <p className="mt-0.5 font-display-league text-lg leading-none text-white">{league.teamDriversInLeague}</p>
                  </div>
                </div>

                {/* Category Blocks */}
                {league.categories && league.categories.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-mono-data text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t.registeredCategories}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {league.categories.map((cat) => (
                        <div
                          key={cat.classTag}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 p-2.5"
                        >
                          <div className="min-w-0 space-y-1.5">
                            <ClassBadge classTag={cat.classTag} className="text-[10px] px-2 py-0.5 font-black" />
                            <p className="truncate font-mono-data text-[10px] text-slate-500">
                              {cat.carsCount} {cat.carsCount === 1 ? t.carOne : t.carMany} • {cat.driversCount} {cat.driversCount === 1 ? t.driverOne : t.driverMany}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono-data text-[9px] font-semibold uppercase tracking-wider text-slate-500">{t.points}</p>
                            <p className="mt-0.5 font-display-league text-lg leading-none text-emerald-400">{cat.points} {t.pts}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Footer: Next race */}
                <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs text-slate-300">
                  <span className="font-mono-data text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.nextRace}</span>
                  <span className="font-semibold text-white">
                    {league.nextEventAt ? <FormattedDate date={league.nextEventAt} /> : t.noScheduledRaces}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
        <h2 className="font-display-league text-2xl text-white">{t.latestResults}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {recentResults.length === 0 ? (
            <p className="text-sm text-slate-300">{t.noResultsYet}</p>
          ) : (
            recentResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#111114] p-4">
                <div className="min-w-0">
                  <p className="truncate font-mono-data text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {result.leagueTitle}
                  </p>
                  <p className="mt-0.5 truncate font-display-condensed text-base font-bold text-white">
                    {result.eventTitle}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono-data text-[9px] uppercase tracking-wider text-slate-500">{t.position}</p>
                    <p className="font-display-league text-lg leading-none text-white">P{result.position}</p>
                  </div>
                  <div className="border-l border-white/10 pl-4 text-right">
                    <p className="font-mono-data text-[9px] uppercase tracking-wider text-slate-500">{t.points}</p>
                    <p className="font-display-league text-lg leading-none text-emerald-400">{result.points ?? '0'} {t.pts}</p>
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
