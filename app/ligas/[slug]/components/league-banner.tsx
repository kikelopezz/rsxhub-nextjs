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
      : 'En curso'
  const statusColor = league.registrationOpen ? '#22c55e' : league.status === 'finished' ? '#8b96a8' : '#4ea1ff'

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1420]">
      {/* Art */}
      <div
        className="relative h-44 md:h-48"
        style={{
          backgroundImage: league.bannerUrl
            ? `linear-gradient(160deg, rgba(6,8,13,.55), rgba(6,8,13,.85)), url(${league.bannerUrl})`
            : `radial-gradient(700px 300px at 85% 0%, ${accentHex}55, transparent 60%), linear-gradient(160deg, #0d1420 0%, #071120 60%, #06080d 100%)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0d1420]" />
        <span className="absolute right-5 top-5 z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.4)]">
          <Image
            src={league.simulator === 'ac' ? '/branding/ACLogo.png' : '/branding/LMULogo.png'}
            alt={league.simulator}
            width={40}
            height={40}
            className="h-full w-full object-contain"
          />
        </span>
        {isAdmin && (
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2">
            <button
              onClick={onEditSettings}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
            >
              <Settings className="h-3.5 w-3.5" />
              {t.editSettings}
            </button>
            <button
              onClick={onDeleteLeague}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 backdrop-blur-sm transition-colors hover:bg-rose-500/15"
            >
              <Trash className="h-3.5 w-3.5" />
              {t.delete}
            </button>
          </div>
        )}
      </div>

      {/* Content — overlaps the art like the hero mockup */}
      <div className="relative -mt-14 flex flex-wrap items-end gap-5 px-5 pb-5 md:px-6">
        <div className="min-w-[240px] flex-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
            <span className="font-mono-data text-[11px] uppercase tracking-[0.2em]" style={{ color: statusColor }}>
              {statusLabel} · {simulatorLabel(league.simulator)}
            </span>
          </div>
          <h1 className="font-display-league mt-1 text-4xl uppercase leading-none text-white md:text-5xl">
            {league.title}
          </h1>
          {league.slogan && (
            <p className="mt-1.5 text-xs font-bold italic tracking-wide" style={{ color: accentHex }}>
              &quot;{league.slogan}&quot;
            </p>
          )}
          {league.fullDescription && (
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400 md:text-[13px]">{league.fullDescription}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-semibold text-slate-200">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[#4ea1ff]" />
              <span className="text-[10px] font-bold uppercase text-slate-500">{t.startDate}</span>
              <span className="font-mono-data font-bold text-white"><FormattedDate date={league.startsAt} mode="date" /></span>
            </span>
            <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-semibold text-slate-200">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[#4ea1ff]" />
              <span className="text-[10px] font-bold uppercase text-slate-500">{t.endDate}</span>
              <span className="font-mono-data font-bold text-white"><FormattedDate date={league.endsAt} mode="date" /></span>
            </span>
            <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-bold uppercase tracking-wider text-slate-300">
              {league.format}
            </span>
          </div>
        </div>

        {registrationElement && <div className="shrink-0">{registrationElement}</div>}
      </div>
    </section>
  )
}
