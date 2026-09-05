'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'
import { Trash, MessageSquare, Users } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { simulatorLabel } from '@/lib/utils'
import { Listing } from './market-driver-cards'
import { useDictionary } from '@/lib/i18n/locale-provider'

export type MarketApplication = {
  id: string
  listingId: string
  teamId: string
  userId: string
  userName: string
  userAvatar: string | null
  contactInfo: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
}

interface MarketTeamOffersProps {
  listings: Listing[]
  currentUserId?: string
  applications: MarketApplication[]
  belongsToTeam?: boolean
  isAdmin?: boolean
  onDeleteListing: (id: string) => void
  onApplyClick: (listingId: string) => void
  onWithdrawApplication: (listingId: string, applicationId?: string) => void
  onViewListing?: (listing: Listing) => void
}

export function MarketTeamOffers({
  listings,
  currentUserId,
  applications,
  belongsToTeam = false,
  isAdmin = false,
  onDeleteListing,
  onApplyClick,
  onWithdrawApplication,
  onViewListing,
}: MarketTeamOffersProps) {
  const tr = useDictionary().market.teamOffers
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((item) => {
        const isOwner = currentUserId === item.user_id
        const classes = String(item.class_tag || '')
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
        const myApplication = currentUserId
          ? applications.find((app) => {
              const appUserClean = String(app.userId || '').replace(/^steam_/, '')
              const currUserClean = String(currentUserId || '').replace(/^steam_/, '')
              const userMatches = !app.userId || appUserClean === currUserClean
              const listingMatches =
                app.listingId === item.id ||
                app.id === item.id ||
                (Boolean(item.team_id) && app.teamId === item.team_id)
              return userMatches && listingMatches
            })
          : null

        const accent = item.team_color || '#1274de'

        return (
          <div
            key={item.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--glow)] hover:shadow-[0_16px_40px_-10px_var(--glow)]"
            style={{ '--glow': `${accent}88` } as CSSProperties}
          >
            <div className="p-5 space-y-4">
              {/* Header: team identity */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-[#111114] p-1.5"
                  style={{ borderColor: accent, boxShadow: `0 0 12px ${accent}60` }}
                >
                  {item.team_logo ? (
                    <Image src={item.team_logo} alt={item.team_name || ''} width={48} height={48} unoptimized className="w-full h-full object-contain" />
                  ) : (
                    <Users className="h-5 w-5" style={{ color: accent }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">
                    {item.team_name || tr.teamOfferFallback}
                  </h4>
                  <span
                    className="inline-flex mt-0.5 font-mono-data text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ color: accent, background: `${accent}1a`, border: `1px solid ${accent}40` }}
                  >
                    {simulatorLabel(item.main_sim)}
                  </span>
                </div>
                {(isOwner || isAdmin) && (
                  <button
                    onClick={() => onDeleteListing(item.id)}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                    title={tr.deleteListing}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Who actually posted this — distinct from the team identity above, since
                  any team member (not just the owner) can be the one who published it. */}
              <div className="flex items-center gap-2 -mt-1">
                <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                  <Image
                    src={item.user_avatar || `https://placehold.co/20x20/0a1220/ffffff?text=${(item.user_name || 'D').slice(0, 1).toUpperCase()}`}
                    alt={item.user_name}
                    width={20}
                    height={20}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="truncate text-[10px] text-slate-500">
                  Publicado por <span className="font-semibold text-slate-400">{item.user_name}</span>
                </span>
              </div>

              {/* Listing title & description */}
              <button
                type="button"
                onClick={() => onViewListing?.(item)}
                className="block w-full text-left cursor-pointer"
              >
                <h3 className="text-base font-bold text-white leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-3 leading-relaxed">
                  {item.description}
                </p>
                <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                  Ver anuncio completo
                </span>
              </button>

              {/* Class Badges */}
              <div className="flex flex-wrap gap-1.5">
                {classes.map((cls) => (
                  <ClassBadge key={cls} classTag={cls} />
                ))}
                {item.league_title && (
                  <span className="inline-flex items-center rounded px-2 py-0.5 font-mono-data text-[10px] font-semibold uppercase tracking-wider text-slate-300 border border-white/15 bg-white/5">
                    {item.league_title}
                  </span>
                )}
              </div>
            </div>

            {/* Contact & Actions */}
            <div className="border-t border-white/10 bg-black/20 px-5 py-3.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-400 text-xs truncate min-w-0 font-mono-data">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
                <span className="truncate">{item.contact_info}</span>
              </span>

              {!isOwner && (
                <div className="shrink-0">
                  {!currentUserId ? (
                    <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded">
                      {tr.logInToApply}
                    </span>
                  ) : myApplication && myApplication.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1.5 rounded">
                        {tr.pending}
                      </span>
                      <button
                        type="button"
                        onClick={() => onWithdrawApplication(item.id, myApplication?.id)}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                      >
                        {tr.withdraw}
                      </button>
                    </div>
                  ) : belongsToTeam ? (
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-400 bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded">
                      {tr.alreadyInTeam}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onApplyClick(item.id)}
                      className="text-black font-display-condensed font-bold px-4 py-1.5 text-[11px] uppercase tracking-wider rounded-lg transition-transform cursor-pointer active:scale-95"
                      style={{ background: accent, boxShadow: `0 0 14px ${accent}60` }}
                    >
                      {tr.applyNow}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
