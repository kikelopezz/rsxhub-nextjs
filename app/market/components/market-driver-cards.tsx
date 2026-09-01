'use client'

import Image from 'next/image'
import { Trash, MessageSquare } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { simulatorLabel } from '@/lib/utils'
import { getCountryFlag, getCountryName } from '@/lib/countries'
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
  title: string
  description: string
  main_sim: 'ac' | 'lmu'
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
  onDeleteListing: (id: string) => void
  onInviteClick: (listingId: string) => void
}

export function MarketDriverCards({
  listings,
  currentUserId,
  myTeams,
  invites,
  onDeleteListing,
  onInviteClick,
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

        return (
          <div
            key={item.id}
            className="shell-panel rounded-lg border border-shell-line flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_16px_36px_rgba(6,182,212,0.12)] overflow-hidden"
          >
            <div className="p-5 space-y-4">
              {/* Header: driver identity */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                  <Image
                    src={
                      item.user_avatar ||
                      `https://placehold.co/48x48/0a1220/ffffff?text=${(item.user_name || 'D').slice(0, 2).toUpperCase()}`
                    }
                    alt={item.user_name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">
                    {item.user_name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>{getCountryFlag(item.country_code || item.countryCode || 'ES')}</span>
                      <span>{getCountryName(item.country_code || item.countryCode || 'ES')}</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                      {simulatorLabel(item.main_sim)}
                    </span>
                  </div>
                </div>
                {isOwner && (
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
              <div>
                <h3 className="text-base font-bold text-white leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-3 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Class Badges */}
              <div className="flex flex-wrap gap-1.5">
                {classes.map((cls) => (
                  <ClassBadge key={cls} classTag={cls} />
                ))}
              </div>
            </div>

            {/* Contact & Actions */}
            <div className="border-t border-shell-line bg-black/20 px-5 py-3.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-400 text-xs truncate min-w-0">
                <MessageSquare className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
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
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors cursor-pointer"
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
