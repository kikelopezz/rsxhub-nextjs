'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Trophy, ChevronUp, ChevronDown, Upload } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { TeamStanding } from '../hooks/use-league-state'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface LeagueStandingsProps {
  isAdmin?: boolean
  canEditPoints?: boolean
  classTags: string[]
  standings: Record<string, TeamStanding[]>
  standingsIndices: Record<string, number>
  customCarImages: Record<string, string>
  onScrollStandings: (tag: string, direction: 'up' | 'down') => void
  onCarImageUpload: (classTag: string, teamId: string, carNumber: string, file: File) => void
  onUpdateTeamPoints?: (tag: string, teamId: string, carNumber: string, newPoints: number) => void
}

const POS_COLOR = ['#f5c518', '#c7cdd6', '#c98246']

export function LeagueStandings({
  isAdmin = false,
  canEditPoints = false,
  classTags,
  standings,
  standingsIndices,
  customCarImages,
  onScrollStandings,
  onCarImageUpload,
  onUpdateTeamPoints,
}: LeagueStandingsProps) {
  const t = useDictionary().ligas.standings
  const [activeTag, setActiveTag] = useState<string>(classTags[0] || 'GT3')
  const tag = classTags.includes(activeTag) ? activeTag : classTags[0]

  const teamList = standings[tag] || []
  const startIndex = standingsIndices[tag] || 0
  const visibleTeams = teamList.slice(startIndex, startIndex + 5)
  const maxPoints = teamList[0]?.points || 0

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1420]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 md:px-5">
        <h2 className="font-display-league flex items-center gap-2.5 text-2xl uppercase text-white">
          <Trophy className="h-5 w-5 text-[#f5c518]" />
          {t.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-white/10 bg-[#0a0f18] p-1">
            {classTags.map((tg) => (
              <button
                key={tg}
                type="button"
                onClick={() => setActiveTag(tg)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                  tg === tag ? 'bg-[#1274de]' : 'hover:bg-white/5'
                }`}
              >
                <ClassBadge classTag={tg} className="text-[10px] font-black" />
                <span className="font-mono-data text-[10px] font-bold text-slate-400">{(standings[tg] || []).length}</span>
              </button>
            ))}
          </div>

          {teamList.length > 5 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onScrollStandings(tag, 'up')}
                disabled={startIndex === 0}
                className="rounded-md border border-white/10 bg-black/40 p-1 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff] disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-slate-400"
                title={t.scrollUp}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono-data px-1 text-[10px] uppercase text-slate-500">
                {t.ofRange
                  .replace('{from}', String(startIndex + 1))
                  .replace('{to}', String(Math.min(startIndex + 5, teamList.length)))
                  .replace('{total}', String(teamList.length))}
              </span>
              <button
                onClick={() => onScrollStandings(tag, 'down')}
                disabled={startIndex >= teamList.length - 5}
                className="rounded-md border border-white/10 bg-black/40 p-1 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff] disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-slate-400"
                title={t.scrollDown}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-2 md:p-3">
        {visibleTeams.length === 0 ? (
          <p className="p-6 text-center text-xs italic text-slate-500">{t.noTeams}</p>
        ) : (
          visibleTeams.map((team) => {
            const originalIdx = teamList.findIndex((tm) => tm.id === team.id)
            const posColor = POS_COLOR[originalIdx] || '#4b5566'
            const barPct = maxPoints > 0 ? Math.max(2, Math.round((team.points / maxPoints) * 100)) : 0
            const gap = team.points - maxPoints

            const carKey = `${tag}_${team.id}`

            return (
              <div
                key={team.id}
                className="grid grid-cols-[44px_36px_1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.02] md:grid-cols-[44px_36px_1fr_256px_auto]"
              >
                <span className="font-display-league text-center text-2xl leading-none" style={{ color: posColor }}>
                  {originalIdx + 1}
                </span>

                <Image
                  src={team.logoUrl}
                  alt={team.name}
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-black/40 object-cover"
                />

                <div className="min-w-0">
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <h4 className="truncate text-sm font-black uppercase tracking-wide text-white">{team.name}</h4>
                    {team.assignedNumber != null && (
                      <span className="font-mono-data shrink-0 text-[11px] font-bold text-[#4ea1ff]">#{team.assignedNumber}</span>
                    )}
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barPct}%`,
                        background: originalIdx === 0 ? 'linear-gradient(90deg,#b8930f,#f5c518)' : 'linear-gradient(90deg,#1274de,#4ea1ff)',
                      }}
                    />
                  </div>
                </div>

                {isAdmin ? (
                  <label
                    title={t.uploadCarPhoto}
                    className="group relative hidden h-28 w-64 shrink-0 cursor-pointer items-center justify-center overflow-visible transition-opacity hover:opacity-90 md:flex"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onCarImageUpload(tag, team.teamId || '', String(team.assignedNumber ?? ''), file)
                      }}
                    />
                    <Image
                      src={customCarImages[carKey] || team.carImageUrl || '/branding/lateral-car.png'}
                      alt="Vehicle side profile"
                      fill
                      sizes="256px"
                      quality={90}
                      className="object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/80 text-[9px] font-black uppercase text-[#4ea1ff] opacity-0 transition-opacity group-hover:opacity-100">
                      <Upload className="h-3.5 w-3.5" /> {t.change}
                    </div>
                  </label>
                ) : (
                  <Link
                    href={`/equipos/${team.teamId || team.id}`}
                    title={team.name}
                    className="relative hidden h-28 w-64 shrink-0 items-center justify-center transition-transform hover:scale-105 md:flex"
                  >
                    <Image
                      src={customCarImages[carKey] || team.carImageUrl || '/branding/lateral-car.png'}
                      alt="Vehicle side profile"
                      fill
                      sizes="256px"
                      quality={90}
                      className="object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    />
                  </Link>
                )}

                {canEditPoints ? (
                  <input
                    type="number"
                    min="0"
                    max="9999"
                    value={team.points}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                      onUpdateTeamPoints?.(tag, team.teamId || team.id, team.assignedNumber != null ? String(team.assignedNumber) : '', val)
                    }}
                    className="font-mono-data w-16 shrink-0 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-center text-xs font-bold text-[#4ea1ff] outline-none focus:border-[#4ea1ff]"
                    title={t.editPointsTitle}
                  />
                ) : (
                  <div className="w-16 shrink-0 text-right">
                    <div className="font-display-league text-xl leading-none text-white">{team.points}</div>
                    <div className="font-mono-data mt-0.5 text-[9px] uppercase" style={{ color: originalIdx === 0 ? '#f5c518' : '#5b6474' }}>
                      {originalIdx === 0 ? t.leader : gap}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <p className="border-t border-white/10 py-3 text-center text-[10px] font-semibold uppercase text-slate-500">
        {t.footerNote}
      </p>
    </div>
  )
}
