import Link from 'next/link'
import type { League, LeagueEvent } from '@/types'
import { simulatorLabel } from '@/lib/utils'
import { FormattedDate } from '@/components/formatted-date'

export function NextEvent({ event, league }: { event: LeagueEvent; league: League }) {
  return (
    <section className="shell-panel p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Up Next</p>
          <h2 className="mt-1 text-2xl font-bold text-white">{event.circuitName}</h2>
          <p className="mt-1 text-sm text-slate-300">{league.title} - {simulatorLabel(league.simulator)}</p>
          <p className="mt-1 text-sm text-slate-400"><FormattedDate date={event.startsAt} /></p>
        </div>

        <Link href={`/ligas/${league.slug}`} className="inline-flex rounded-md border border-shell-line bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
          View Details
        </Link>
      </div>
    </section>
  )
}
