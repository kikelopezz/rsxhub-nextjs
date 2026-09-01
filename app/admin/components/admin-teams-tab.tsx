import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { DeleteTeamButtonDouble } from '@/components/delete-team-button-double'
import { deleteTeamAction } from '@/app/equipos/actions'
import { updateTeamStatusAction } from '../actions/admin-team'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  if (status === 'rejected') return 'border-rose-500/40 bg-rose-500/10 text-rose-300'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
}

type AdminTeamsTabProps = {
  teams: any[]
}

export async function AdminTeamsTab({ teams }: AdminTeamsTabProps) {
  const t = getDictionary(await getLocale()).admin.teamsTab
  return (
    <section className="shell-panel p-4 md:p-5 rounded-lg space-y-4">
      <div className="border-b border-shell-line pb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white italic">{t.title}</h2>
        <p className="text-xs text-slate-400">{t.subtitle}</p>
      </div>

      <div className="overflow-x-auto border border-shell-line bg-black/10">
        <table className="w-full text-left border-collapse">
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
            {teams.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">{t.noTeams}</td>
              </tr>
            ) : (
              teams.map((team) => {
                const leaderName = team.members.find((m: any) => m.role === 'owner')?.displayName || t.unassigned
                const status = team.status || 'approved'
                const statusLabel = status === 'approved' ? t.statusApproved : status === 'rejected' ? t.statusRejected : t.statusPending
                return (
                  <tr key={team.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      {team.logoUrl ? (
                        <Image src={team.logoUrl} alt={team.name} width={32} height={32} className="h-8 w-8 object-contain" />
                      ) : (
                        <div className="h-8 w-8 bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-extrabold text-[10px]">
                          {team.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-bold text-white">{team.name}</td>
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
                          <form action={updateTeamStatusAction}>
                            <input type="hidden" name="teamId" value={team.id} />
                            <input type="hidden" name="status" value="approved" />
                            <button className="border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition-colors cursor-pointer">
                              {t.approve}
                            </button>
                          </form>
                        )}
                        {status !== 'rejected' && (
                          <form action={updateTeamStatusAction}>
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
                          deleteAction={deleteTeamAction}
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
    </section>
  )
}
