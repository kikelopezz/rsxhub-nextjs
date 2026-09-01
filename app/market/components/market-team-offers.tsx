'use client'

import Image from 'next/image'
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
  onDeleteListing: (id: string) => void
  onApplyClick: (listingId: string) => void
  onWithdrawApplication: (listingId: string, applicationId?: string) => void
}

export function MarketTeamOffers({
  listings,
  currentUserId,
  applications,
  belongsToTeam = false,
  onDeleteListing,
  onApplyClick,
  onWithdrawApplication,
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

        return (
          <div
            key={item.id}
            className="shell-panel rounded-lg border border-shell-line flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_16px_36px_rgba(6,182,212,0.12)] overflow-hidden"
          >
            <div className="p-5 space-y-4">
              {/* Header: team identity */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                  {item.team_logo ? (
                    <Image src={item.team_logo} alt={item.team_name || ''} width={48} height={48} className="w-full h-full object-contain" />
                  ) : (
                    <Users className="h-5 w-5 text-cyan-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">
                    {item.team_name || tr.teamOfferFallback}
                  </h4>
                  <span className="inline-flex mt-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                    {simulatorLabel(item.main_sim)}
                  </span>
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
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors cursor-pointer shadow-sm active:scale-95"
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
