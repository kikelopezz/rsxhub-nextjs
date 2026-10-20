'use client'

import Image from 'next/image'
import { BookText, Calendar, Settings, Trash } from 'lucide-react'
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

// Mismos iconos de marca que el footer (components/footer.tsx), para que el chip de Discord/YouTube
// se reconozca igual en toda la web en vez de usar los genéricos de lucide-react.
const DiscordIcon = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0c-.172-.393-.412-.882-.63-1.25a.074.074 0 0 0-.078-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
  </svg>
)

const YoutubeIcon = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

function ExternalLinkChip({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono-data flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:brightness-125"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      {icon}
      {label}
    </a>
  )
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
              {league.discordUrl && (
                <ExternalLinkChip href={league.discordUrl} icon={<DiscordIcon />} label="Discord" color="#818cf8" />
              )}
              {league.youtubeUrl && (
                <ExternalLinkChip href={league.youtubeUrl} icon={<YoutubeIcon />} label="YouTube" color="#f87171" />
              )}
              {league.rulebookUrl && (
                <ExternalLinkChip href={league.rulebookUrl} icon={<BookText className="h-3 w-3" />} label="Reglamento" color="#fbbf24" />
              )}
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
