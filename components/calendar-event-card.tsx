import Image from 'next/image'
import Link from 'next/link'
import type { LeagueEvent } from '@/types'
import { FormattedDate } from '@/components/formatted-date'

interface Props {
  event: LeagueEvent
  leagueTitle?: string
  leagueSlug?: string
  registeredCount?: number
  totalSlots?: number | null
}

export function CalendarEventCard({ event, leagueTitle, leagueSlug, registeredCount = 0, totalSlots = null }: Props) {
  const raceTitle = event.title?.trim() || event.circuitName
  const hasCustomRaceTitle = Boolean(event.title?.trim())
  const slotsLabel = totalSlots ? `${registeredCount}/${totalSlots}` : `${registeredCount}/-`

  return (
    <article className="relative overflow-hidden rounded-md border border-shell-line bg-[#090d15] shadow-soft">
      <div className="relative h-[320px] w-full overflow-hidden">
        {event.circuitImageUrl ? (
          <>
            <Image
              src={event.circuitImageUrl}
              alt={event.circuitName || 'Circuito'}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-[#030509]/78 to-[#030509]/98" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#090d15] to-[#1a283f]/92" />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4">
        {hasCustomRaceTitle ? <p className="text-sm font-semibold italic text-slate-200">{event.circuitName}</p> : null}
        <h3 className="text-4xl font-black uppercase italic leading-[0.9] text-white drop-shadow-md">{raceTitle}</h3>
        <p className="mt-2 text-sm font-semibold text-slate-300">Next race <FormattedDate date={event.startsAt} /></p>

        <div className="mt-3 flex items-center gap-2 border-t border-white/15 pt-3 text-xs font-bold">
          <span className="rounded-sm border border-white/20 bg-black/30 px-2 py-1 text-slate-100">{leagueTitle || 'League'}</span>
          <span className="rounded-sm border border-[#1274de]/60 bg-[#1274de]/10 px-2 py-1 text-[#8cc6ff]">Registered {slotsLabel}</span>
          {leagueSlug ? (
            <Link href={`/ligas/${leagueSlug}`} className="ml-auto rounded-sm border border-white/20 bg-white/5 px-2 py-1 text-slate-100 hover:bg-white/10">
              View League
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}
