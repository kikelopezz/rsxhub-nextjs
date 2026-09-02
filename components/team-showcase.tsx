'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Download, Users, ArrowRight, Shield } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'

type TeamShowcaseProps = {
  teamName: string
  teamLogoUrl?: string | null
  teamBannerUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  slogan?: string | null
  competitionClasses?: string[]
  carSkinUrls?: string[]
  pilotNames: string[]
  profileHref?: string
  skins?: Array<{ skinUrl: string; leagueSlug: string; carNumber?: string | null }>
}

const isOptimizable = (url?: string | null) => {
  if (!url) return false
  return url.includes('supabase.co') || url.includes('steamstatic.com') || url.includes('unsplash.com') || url.startsWith('/')
}

export function TeamShowcase({
  teamName,
  teamLogoUrl,
  teamBannerUrl,
  primaryColor,
  accentColor,
  slogan,
  competitionClasses = [],
  pilotNames = [],
  profileHref,
  skins = [],
}: TeamShowcaseProps) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const barColor = accentColor || primaryColor || '#ff3a3a'

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
      className={`hud-corners group relative flex flex-col overflow-hidden border border-shell-line bg-[#090d16]/95 rounded-lg shadow-[0_10px_28px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_44px_rgba(0,0,0,0.55)] ${
        profileHref ? 'cursor-pointer' : ''
      } ${isNavigating ? 'opacity-75 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : ''}`}
    >
      {/* Banner header with logo overlap */}
      <div className="relative h-28 w-full overflow-hidden shrink-0" style={{ background: `linear-gradient(135deg, ${barColor}33, #05070c 80%)` }}>
        {teamBannerUrl ? (
          <Image
            src={teamBannerUrl}
            alt={teamName}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized={!isOptimizable(teamBannerUrl)}
            className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/20 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${barColor}, transparent)` }} />

        {profileHref && (
          <button
            onClick={() => router.push(profileHref)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center border border-white/15 bg-black/50 text-slate-300 backdrop-blur-sm transition-colors hover:text-white hover:border-white/30 cursor-pointer"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Logo badge, overlapping the banner/body seam — deliberately a sibling of the
          banner div (not nested inside it) so the banner's own overflow-hidden (needed
          to clip/scale the banner image) doesn't clip the logo along with it. */}
      <div
        className="absolute left-4 top-[88px] z-10 flex h-16 w-16 shrink-0 items-center justify-center bg-[#090d16] border-2 shadow-lg p-1"
        style={{ borderColor: barColor }}
      >
        {teamLogoUrl ? (
          <Image
            src={teamLogoUrl}
            alt={teamName}
            width={56}
            height={56}
            unoptimized={!isOptimizable(teamLogoUrl)}
            className="h-full w-full object-contain"
          />
        ) : (
          <Users className="h-6 w-6 text-slate-500" />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-between px-4 pb-4 pt-8 space-y-4">
        <div className="space-y-2">
          <div>
            <h3 className="truncate text-lg font-black uppercase italic tracking-wider text-white transition-colors" style={{ '--tw-text-opacity': 1 } as any}>
              {teamName}
            </h3>
            {slogan && (
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase italic truncate" title={slogan}>
                &quot;{slogan}&quot;
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {competitionClasses.map((cl, idx) => (
              <ClassBadge key={idx} classTag={cl} />
            ))}
          </div>
        </div>

        {/* Stat bar */}
        <div className="flex items-center gap-4 border-y border-shell-line/60 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" style={{ color: barColor }} />
            {pilotNames.length} {pilotNames.length === 1 ? 'Piloto' : 'Pilotos'}
          </span>
          {skins.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" style={{ color: barColor }} />
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
                className="bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300 rounded-lg"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-slate-500 text-xs italic">Sin pilotos registrados</span>
          )}
          {pilotNames.length > 6 && (
            <span className="bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-400 rounded-lg">
              +{pilotNames.length - 6}
            </span>
          )}
        </div>

        {/* Bottom Downloadable Skins Bar */}
        {skins.length > 0 && (
          <div className="pt-3 border-t border-shell-line/50 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
              Descarga de Skins
            </span>
            <div className="flex flex-wrap gap-2">
              {skins.map((skin, idx) => (
                <a
                  key={idx}
                  href={skin.skinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-300 transition-colors cursor-pointer rounded-lg"
                >
                  <Download className="h-3 w-3" />
                  <span>{skin.carNumber || 'Skin'}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
