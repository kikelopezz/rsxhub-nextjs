'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { History } from 'lucide-react'
import { DeleteTeamButtonDouble } from '@/components/delete-team-button-double'
import type { LineupChangeLogEntry } from '@/lib/admin-lineup-log'

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  if (status === 'rejected') return 'border-rose-500/40 bg-rose-500/10 text-rose-300'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
}

type Team = any
type League = { id: string; title: string }

type Props = {
  teams: Team[]
  leagues: League[]
  unseenLineupChangeTeamIds: string[]
  recentLineupChanges: LineupChangeLogEntry[]
  t: any
  deleteAction: (teamId: string) => Promise<void>
  updateStatusAction: (formData: FormData) => void | Promise<void>
  markSeenAction: () => Promise<void>
}

export function AdminTeamsTable({
  teams,
  leagues,
  unseenLineupChangeTeamIds,
  recentLineupChanges,
  t,
  deleteAction,
  updateStatusAction,
  markSeenAction,
}: Props) {
  const [leagueFilter, setLeagueFilter] = useState('all')
  const unseenSet = useMemo(() => new Set(unseenLineupChangeTeamIds), [unseenLineupChangeTeamIds])

  // Only clears the blink after the admin has actually seen this tab render in their
  // browser (not on a Link prefetch, which would fire this before the tab was opened).
  useEffect(() => {
    if (unseenSet.size > 0) {
      markSeenAction()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredTeams = leagueFilter === 'all' ? teams : teams.filter((team) => team.leagueId === leagueFilter)

  return (
    <div className="space-y-4">
      {recentLineupChanges.length > 0 && (
        <details className="rounded-lg border border-shell-line bg-black/20">
          <summary className="flex cursor-pointer items-center gap-2 p-3 text-xs font-bold uppercase tracking-wider text-slate-300">
            <History className="h-3.5 w-3.5 text-cyan-400" />
            Registro de cambios de alineación ({recentLineupChanges.length})
          </summary>
          <div className="max-h-[220px] space-y-1.5 overflow-y-auto border-t border-shell-line p-3">
            {recentLineupChanges.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <span>
                  <Link href={`/equipos/${entry.teamId}`} className="font-bold text-white hover:text-cyan-300">
                    {entry.teamName}
                  </Link>{' '}
                  — {entry.changedByName}
                </span>
                <span className="font-mono-data shrink-0 text-slate-500">
                  {new Date(entry.changedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.filterByLeague}</label>
        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="rounded-lg border border-shell-line bg-black/45 px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none cursor-pointer focus:border-white/30"
        >
          <option value="all">{t.allLeagues}</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>{league.title}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-shell-line bg-black/10">
        <table className="w-full min-w-[600px] text-left border-collapse">
          <thead>
            <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
              <th className="p-3">{t.colLogo}</th>
              <th className="p-3">{t.colTeamName}</th>
              <th className="p-3">{t.colTeamLeader}</th>
              <th className="p-3 text-center">{t.colDrivers}</th>
              <th className="p-3">{t.colCategories}</th>
              <th className="p-3">{t.colStatus}</th>
              <th className="p-3 text-right">{t.colActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-slate-300">
            {filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">{t.noTeams}</td>
              </tr>
            ) : (
              filteredTeams.map((team) => {
                const leaderName = team.members.find((m: any) => m.role === 'owner')?.displayName || t.unassigned
                const status = team.status || 'approved'
                const statusLabel = status === 'approved' ? t.statusApproved : status === 'rejected' ? t.statusRejected : t.statusPending
                const justChanged = unseenSet.has(team.id)
                return (
                  <tr
                    key={team.id}
                    className={`transition-colors hover:bg-white/[0.02] ${justChanged ? 'animate-pulse bg-amber-500/10' : ''}`}
                    title={justChanged ? t.recentLineupChange : undefined}
                  >
                    <td className="p-3">
                      <Link href={`/equipos/${team.id}`}>
                        {team.logoUrl ? (
                          <Image src={team.logoUrl} alt={team.name} width={32} height={32} className="h-8 w-8 object-contain" />
                        ) : (
                          <div className="h-8 w-8 bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-extrabold text-[10px]">
                            {team.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="p-3 font-bold text-white">
                      <Link href={`/equipos/${team.id}`} className="hover:text-cyan-300">
                        {team.name}
                      </Link>
                      {justChanged && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />}
                    </td>
                    <td className="p-3 text-slate-300">{leaderName}</td>
                    <td className="p-3 text-center font-bold text-cyan-400">{team.members.length}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {team.classTags && team.classTags.length > 0 ? (
                          team.classTags.map((tag: string) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[9px] font-extrabold uppercase text-slate-300">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">{t.none}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 border text-[9px] font-extrabold uppercase tracking-wider ${statusBadgeClass(status)}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {status !== 'approved' && (
                          <form action={updateStatusAction}>
                            <input type="hidden" name="teamId" value={team.id} />
                            <input type="hidden" name="status" value="approved" />
                            <button className="border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition-colors cursor-pointer">
                              {t.approve}
                            </button>
                          </form>
                        )}
                        {status !== 'rejected' && (
                          <form action={updateStatusAction}>
                            <input type="hidden" name="teamId" value={team.id} />
                            <input type="hidden" name="status" value="rejected" />
                            <button className="border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 transition-colors cursor-pointer">
                              {t.reject}
                            </button>
                          </form>
                        )}
                        <Link
                          href={`/equipos/${team.id}`}
                          className="inline-block border border-shell-line bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#1274de] hover:border-[#1274de] transition-colors"
                        >
                          {t.editAll}
                        </Link>
                        <DeleteTeamButtonDouble
                          teamId={team.id}
                          teamName={team.name}
                          deleteAction={deleteAction}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
