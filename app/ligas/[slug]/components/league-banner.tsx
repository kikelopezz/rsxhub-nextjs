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
  return (
    <section className="overflow-hidden border border-shell-line bg-[#0f1521] rounded-lg relative">
      <div
        className="h-52 border-b border-shell-line bg-cover bg-center relative"
        style={{
          backgroundImage: league.bannerUrl
            ? `linear-gradient(to top, rgba(8,11,18,0.92), rgba(8,11,18,0.25)), url(${league.bannerUrl})`
            : 'linear-gradient(135deg, rgba(14,20,30,0.95), rgba(38,55,84,0.85))',
        }}
      >
        {/* Status Badge - Top Left */}
        <div
          className="absolute left-4 top-4 z-20 text-white font-black uppercase text-xs flex flex-col items-center justify-center p-2 rounded-lg"
          style={{
            width: '64px',
            height: '64px',
            backgroundColor: accentHex,
            borderRight: `3px solid ${accentHex}`,
            boxShadow: `0 0 20px ${accentHex}80`,
          }}
        >
          <span className="text-[9px] text-white/90 font-bold uppercase tracking-wider leading-none mb-1">{t.status}</span>
          <span className="text-xs font-black tracking-wider leading-none text-white">{league.status.toUpperCase()}</span>
        </div>

        {/* Simulator Logo Badge - Top Right */}
        <div
          className="absolute right-4 top-4 z-20 bg-white border-t border-r border-b border-black/10 shadow-[0_4px_16px_rgba(0,0,0,0.45)] flex items-center justify-center"
          style={{ width: '64px', height: '64px', borderLeft: `3px solid ${accentHex}` }}
        >
          <Image
            src={(league as any).logoUrl || (league.simulator === 'ac' ? '/branding/ACLogo.png' : '/branding/LMULogo.png')}
            alt={league.simulator}
            fill
            sizes="64px"
            className="object-contain p-2"
          />
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        {/* Top Bar: Simulator/Format Pills & Admin Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="border border-rose-500/60 bg-rose-950/80 text-rose-300 font-black uppercase px-2.5 py-1 rounded-lg tracking-wide shadow-sm">
              {simulatorLabel(league.simulator)}
            </span>
            <span className="border border-blue-500/60 bg-blue-950/80 text-blue-300 font-black uppercase px-2.5 py-1 rounded-lg tracking-wide shadow-sm">
              {league.format}
            </span>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={onEditSettings}
                className="border border-cyan-500/40 hover:bg-cyan-500/10 px-3 py-1.5 text-xs font-bold uppercase text-cyan-400 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Settings className="h-3.5 w-3.5" />
                {t.editSettings}
              </button>
              <button
                onClick={onDeleteLeague}
                className="border border-rose-500/40 hover:bg-rose-500/10 px-3 py-1.5 text-xs font-bold uppercase text-rose-400 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash className="h-3.5 w-3.5" />
                {t.delete}
              </button>
            </div>
          )}
        </div>

        {/* Title, Dates & Right-Side Centered Team Widget */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-1">
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white md:text-4xl">
              {league.title}
            </h1>
            {league.slogan && (
              <p className="text-xs font-extrabold uppercase tracking-widest mt-0.5 italic" style={{ color: accentHex }}>
                {league.slogan}
              </p>
            )}

            {/* Static Date Bar */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
              <div className="flex items-center gap-2 border border-shell-line bg-black/40 px-3 py-1.5 rounded-lg font-semibold text-slate-200">
                <Calendar className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="text-slate-400 uppercase text-[10px] font-bold">{t.startDate}</span>
                <span className="text-white font-bold"><FormattedDate date={league.startsAt} mode="date" /></span>
              </div>
              <div className="flex items-center gap-2 border border-shell-line bg-black/40 px-3 py-1.5 rounded-lg font-semibold text-slate-200">
                <Calendar className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="text-slate-400 uppercase text-[10px] font-bold">{t.endDate}</span>
                <span className="text-white font-bold"><FormattedDate date={league.endsAt} mode="date" /></span>
              </div>
            </div>
          </div>

          {/* Registered Team Card - Right Side Vertically Centered */}
          <div className="flex items-center justify-end shrink-0">
            {registrationElement}
          </div>
        </div>

        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-300">
          {league.fullDescription}
        </p>
      </div>
    </section>
  )
}
