import { deleteTeamAction } from '@/app/equipos/actions'
import { updateTeamStatusAction, markLineupChangeNotificationsSeenAction } from '../actions/admin-team'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { AdminTeamsTable } from './admin-teams-table'
import type { LineupChangeLogEntry } from '@/lib/admin-lineup-log'

type AdminTeamsTabProps = {
  teams: any[]
  leagues: { id: string; title: string }[]
  unseenLineupChangeTeamIds: string[]
  recentLineupChanges: LineupChangeLogEntry[]
}

export async function AdminTeamsTab({ teams, leagues, unseenLineupChangeTeamIds, recentLineupChanges }: AdminTeamsTabProps) {
  const t = getDictionary(await getLocale()).admin.teamsTab
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
      <div className="border-b border-shell-line pb-3">
        <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">{t.title}</h2>
        <p className="text-xs text-slate-400">{t.subtitle}</p>
      </div>

      <AdminTeamsTable
        teams={teams}
        leagues={leagues}
        unseenLineupChangeTeamIds={unseenLineupChangeTeamIds}
        recentLineupChanges={recentLineupChanges}
        t={t}
        deleteAction={deleteTeamAction}
        updateStatusAction={updateTeamStatusAction}
        markSeenAction={markLineupChangeNotificationsSeenAction}
      />
    </section>
  )
}
