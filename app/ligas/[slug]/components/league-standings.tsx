'use client'

import Image from 'next/image'
import { Users, ChevronUp, ChevronDown, Upload } from 'lucide-react'
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
    <aside className="shell-panel p-4 md:p-5 rounded-lg space-y-4 flex flex-col justify-between">
      <div>
        <div className="border-b border-shell-line pb-3 mb-4">
          <h2 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            {t.title}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.subtitle}
          </p>
        </div>

        <div className="space-y-6">
          {classTags.map((tag) => {
            const teamList = standings[tag] || []
            const startIndex = standingsIndices[tag] || 0
            const visibleTeams = teamList.slice(startIndex, startIndex + 5)

            return (
              <div key={tag} className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">{t.category}</span>
                    <ClassBadge classTag={tag} className="text-xs px-3 py-1 font-black shadow-sm" />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onScrollStandings(tag, 'up')}
                      disabled={startIndex === 0}
                      className="border border-slate-700 bg-black/30 hover:bg-slate-800 hover:text-cyan-400 p-1 rounded-lg disabled:opacity-30 disabled:hover:bg-black/30 disabled:hover:text-white transition-colors"
                      title={t.scrollUp}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[10px] text-slate-400 px-1 font-mono uppercase">
                      {t.ofRange
                        .replace('{from}', String(startIndex + 1))
                        .replace('{to}', String(Math.min(startIndex + 5, teamList.length)))
                        .replace('{total}', String(teamList.length))}
                    </span>
                    <button
                      onClick={() => onScrollStandings(tag, 'down')}
                      disabled={startIndex >= teamList.length - 5}
                      className="border border-slate-700 bg-black/30 hover:bg-slate-800 hover:text-cyan-400 p-1 rounded-lg disabled:opacity-30 disabled:hover:bg-black/30 disabled:hover:text-white transition-colors"
                      title={t.scrollDown}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {visibleTeams.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">{t.noTeams}</p>
                  ) : (
                    visibleTeams.map((team) => {
                      const originalIdx = teamList.findIndex((t) => t.id === team.id)
                      return (
                        <div
                          key={team.id}
                          className="border border-shell-line bg-black/40 p-2 md:p-2.5 rounded-lg flex items-center justify-between gap-3 hover:border-slate-500 transition-colors"
                        >
                          {/* 1. Pos */}
                          <span
                            className={`w-7 text-center text-sm font-black shrink-0 ${
                              originalIdx === 0
                                ? 'text-amber-400'
                                : originalIdx === 1
                                ? 'text-slate-300'
                                : originalIdx === 2
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {originalIdx === 0 ? '🥇' : originalIdx === 1 ? '🥈' : originalIdx === 2 ? '🥉' : originalIdx + 1}
                          </span>

                          {/* 2. Logo equipo */}
                          <Image
                            src={team.logoUrl}
                            alt={team.name}
                            width={40}
                            height={40}
                            className="w-9 h-9 md:w-10 md:h-10 object-cover border border-slate-700 rounded-lg shrink-0"
                          />

                          {/* 3. Nombre Equipo + Dorsal (sin recuadro azul) */}
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <h4 className="text-sm font-extrabold uppercase text-white truncate leading-tight">
                              {team.name}
                            </h4>
                            {team.assignedNumber != null && (
                              <span className="text-xs font-mono font-black text-cyan-300 shrink-0">
                                #{team.assignedNumber}
                              </span>
                            )}
                          </div>

                          {/* 4. Foto del carro (sólo editable para admins) */}
                          {isAdmin ? (
                            <label
                              title={t.uploadCarPhoto}
                              className="h-12 w-32 md:w-40 bg-black/60 border border-slate-700 hover:border-cyan-400 flex items-center justify-center shrink-0 overflow-hidden relative p-1 cursor-pointer group transition-colors"
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
                                sizes="160px"
                                quality={90}
                                className="object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] scale-125 group-hover:scale-135 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/80 text-[9px] font-black text-cyan-300 uppercase flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                <Upload className="h-3.5 w-3.5" /> {t.change}
                              </div>
                            </label>
                          ) : (
                            <div className="h-12 w-32 md:w-40 bg-black/60 border border-slate-700/60 flex items-center justify-center shrink-0 overflow-hidden relative p-1">
                              <Image
                                src={customCarImages[team.id] || team.carImageUrl || '/branding/lateral-car.png'}
                                alt="Vehicle side profile"
                                fill
                                sizes="160px"
                                quality={90}
                                className="object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] scale-125 transition-transform"
                              />
                            </div>
                          )}

                          {/* 5. Puntos (Editable únicamente para Administradores y Stewards) */}
                          {canEditPoints ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min="0"
                                max="9999"
                                value={team.points}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                                  onUpdateTeamPoints?.(tag, team.teamId || team.id, val)
                                }}
                                className="w-16 bg-slate-900 text-cyan-300 font-mono font-black text-xs px-2 py-1 border border-slate-700 focus:border-cyan-400 text-center rounded-lg"
                                title={t.editPointsTitle}
                              />
                              <span className="text-[10px] font-bold text-slate-400 font-mono">{t.points}</span>
                            </div>
                          ) : (
                            <span className="text-sm font-black text-white bg-black/80 px-3 py-1 border border-white/10 font-mono shrink-0 min-w-[60px] text-center">
                              {team.points} {t.points}
                            </span>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] text-slate-500 font-semibold uppercase text-center mt-4">
        {t.footerNote}
      </p>
    </aside>
  )
}
