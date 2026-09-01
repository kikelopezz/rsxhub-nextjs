import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  canAccessPlatformAdmin,
  canManageLeague,
  getCurrentUser,
  getLeagueRole,
  getPlatformRole,
} from '@/lib/auth'
import { getLeagueMembers, getLeagues } from '@/lib/platform-data'
import { SectionTitle } from '@/components/section-title'
import { assignLeagueRole } from '@/app/admin/actions'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export default async function LeagueMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ updated?: string; error?: string }>
}) {
  const session = await getCurrentUser()
  const { id } = await params
  const qs = await searchParams

  if (!session) redirect('/perfil')

  const t = getDictionary(await getLocale()).admin.members
  const platformRole = await getPlatformRole(session.userId)
  const leagueRole = await getLeagueRole(id, session.userId)
  const canManageMembers = canAccessPlatformAdmin(platformRole) || canManageLeague(leagueRole)

  if (!canManageMembers) redirect('/admin')

  const leagues = await getLeagues()
  const league = leagues.find((item) => item.id === id)
  if (!league) notFound()

  const members = await getLeagueMembers(league.id)

  const errorMap: Record<string, string> = {
    forbidden: t.errorForbidden,
    'user-not-found': t.errorUserNotFound,
    'owner-self': t.errorOwnerSelf,
  }

  return (
    <div className="space-y-4">
      <section className="shell-panel p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle title={t.title.replace('{league}', league.title)} subtitle={t.subtitle} />
          <div className="flex gap-2">
            <Link href={`/admin/ligas/${league.id}`} className="rounded-lg border border-shell-line bg-white/5 px-3 py-2 text-xs font-semibold text-white">{t.backToLeague}</Link>
            <Link href="/admin" className="rounded-lg border border-shell-line bg-white/5 px-3 py-2 text-xs font-semibold text-white">{t.panel}</Link>
          </div>
        </div>

        {qs.updated === '1' ? <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{t.roleUpdated}</div> : null}
        {qs.error ? <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{errorMap[qs.error] || t.roleUpdateError}</div> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="shell-panel p-4 md:p-5">
          <SectionTitle title={t.assignRoleTitle} subtitle={t.assignRoleSubtitle} />
          <form action={assignLeagueRole} className="space-y-3">
            <input type="hidden" name="leagueId" value={league.id} />
            <input name="steamId" placeholder={t.steamIdPlaceholder} className="w-full rounded-lg border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none" />
            <select name="role" className="w-full rounded-lg border border-shell-line bg-black/20 px-3 py-2 text-sm text-white outline-none">
              <option value="league_admin">league_admin</option>
              <option value="steward">steward</option>
              <option value="team_manager">team_manager</option>
              <option value="driver">driver</option>
              <option value="league_owner">league_owner</option>
            </select>
            <button className="rounded-lg bg-shell-accent px-4 py-2 text-sm font-bold text-white">{t.saveRole}</button>
          </form>
        </div>

        <div className="shell-panel p-4 md:p-5">
          <SectionTitle title={t.currentRolesTitle} subtitle={t.currentRolesSubtitle} />
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-sm text-slate-400">{t.noMembers}</p>
            ) : (
              members.map((member) => (
                <div key={member.id} className="rounded-lg border border-shell-line bg-black/20 p-3">
                  <p className="font-semibold text-white">{member.displayName || member.steamDisplayName || member.userId}</p>
                  <p className="mt-1 text-xs text-slate-400">{t.steamId} {member.steamId || 'N/A'}</p>
                  <p className="mt-1 text-xs text-slate-300">{t.role} {member.role}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

