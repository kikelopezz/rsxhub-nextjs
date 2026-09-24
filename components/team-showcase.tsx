'use client'

import { useState, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Download, Users, Shield } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { isRemoteImageOptimizable } from '@/lib/image-utils'

type TeamShowcaseProps = {
  teamName: string
  teamLogoUrl?: string | null
  teamBannerUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  slogan?: string | null
  abbreviation?: string | null
  competitionClasses?: string[]
  carSkinUrls?: string[]
  pilotNames: string[]
  profileHref?: string
  skins?: Array<{ skinUrl: string; leagueSlug: string; carNumber?: string | null }>
}

export function TeamShowcase({
  teamName,
  teamLogoUrl,
  teamBannerUrl,
  primaryColor,
  accentColor,
  slogan,
  abbreviation,
  competitionClasses = [],
  carSkinUrls = [],
  pilotNames = [],
  profileHref,
  skins = [],
}: TeamShowcaseProps) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const accent = accentColor || primaryColor || '#1274de'
  const initials = (abbreviation || '').trim().toUpperCase() || teamName.slice(0, 2).toUpperCase()

  // Same fallback chain as the team's own profile hero (banner → logo → a car skin) — a
  // team that only ever set a logo shouldn't show a plain gradient here while its own page
  // shows an actual image, just because this card only ever checked teamBannerUrl.
  const bannerImage =
    teamBannerUrl ||
    teamLogoUrl ||
    carSkinUrls.find((url) => /\.(png|jpe?g|webp|svg)$/i.test(url)) ||
    null

  const goToProfile = (event: React.MouseEvent) => {
    // If user clicks a button/link inside, don't trigger the card click
    const target = event.target as HTMLElement
    if (target.closest('a') || target.closest('button')) return

    if (!profileHref) return
    setIsNavigating(true)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('rsx:navigation-start'))
    }
    router.push(profileHref)
  }

  return (
    <article
      onClick={goToProfile}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--glow)] hover:shadow-[0_22px_50px_-12px_var(--glow)] ${
        profileHref ? 'cursor-pointer' : ''
      } ${isNavigating ? 'opacity-75 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : ''}`}
      style={{ '--glow': `${accent}88` } as CSSProperties}
    >
      {/* Poster band — diagonal color block when there's no banner/logo/skin photo at all, real photo (tinted) when there is */}
      <div
        className="relative h-40 w-full shrink-0 overflow-hidden"
        style={
          bannerImage
            ? undefined
            : { background: `linear-gradient(160deg, ${accent} 0%, ${accent} 42%, #0a0a0c 42.5%, #0a0a0c 100%)` }
        }
      >
        {bannerImage && (
          <Image
            src={bannerImage}
            alt={teamName}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized={!isRemoteImageOptimizable(bannerImage)}
            className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] from-10% via-[#0a0a0c]/55 via-45% to-transparent" />
        <span
          className="pointer-events-none absolute -right-2 -top-7 select-none font-display-league leading-none text-white/10"
          style={{ fontSize: initials.length <= 2 ? 110 : initials.length === 3 ? 84 : 64 }}
        >
          {initials}
        </span>

      </div>

      {/* Logo badge, straddling the band/body seam — sits above the team name row below
          it instead of on top of the banner text, so the two never overlap. */}
      <div
        className="absolute left-4 top-[136px] z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 bg-[#0a0a0c] p-1"
        style={{ borderColor: accent, boxShadow: `0 0 16px ${accent}70, 0 8px 18px rgba(0,0,0,.4)` }}
      >
        {teamLogoUrl ? (
          <Image
            src={teamLogoUrl}
            alt={teamName}
            width={48}
            height={48}
            unoptimized={!isRemoteImageOptimizable(teamLogoUrl)}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="font-display-league text-sm" style={{ color: accent }}>{initials}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 px-4 pb-4 pt-3">
        <div className="space-y-2">
          <h3 className="truncate pl-[68px] font-display-league text-[22px] leading-tight text-white">
            {teamName}
          </h3>
          {slogan && (
            <p className="truncate font-display-condensed text-[12px] italic text-slate-400" title={slogan}>
              &quot;{slogan}&quot;
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {competitionClasses.map((cl, idx) => (
              <ClassBadge key={idx} classTag={cl} />
            ))}
          </div>
        </div>

        {/* Stat bar */}
        <div className="flex items-center gap-4 border-t border-white/10 pt-2.5 font-mono-data text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" style={{ color: accent }} />
            {pilotNames.length} {pilotNames.length === 1 ? 'Piloto' : 'Pilotos'}
          </span>
          {skins.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" style={{ color: accent }} />
              {skins.length} Skins
            </span>
          )}
        </div>

        {/* Pilots list */}
        <div className="flex flex-wrap gap-1.5">
          {pilotNames.length > 0 ? (
            pilotNames.slice(0, 6).map((name, idx) => (
              <span
                key={idx}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-xs italic text-slate-500">Sin pilotos registrados</span>
          )}
          {pilotNames.length > 6 && (
            <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              +{pilotNames.length - 6}
            </span>
          )}
        </div>

        {/* Bottom downloadable skins bar */}
        {skins.length > 0 && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <span className="block font-mono-data text-[10px] uppercase tracking-widest text-slate-500">
              Descarga de Skins
            </span>
            <div className="flex flex-wrap gap-2">
              {skins.map((skin, idx) => (
                <a
                  key={idx}
                  href={skin.skinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-600/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-600/20 cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  <span>{skin.carNumber || 'Skin'}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between font-display-condensed text-[11px] font-bold uppercase tracking-wider">
          <span className="text-slate-600">&nbsp;</span>
          <span className="transition-transform group-hover:translate-x-0.5" style={{ color: accent }}>Ver equipo →</span>
        </div>
      </div>
    </article>
  )
}
