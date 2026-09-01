'use client'

import Image from 'next/image'
import { Plus, CheckCircle2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { League, ManagedTeam } from '../hooks/use-league-state'
import { useDictionary } from '@/lib/i18n/locale-provider'
import type { Dictionary } from '@/lib/i18n/dictionaries/es'

interface LeagueRegistrationProps {
  league: League
  session: any
  myManagedTeams: ManagedTeam[]
  groupedRegistrations: Array<{
    teamId: string
    teamName: string
    logoUrl: string | null
    categories: Array<{ tag: string; status: string }>
  }>
  registeredCarsCount: number
  initialRegistrations?: Array<{ teamId: string | null; userId: string }>
  onOpenRegisterModal: () => void
  onWithdrawTeam: (teamId: string, classTag: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  waitlist: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  rejected: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
}

function statusLabel(status: string, t: Dictionary['registration']['status']) {
  return (t as Record<string, string>)[status] || t.pending
}

function StatusBadge({ status }: { status: string }) {
  const dict = useDictionary()
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending
  const label = statusLabel(status, dict.registration.status)
  return (
    <span className={`text-[9px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 border rounded-lg ${style}`}>
      {label}
    </span>
  )
}

export function LeagueRegistration({
  league,
  session,
  myManagedTeams,
  groupedRegistrations,
  registeredCarsCount,
  initialRegistrations = [],
  onOpenRegisterModal,
  onWithdrawTeam,
}: LeagueRegistrationProps) {
  const dict = useDictionary()
  const t = dict.registration
  const isLeader = myManagedTeams.length > 0
  const sessClean = session ? String(session.userId || session.steamId || '').replace(/^steam_/, '') : ''

  const myRegisteredGroups = groupedRegistrations.filter((group) => {
    const isManaged = myManagedTeams.some((t) => t.id === group.teamId)
    const isMember = initialRegistrations.some(
      (r) => r.teamId === group.teamId && String(r.userId || '').replace(/^steam_/, '') === sessClean
    )
    return isManaged || isMember
  })

  const hasUnregisteredTeams = myManagedTeams.some(
    (t) => !groupedRegistrations.some((group) => group.teamId === t.id)
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Show teams managed by OR belonging to the logged-in user */}
      {myRegisteredGroups.map((group) => {
        const teamLogo =
          group.logoUrl ||
          `https://placehold.co/60x60/0a1220/ffffff?text=${group.teamName.slice(0, 3).toUpperCase()}`

        return (
          <div
            key={group.teamId}
            className="border-2 border-cyan-500/70 bg-gradient-to-r from-cyan-950/90 via-black/95 to-black/90 px-4 py-2.5 shadow-[0_0_25px_rgba(0,242,254,0.25)] flex items-center gap-3.5 relative rounded-lg"
          >
            {/* Team Logo Badge */}
            <div className="h-12 w-12 md:h-14 md:w-14 border-2 border-cyan-400/50 bg-black flex items-center justify-center overflow-hidden shrink-0 shadow-md">
              <Image
                src={teamLogo}
                alt={group.teamName}
                width={56}
                height={56}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  ;(e.target as any).style.display = 'none'
                }}
              />
            </div>

            {/* Team Details */}
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="font-black text-white text-sm md:text-base uppercase tracking-wide leading-none">
                  {group.teamName}
                </span>
                <span className="text-[9px] md:text-[10px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 uppercase tracking-wider">
                  {t.yourTeamRegistered}
                </span>
              </div>

              {/* Categories Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {group.categories.map(({ tag: cat, status }) => (
                  <div key={cat} className="flex items-center gap-1.5 bg-black/90 px-2 py-0.5 border border-white/20">
                    <ClassBadge classTag={cat} />
                    <StatusBadge status={status} />
                    {isLeader && (
                      <button
                        onClick={() => onWithdrawTeam(group.teamId, cat)}
                        title={`${t.withdraw} ${cat}`}
                        className="ml-0.5 text-rose-400 hover:text-rose-300 font-bold hover:bg-rose-500/20 px-1 text-xs transition-colors cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Action Button for Team Leaders (Only if team isn't registered yet) */}
      {isLeader && league.registrationOpen && league.status === 'open' && hasUnregisteredTeams && (
        <button
          onClick={onOpenRegisterModal}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-4 py-3 text-xs md:text-sm uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(0,242,254,0.35)] shrink-0 cursor-pointer"
        >
          <Plus className="h-5 w-5" />
          {t.registerTeam}
        </button>
      )}

      {/* Notice box ONLY when user is logged in, NOT a team leader, AND has no registered team in this league */}
      {!isLeader && session && myRegisteredGroups.length === 0 && (
        <div className="border border-amber-500/40 bg-gradient-to-r from-amber-950/80 via-black/90 to-amber-950/60 px-4 py-2.5 shadow-[0_0_20px_rgba(245,158,11,0.15)] flex items-center gap-3 rounded-lg">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="text-left space-y-0.5">
            <span className="text-[10px] font-mono font-extrabold text-amber-400 uppercase tracking-widest block">
              {t.requirementTitle}
            </span>
            <p className="text-xs font-bold text-amber-100">
              {t.requirementBody}
            </p>
          </div>
        </div>
      )}

      {/* Notice box when user is NOT logged in */}
      {!session && (
        <div className="border border-cyan-500/40 bg-gradient-to-r from-cyan-950/80 via-black/90 to-cyan-950/60 px-4 py-2.5 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex items-center gap-3 rounded-lg">
          <ShieldAlert className="h-5 w-5 text-cyan-400 shrink-0" />
          <div className="text-left space-y-0.5">
            <span className="text-[10px] font-mono font-extrabold text-cyan-400 uppercase tracking-widest block">
              {t.accessRequiredTitle}
            </span>
            <p className="text-xs font-bold text-cyan-100">
              {t.accessRequiredBody}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
