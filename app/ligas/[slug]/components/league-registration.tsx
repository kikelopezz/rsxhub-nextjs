'use client'

import Image from 'next/image'
import { Plus, ShieldCheck, ShieldAlert } from 'lucide-react'
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
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  waitlist: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
}

function statusLabel(status: string, t: Dictionary['registration']['status']) {
  return (t as Record<string, string>)[status] || t.pending
}

function StatusBadge({ status }: { status: string }) {
  const dict = useDictionary()
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending
  const label = statusLabel(status, dict.registration.status)
  return (
    <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider ${style}`}>
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

  // A team can still register when it hasn't claimed every category the league
  // offers yet (e.g. it's in GT3 but the league also runs LMP2) — not just when
  // it has zero registrations at all, otherwise the button vanishes for good
  // after the team's first category and blocks adding more.
  const leagueClassTags = league.classTags || []
  const hasUnregisteredTeams = myManagedTeams.some((t) => {
    const group = groupedRegistrations.find((g) => g.teamId === t.id)
    if (!group) return true
    if (leagueClassTags.length === 0) return false
    const registeredTags = new Set(group.categories.map((c) => c.tag))
    return leagueClassTags.some((tag) => !registeredTags.has(tag))
  })

  return (
    <div className="flex flex-col items-end gap-2.5">
      {myRegisteredGroups.map((group) => {
        const teamLogo =
          group.logoUrl ||
          `https://placehold.co/60x60/0a1220/ffffff?text=${group.teamName.slice(0, 3).toUpperCase()}`

        return (
          <div
            key={group.teamId}
            className="flex items-center gap-3 rounded-xl border border-[#4ea1ff]/40 bg-black/40 px-3.5 py-2.5 shadow-[0_0_20px_rgba(78,161,255,0.15)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black">
              <Image
                src={teamLogo}
                alt={group.teamName}
                width={40}
                height={40}
                className="h-full w-full object-contain p-1"
                onError={(e) => {
                  ;(e.target as any).style.display = 'none'
                }}
              />
            </div>
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#4ea1ff]" />
                <span className="text-xs font-bold uppercase tracking-wide text-white">{group.teamName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {group.categories.map(({ tag: cat, status }) => (
                  <div key={cat} className="flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-1.5 py-0.5">
                    <ClassBadge classTag={cat} />
                    <StatusBadge status={status} />
                    {isLeader && (
                      <button
                        onClick={() => onWithdrawTeam(group.teamId, cat)}
                        title={`${t.withdraw} ${cat}`}
                        className="ml-0.5 rounded px-1 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
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

      {isLeader && league.registrationOpen && league.status === 'open' && hasUnregisteredTeams && (
        <button
          onClick={onOpenRegisterModal}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-[#4ea1ff] bg-[#1274de] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_18px_rgba(78,161,255,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f82ee] hover:shadow-[0_0_24px_rgba(78,161,255,0.7)] md:text-sm"
        >
          <Plus className="h-4 w-4" />
          {t.registerTeam}
        </button>
      )}

      {!isLeader && session && myRegisteredGroups.length === 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-left">
            <span className="block font-mono-data text-[9px] font-bold uppercase tracking-widest text-amber-400">{t.requirementTitle}</span>
            <p className="text-xs font-semibold text-amber-100">{t.requirementBody}</p>
          </div>
        </div>
      )}

      {!session && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.08)] px-3.5 py-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[#4ea1ff]" />
          <div className="text-left">
            <span className="block font-mono-data text-[9px] font-bold uppercase tracking-widest text-[#4ea1ff]">{t.accessRequiredTitle}</span>
            <p className="text-xs font-semibold text-slate-200">{t.accessRequiredBody}</p>
          </div>
        </div>
      )}
    </div>
  )
}
