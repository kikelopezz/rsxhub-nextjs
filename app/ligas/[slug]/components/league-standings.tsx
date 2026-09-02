'use client'

import Image from 'next/image'
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
  onCarImageUpload: (teamId: string, file: File) => void
  onUpdateTeamPoints?: (tag: string, teamId: string, newPoints: number) => void
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
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1420]">
      <div className="flex items-center justify-between border-b border-white/10 p-4 md:px-5">
        <h2 className="font-display-league flex items-center gap-2.5 text-2xl uppercase text-white">
          <Trophy className="h-5 w-5 text-[#f5c518]" />
          {t.title}
        </h2>
        <span className="font-mono-data text-[10px] uppercase tracking-wider text-slate-500">{t.subtitle}</span>
      </div>

      <div className="space-y-5 p-4 md:p-5">
        {classTags.map((tag) => {
          const teamList = standings[tag] || []
          const startIndex = standingsIndices[tag] || 0
          const visibleTeams = teamList.slice(startIndex, startIndex + 5)

          return (
            <div key={tag} className="overflow-hidden rounded-xl border border-white/10">
              <div className="flex items-center justify-between bg-black/30 px-3 py-2">
                <ClassBadge classTag={tag} className="px-3 py-1 text-xs font-black shadow-sm" />
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
              </div>

              {visibleTeams.length === 0 ? (
                <p className="p-4 text-xs italic text-slate-500">{t.noTeams}</p>
              ) : (
                visibleTeams.map((team) => {
                  const originalIdx = teamList.findIndex((t) => t.id === team.id)
                  const posColor = POS_COLOR[originalIdx] || '#8b96a8'
                  return (
                    <div
                      key={team.id}
                      className="flex items-center gap-3 border-t border-white/5 px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="font-display-league w-7 shrink-0 text-center text-xl" style={{ color: posColor }}>
                        {originalIdx + 1}
                      </span>

                      <Image
                        src={team.logoUrl}
                        alt={team.name}
                        width={36}
                        height={36}
                        className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-black/40 object-cover"
                      />

                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <h4 className="truncate text-sm font-bold text-white">{team.name}</h4>
                        {team.assignedNumber != null && (
                          <span className="font-mono-data shrink-0 text-xs font-bold text-[#4ea1ff]">#{team.assignedNumber}</span>
                        )}
                      </div>

                      {isAdmin ? (
                        <label
                          title={t.uploadCarPhoto}
                          className="group relative hidden h-11 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40 p-1 transition-colors hover:border-[#4ea1ff] md:flex"
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) onCarImageUpload(team.id, file)
                            }}
                          />
                          <Image
                            src={customCarImages[team.id] || team.carImageUrl || '/branding/lateral-car.png'}
                            alt="Vehicle side profile"
                            fill
                            sizes="112px"
                            quality={90}
                            className="scale-125 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-[1.35]"
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/80 text-[9px] font-black uppercase text-[#4ea1ff] opacity-0 transition-opacity group-hover:opacity-100">
                            <Upload className="h-3.5 w-3.5" /> {t.change}
                          </div>
                        </label>
                      ) : (
                        <div className="relative hidden h-11 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40 p-1 md:flex">
                          <Image
                            src={customCarImages[team.id] || team.carImageUrl || '/branding/lateral-car.png'}
                            alt="Vehicle side profile"
                            fill
                            sizes="112px"
                            quality={90}
                            className="scale-125 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                          />
                        </div>
                      )}

                      {canEditPoints ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="9999"
                            value={team.points}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                              onUpdateTeamPoints?.(tag, team.teamId || team.id, val)
                            }}
                            className="font-mono-data w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-center text-xs font-bold text-[#4ea1ff] outline-none focus:border-[#4ea1ff]"
                            title={t.editPointsTitle}
                          />
                        </div>
                      ) : (
                        <span className="font-mono-data w-16 shrink-0 text-right text-base font-bold" style={{ color: originalIdx === 0 ? '#f5c518' : '#e9edf4' }}>
                          {team.points}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>

      <p className="border-t border-white/10 py-3 text-center text-[10px] font-semibold uppercase text-slate-500">
        {t.footerNote}
      </p>
    </div>
  )
}
