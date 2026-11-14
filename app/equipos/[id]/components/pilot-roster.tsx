'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { PilotStats } from '../team-utils'

type RosterPilot = {
  userId: string
  name: string
  role: string
  roleTags: string[]
  avatarUrl: string | null
}

type PilotRosterLabels = {
  ownerLeader: string
  managerCoFounder: string
  driverBadge: string
  statsTitle: string
  selectPilotHint: string
  viewFullProfile: string
  pilotWins: string
  pilotPodiums: string
  pilotRaces: string
  pilotDnf: string
  pilotDsq: string
  recentResultsTitle: string
  noPilotResults: string
  position: string
  points: string
  pts: string
}

type PilotRosterProps = {
  pilots: RosterPilot[]
  pilotStatsByUserId: Record<string, PilotStats>
  tagLabels: Record<string, string>
  labels: PilotRosterLabels
  accentSoft: string
  accentHard: string
}

export function PilotRoster({ pilots, pilotStatsByUserId, tagLabels, labels: t, accentSoft, accentHard }: PilotRosterProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const selectedPilot = pilots.find((p) => p.userId === selectedUserId) || null
  const selectedStats = selectedPilot ? pilotStatsByUserId[selectedPilot.userId] : undefined

  return (
    <div className="mt-3 flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-1 flex-wrap gap-3">
        {pilots.map((pilot) => {
          const isSelected = pilot.userId === selectedUserId
          return (
            <button
              key={pilot.userId}
              type="button"
              title={pilot.name}
              onClick={() => setSelectedUserId(isSelected ? null : pilot.userId)}
              className={`block w-[150px] shrink-0 cursor-pointer overflow-hidden rounded-xl border bg-[#111114] text-left transition-all hover:-translate-y-0.5 hover:border-white/30 hover:shadow-[0_0_18px_rgba(78,161,255,0.25)] ${
                isSelected ? 'border-white/40 shadow-[0_0_18px_rgba(78,161,255,0.3)]' : 'border-white/10'
              }`}
            >
              <div
                className="flex h-20 items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${accentSoft}, rgba(10,10,12,0.9))` }}
              >
                {pilot.avatarUrl ? (
                  <Image src={pilot.avatarUrl} alt={pilot.name} width={56} height={56} unoptimized className="h-14 w-14 rounded-lg border border-white/25 object-cover" />
                ) : (
                  <span className="font-display-league text-3xl text-white">{pilot.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate font-display-condensed text-sm font-bold text-white">{pilot.name}</p>
                <p className="mt-0.5 font-mono-data text-[9px] uppercase tracking-wider text-slate-500">
                  {pilot.role === 'owner' ? t.ownerLeader : pilot.role === 'manager' ? t.managerCoFounder : t.driverBadge}
                </p>
                {pilot.roleTags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {pilot.roleTags.map((tag) => (
                      <span key={tag} className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono-data text-[8px] font-bold uppercase tracking-wider text-cyan-300">
                        {tagLabels[tag] || tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="w-full shrink-0 rounded-xl border border-white/10 bg-[#111114] p-4 lg:w-80">
        {!selectedPilot ? (
          <div className="flex h-full min-h-[200px] items-center justify-center text-center">
            <p className="text-xs italic text-slate-500">{t.selectPilotHint}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              {selectedPilot.avatarUrl ? (
                <Image src={selectedPilot.avatarUrl} alt={selectedPilot.name} width={44} height={44} unoptimized className="h-11 w-11 rounded-lg border border-white/20 object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/5 font-display-league text-lg text-white">
                  {selectedPilot.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-display-condensed text-base font-bold text-white">{selectedPilot.name}</p>
                <Link href={`/perfil/${selectedPilot.userId}`} className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400 hover:underline">
                  {t.viewFullProfile}
                </Link>
              </div>
            </div>

            <div>
              <p className="font-mono-data text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t.statsTitle}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  { label: t.pilotWins, value: selectedStats?.wins ?? 0 },
                  { label: t.pilotPodiums, value: selectedStats?.podiums ?? 0 },
                  { label: t.pilotRaces, value: selectedStats?.racesRun ?? 0 },
                  { label: t.pilotDnf, value: selectedStats?.dnf ?? 0 },
                  { label: t.pilotDsq, value: selectedStats?.dsq ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-[#0a0a0c] p-2 text-center">
                    <p className="font-display-league text-xl leading-none text-white">{item.value}</p>
                    <p className="mt-1 font-mono-data text-[8px] uppercase tracking-wider text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono-data text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t.recentResultsTitle}</p>
              {!selectedStats || selectedStats.recentResults.length === 0 ? (
                <p className="mt-2 text-xs italic text-slate-500">{t.noPilotResults}</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {selectedStats.recentResults.map((result) => (
                    <div key={result.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0a0a0c] p-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono-data text-[8px] font-semibold uppercase tracking-wider text-slate-500">{result.leagueTitle}</p>
                        <p className="truncate font-display-condensed text-xs font-bold text-white">{result.eventTitle}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-right">
                        <span className="font-display-league text-sm leading-none text-white">P{result.position}</span>
                        <span className="font-display-league text-sm leading-none text-emerald-400">{result.points ?? 0} {t.pts}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
