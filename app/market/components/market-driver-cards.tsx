'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Trash, MessageSquare } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { simulatorLabel } from '@/lib/utils'
import { getCountryFlagUrl, getCountryName } from '@/lib/countries'
import { useDictionary } from '@/lib/i18n/locale-provider'

export type Listing = {
  id: string
  type: 'team_seeking_driver' | 'driver_seeking_team'
  user_id: string
  user_name: string
  user_avatar: string | null
  country_code?: string | null
  countryCode?: string | null
  team_id: string | null
  team_name: string | null
  team_logo: string | null
  team_color?: string | null
  league_id?: string | null
  league_title?: string | null
  title: string
  description: string
  main_sim: string
  class_tag: string
  contact_info: string
  created_at: string
}

export type ManagedTeam = {
  id: string
  name: string
  logoUrl: string | null
}

interface MarketDriverCardsProps {
  listings: Listing[]
  currentUserId?: string
  myTeams: ManagedTeam[]
  invites: Array<{ listingId: string; teamId?: string; status: string; teamName: string }>
  isAdmin?: boolean
  onDeleteListing: (id: string) => void
  onInviteClick: (listingId: string) => void
  onViewListing?: (listing: Listing) => void
}

// No team color to draw on here (this is an individual driver, not a team), so the
// glow comes from their primary racing category instead — same hues as ClassBadge.
const CATEGORY_ACCENT: Record<string, string> = {
  GT3: '#009f00',
  LMP2: '#0072f0',
  HYPERCAR: '#e10600',
  FORMULA: '#9333ea',
}

export function MarketDriverCards({
  listings,
  currentUserId,
  myTeams,
  invites,
  isAdmin = false,
  onDeleteListing,
  onInviteClick,
  onViewListing,
}: MarketDriverCardsProps) {
  const tr = useDictionary().market.driverCards
  const myTeamIds = myTeams.map((t) => t.id)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((item) => {
        const isOwner = currentUserId === item.user_id
        const classes = String(item.class_tag || '')
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
        const myTeamInvite = invites.find(
          (inv) => inv.listingId === item.id && (Boolean(inv.teamId && myTeamIds.includes(inv.teamId)) || isOwner)
        )
        const accent = CATEGORY_ACCENT[classes[0]] || '#1274de'

        return (
          <div
            key={item.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--glow)] hover:shadow-[0_16px_40px_-10px_var(--glow)]"
            style={{ '--glow': `${accent}88` } as CSSProperties}
          >
            <div className="p-5 space-y-4">
              {/* Header: driver identity */}
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-full border overflow-hidden shrink-0 bg-slate-800"
                  style={{ borderColor: accent, boxShadow: `0 0 12px ${accent}60` }}
                >
                  <Image
                    src={
                      item.user_avatar ||
                      `https://placehold.co/48x48/0a1220/ffffff?text=${(item.user_name || 'D').slice(0, 2).toUpperCase()}`
                    }
                    alt={item.user_name}
                    width={48}
                    height={48}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">
                    <Link href={`/perfil/${item.user_id}`} className="transition-colors hover:text-cyan-400 hover:underline">
                      {item.user_name}
                    </Link>
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      {getCountryFlagUrl(item.country_code || item.countryCode || 'ES') && (
                        <span className="relative h-3 w-4 shrink-0 overflow-hidden rounded-sm">
                          <Image src={getCountryFlagUrl(item.country_code || item.countryCode || 'ES')!} alt="" fill className="object-cover" />
                        </span>
                      )}
                      <span>{getCountryName(item.country_code || item.countryCode || 'ES')}</span>
                    </span>
                    <span
                      className="font-mono-data text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{ color: accent, background: `${accent}1a`, border: `1px solid ${accent}40` }}
                    >
                      {simulatorLabel(item.main_sim)}
                    </span>
                  </div>
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
                <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider text-accent hover:underline">
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

              {myTeams.length > 0 && !isOwner && (
                <div className="shrink-0">
                  {myTeamInvite ? (
                    <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1.5 rounded">
                      {tr.invited.replace('{team}', myTeamInvite.teamName)}
                    </span>
                  ) : (
                    <button
                      onClick={() => onInviteClick(item.id)}
                      className="text-black font-display-condensed font-bold px-4 py-1.5 text-[11px] uppercase tracking-wider rounded-lg transition-transform cursor-pointer active:scale-95"
                      style={{ background: accent, boxShadow: `0 0 14px ${accent}60` }}
                    >
                      {tr.inviteDriver}
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
