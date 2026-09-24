'use client'

import Image from 'next/image'
import { Calendar, Settings, Trash } from 'lucide-react'
import { FormattedDate } from '@/components/formatted-date'
import { simulatorLabel } from '@/lib/utils'
import { League } from '../hooks/use-league-state'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface LeagueBannerProps {
  league: League
  accentHex: string
  isAdmin: boolean
  onEditSettings: () => void
  onDeleteLeague: () => void
  registrationElement?: React.ReactNode
}

export function LeagueBanner({
  league,
  accentHex,
  isAdmin,
  onEditSettings,
  onDeleteLeague,
  registrationElement,
}: LeagueBannerProps) {
  const t = useDictionary().ligas.banner
  const statusLabel = league.registrationOpen
    ? 'Inscripciones abiertas'
    : league.status === 'finished' || league.status === 'completed'
      ? 'Finalizada'
      : league.status === 'closed'
        ? 'Cerrada'
        : 'En curso'
  const statusColor = league.registrationOpen ? '#22c55e' : league.status === 'finished' || league.status === 'closed' ? '#8b96a8' : '#4ea1ff'

  return (
    <section
      className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1420]"
      style={{ borderLeftWidth: 4, borderLeftColor: accentHex }}
    >
      <div className="relative">
        {league.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={league.bannerUrl}
            alt=""
            className="block max-h-72 w-full object-cover"
            style={{ height: 'auto' }}
          />
        ) : (
          <div
            className="h-24"
            style={{ background: `radial-gradient(520px 180px at 88% 0%, ${accentHex}26, transparent 70%)` }}
          />
        )}
        {league.bannerUrl && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(100deg, rgba(6,8,13,.92) 0%, rgba(6,8,13,.55) 45%, rgba(6,8,13,.8) 100%)' }}
          />
        )}

        {/* Game logo — top-right, white chip (same convention as the league card), sized
            up slightly from the card version since the banner has more room to spare. */}
        <span className="absolute right-3 top-3 z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white p-2 shadow-md">
          <Image
            src={league.simulatorLogoUrl || (league.simulator === 'ac' ? '/branding/ACLogo.png' : '/branding/LMULogo.png')}
            alt={league.simulatorName || league.simulator}
            unoptimized
            width={44}
            height={44}
            className="h-full w-full object-contain"
          />
        </span>

        <div className="absolute inset-0 flex min-h-[92px] flex-wrap items-center justify-between gap-4 p-4 pr-20 md:py-5 md:pl-6 md:pr-24">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <h1 className="font-display-league truncate text-3xl uppercase leading-none text-white md:text-4xl">
              {league.title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 gap-y-1.5">
              <span
                className="font-mono-data flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: statusColor, borderColor: `${statusColor}55`, backgroundColor: `${statusColor}14` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                {statusLabel}
              </span>
              <span className="font-mono-data rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {league.simulatorName || simulatorLabel(league.simulator)}
              </span>
              <span className="font-mono-data rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {league.format}
              </span>
              <span className="font-mono-data flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-slate-300">
                <Calendar className="h-3 w-3 text-[#4ea1ff]" />
                <FormattedDate date={league.startsAt} mode="date" /> — <FormattedDate date={league.endsAt} mode="date" />
              </span>
            </div>
            {league.slogan && (
              <p className="mt-1.5 truncate text-xs font-bold italic" style={{ color: accentHex }}>
                &quot;{league.slogan}&quot;
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={onEditSettings}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
              >
                <Settings className="h-3.5 w-3.5" />
                {t.editSettings}
              </button>
              <button
                onClick={onDeleteLeague}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 transition-colors hover:bg-rose-500/15"
              >
                <Trash className="h-3.5 w-3.5" />
                {t.delete}
              </button>
            </div>
          )}
          {registrationElement}
        </div>
      </div>
      </div>

      {league.fullDescription && (
        <p className="relative border-t border-white/5 px-4 py-2.5 text-xs leading-relaxed text-slate-400 md:px-6">
          {league.fullDescription}
        </p>
      )}
    </section>
  )
}
