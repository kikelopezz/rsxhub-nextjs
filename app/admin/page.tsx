import Link from 'next/link'
import NextImage from 'next/image'
import { redirect } from 'next/navigation'
import { getAdminAccessContext, getCurrentUser, getConfiguredAdminSteamIds } from '@/lib/auth'
import { getLeagueEvents, getLeagues, getRegistrations, getAllRegisteredDrivers } from '@/lib/platform-data'
import { getTeamsDashboard, getSkinReviewQueue } from '@/lib/team-data'
import { getUnseenLineupChangeTeamIds, getRecentLineupChanges } from '@/lib/admin-lineup-log'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { db } from '@/lib/db'
import { simulatorLabel } from '@/lib/utils'
import { SubmitButton } from '@/components/submit-button'
import { ConfirmForm } from '@/components/confirm-form'
import { TripleConfirmForm } from '@/components/triple-confirm-form'
import { DeleteLeagueButton } from '@/components/delete-league-button'
import { DeleteTeamButtonDouble } from '@/components/delete-team-button-double'
import { DeleteUserButtonDouble } from '@/components/delete-user-button-double'
import { AdminGallery } from '@/components/admin-gallery'
import { ShieldAlert, ShieldCheck, Trophy, Shield, Store, Image as ImageIcon, Trash2, Users, User, Newspaper, FileArchive, GitMerge, Palette } from 'lucide-react'
import {
  adminDeleteMarketListing,
  quickUpdateLeagueStatusAction,
  quickToggleLeagueFeaturedAction,
  deleteLeagueAction,
  resetDatabaseAction,
  updateUserRoleAction,
  deleteUserAccountAction,
} from './actions'
import { deleteTeamAction } from '@/app/equipos/actions'
import { AdminLeaguesTab } from './components/admin-leagues-tab'
import { AdminTeamsTab } from './components/admin-teams-tab'
import { AdminCatalogTab } from './components/admin-catalog-tab'
import { AdminAdminsTab } from './components/admin-admins-tab'
import { AdminNewsTab } from './components/admin-news-tab'
import { AdminSkinsTab } from './components/admin-skins-tab'
import { AdminUserMergeTab } from './components/admin-user-merge-tab'
import { getNewsPosts } from '@/lib/news-data'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

async function fetchAdminMarketListings(): Promise<any[]> {
  return fetchWithTTLCache('admin_market_listings', async () => {
    try {
      const rows = await db.marketListing.findMany({ orderBy: { createdAt: 'desc' } })
      return rows.map((data) => ({
        id: data.id,
        type: data.type,
        user_id: data.userId,
        user_name: data.userName,
        user_avatar: data.userAvatar,
        team_id: data.teamId,
        team_name: data.teamName,
        team_logo: data.teamLogo,
        title: data.title,
        description: data.description,
        main_sim: data.mainSim,
        class_tag: data.classTag,
        contact_info: data.contactInfo,
        created_at: data.createdAt.toISOString(),
      }))
    } catch (error) {
      console.error('Failed to get market listings:', error)
      return []
    }
  }, 60)
}

type AdminGrant = {
  steamId: string
  grantedByName: string
  createdAt: string
  displayName: string | null
  avatarUrl: string | null
}

async function fetchAdminGrants(): Promise<AdminGrant[]> {
  return fetchWithTTLCache('admin_grants_list', async () => {
    try {
      const grants = await db.adminGrant.findMany({ orderBy: { createdAt: 'desc' } })
      const steamIds = grants.map((g) => g.steamId)
      const steamAccounts = steamIds.length > 0 ? await db.steamAccount.findMany({ where: { steamId: { in: steamIds } } }) : []
      const bySteamId = new Map(steamAccounts.map((s) => [s.steamId, s]))

      return grants.map((g) => {
        const steam = bySteamId.get(g.steamId)
        return {
          steamId: g.steamId,
          grantedByName: g.grantedByName || 'Admin',
          createdAt: g.createdAt.toISOString(),
          displayName: steam?.steamDisplayName || null,
          avatarUrl: steam?.steamAvatarUrl || null,
        }
      })
    } catch (error) {
      console.error('Failed to get admin grants:', error)
      return []
    }
  }, 20)
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string
    mode?: string
    classError?: string
    registrationModeError?: string
    tab?: string
    filter?: string
    deleted_listing?: string
    reset?: string
    granted?: string
    revoked?: string
    error?: string
  }>
}) {
  const session = await getCurrentUser()
  const params = await searchParams
  const dict = getDictionary(await getLocale())
  const t = dict.admin.dashboard
  if (!session) redirect('/perfil')

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin) redirect('/perfil')

  // Load all baseline data in parallel — these reads are independent of each other
  const fixedAdminSteamIds = getConfiguredAdminSteamIds()

  const [leagues, events, registrations, { teams }, drivers, listings, grants, newsPosts, unseenLineupChangeTeamIds, recentLineupChanges, skinReviews] = await Promise.all([
    getLeagues(),
    getLeagueEvents(),
    getRegistrations(),
    getTeamsDashboard(session.userId),
    getAllRegisteredDrivers(),
    fetchAdminMarketListings(),
    fetchAdminGrants(),
    getNewsPosts(),
    getUnseenLineupChangeTeamIds(session.userId),
    getRecentLineupChanges(),
    getSkinReviewQueue(),
  ])
  const pendingSkinCount = skinReviews.filter((r) => r.status === 'pending').length
  const hasUnseenLineupChanges = unseenLineupChangeTeamIds.size > 0

  const visibleLeagues = access.canAccessPlatformAdmin
    ? leagues
    : leagues.filter((league) => access.managedLeagueIds.includes(league.id))

  const visibleLeagueIds = visibleLeagues.map((league) => league.id)
  const visibleEvents = access.canAccessPlatformAdmin
    ? events
    : events.filter((event) => visibleLeagueIds.includes(event.leagueId))
  const visibleRegistrations = access.canAccessPlatformAdmin
    ? registrations
    : registrations.filter((item) => visibleLeagueIds.includes(item.leagueId))

  const activeTab = params.tab || 'leagues'
  const marketFilter = params.filter || 'all'

  const filteredListings = listings.filter((l) => {
    if (marketFilter === 'teams') return l.type === 'team_seeking_driver'
    if (marketFilter === 'drivers') return l.type === 'driver_seeking_team'
    return true
  })

  return (
    <div className="space-y-6 text-white">
      {/* Main Page Title Header */}
      <div className="border-b border-white/10 pb-4">
        <h1 className="font-display-league flex items-center gap-3 text-3xl uppercase text-white md:text-4xl">
          <ShieldAlert className="h-7 w-7 text-cyan-400 shrink-0" />
          {t.title}
        </h1>
        <p className="mt-1 font-mono-data text-xs text-slate-400 md:text-sm">
          {t.subtitle}
        </p>
      </div>

      {params.created === '1' && (
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 font-semibold">
          {t.leagueCreated}
        </div>
      )}
      {params.deleted_listing === '1' && (
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 font-semibold">
          {t.listingDeleted}
        </div>
      )}
      {params.reset === 'success' && (
        <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 font-bold">
          {t.resetSuccess}
        </div>
      )}
      {params.granted === '1' && (
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 font-semibold">
          {dict.admin.adminsTab.granted}
        </div>
      )}
      {params.revoked === '1' && (
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 font-semibold">
          {dict.admin.adminsTab.revoked}
        </div>
      )}
      {params.error === 'invalid-steamid' && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 font-semibold">
          {dict.admin.adminsTab.errorInvalidSteamId}
        </div>
      )}
      {params.error === 'grant-failed' && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 font-semibold">
          {dict.admin.adminsTab.errorGrantFailed}
        </div>
      )}
      {params.error === 'cannot-revoke-self' && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 font-semibold">
          {dict.admin.adminsTab.errorCannotRevokeSelf}
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex flex-wrap border border-shell-line bg-black/40 p-1 rounded-lg w-fit gap-1">
        <Link
          href="/admin?tab=leagues"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'leagues'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Trophy className="h-3.5 w-3.5 text-cyan-400" />
          {t.tabLeagues} ({visibleLeagues.length})
        </Link>
        <Link
          href="/admin?tab=teams"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'teams'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : hasUnseenLineupChanges
                ? 'animate-pulse bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="h-3.5 w-3.5 text-cyan-400" />
          {t.tabTeams} ({teams.length})
          {hasUnseenLineupChanges && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
        </Link>
        <Link
          href="/admin?tab=drivers"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'drivers'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-cyan-400" />
          {t.tabDrivers} ({drivers.length})
        </Link>
        <Link
          href="/admin?tab=market"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'market'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Store className="h-3.5 w-3.5 text-cyan-400" />
          {t.tabMarket} ({listings.length})
        </Link>
        <Link
          href="/admin?tab=gallery"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'gallery'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
          {t.tabGallery}
        </Link>
        <Link
          href="/admin?tab=catalog"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileArchive className="h-3.5 w-3.5 text-cyan-400" />
          Catálogo
        </Link>
        <Link
          href="/admin?tab=admins"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'admins'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          {t.tabAdmins} ({grants.length})
        </Link>
        <Link
          href="/admin?tab=news"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'news'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Newspaper className="h-3.5 w-3.5 text-cyan-400" />
          Noticias ({newsPosts.length})
        </Link>
        <Link
          href="/admin?tab=skins"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'skins'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : pendingSkinCount > 0
                ? 'animate-pulse bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Palette className="h-3.5 w-3.5 text-cyan-400" />
          Skins ({pendingSkinCount})
        </Link>
        <Link
          href="/admin?tab=merge"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'merge'
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <GitMerge className="h-3.5 w-3.5 text-cyan-400" />
          Perfiles duplicados
        </Link>
        <Link
          href="/admin?tab=system"
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            activeTab === 'system'
              ? 'bg-rose-600 text-white shadow-[0_0_16px_rgba(225,29,72,0.5)]'
              : 'text-slate-400 hover:text-rose-300 hover:bg-white/5'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-300" />
          {t.tabSystem}
        </Link>
      </div>

      {/* TAB CONTENT: LEAGUES */}
      {activeTab === 'leagues' && (
        <AdminLeaguesTab
          visibleLeagues={visibleLeagues}
          visibleRegistrations={visibleRegistrations}
          visibleEvents={visibleEvents}
        />
      )}

      {/* TAB CONTENT: TEAMS */}
      {activeTab === 'teams' && (
        <AdminTeamsTab
          teams={teams}
          leagues={visibleLeagues}
          unseenLineupChangeTeamIds={Array.from(unseenLineupChangeTeamIds)}
          recentLineupChanges={recentLineupChanges}
        />
      )}

      {/* TAB CONTENT: DRIVERS */}
      {activeTab === 'drivers' && (
        <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
          <div className="border-b border-shell-line pb-3">
            <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">{t.driversTitle}</h2>
            <p className="text-xs text-slate-400">{t.driversSubtitle}</p>
          </div>

          <div className="overflow-x-auto border border-shell-line bg-black/10">
            <table className="w-full min-w-[640px] text-left border-collapse">
              <thead>
                <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
                  <th className="p-3">{t.colDriver}</th>
                  <th className="p-3">{t.colSteamId}</th>
                  <th className="p-3">{t.colCurrentTeam}</th>
                  <th className="p-3">{t.colPlatformRole}</th>
                  <th className="p-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">{t.noDrivers}</td>
                  </tr>
                ) : (
                  drivers.map((driver) => (
                    <tr key={driver.userId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 font-bold text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {driver.avatarUrl ? (
                            <NextImage src={driver.avatarUrl} alt={driver.displayName} width={32} height={32} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-cyan-400" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[200px] text-white font-bold">{driver.displayName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-xs">{driver.steamId || t.unlinked}</td>
                      <td className="p-3">
                        {driver.teamName ? (
                          <div className="flex items-center gap-2">
                            {driver.teamLogo ? (
                              <NextImage src={driver.teamLogo} alt={driver.teamName} width={20} height={20} className="h-5 w-5 object-contain" />
                            ) : (
                              <Shield className="h-4 w-4 text-cyan-400 shrink-0" />
                            )}
                            <span className="font-bold text-slate-200">{driver.teamName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">{t.noTeam}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {driver.role === 'platform_admin' || driver.role === 'super_admin' ? (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                                👑 {t.roleAdmin}
                              </span>
                            ) : driver.role === 'steward' ? (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-500/40">
                                ⚖️ {t.roleSteward}
                              </span>
                            ) : driver.role === 'team_manager' ? (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-500/40">
                                🛡️ {t.roleTeamManager}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-900 text-slate-400 border border-slate-700">
                                🏎️ {t.roleDriver}
                              </span>
                            )}
                          </div>

                          <form action={updateUserRoleAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="targetUserId" value={driver.userId} />
                            <select
                              name="role"
                              defaultValue={
                                driver.role === 'platform_admin' || driver.role === 'super_admin'
                                  ? 'platform_admin'
                                  : driver.role === 'steward'
                                  ? 'steward'
                                  : 'user'
                              }
                              className="rounded-lg border border-shell-line bg-black/45 px-2 py-1 text-xxs font-bold text-slate-200 outline-none cursor-pointer focus:border-white/30 uppercase tracking-wider"
                            >
                              <option value="user">{t.roleOptionDriver}</option>
                              <option value="steward">{t.roleOptionSteward}</option>
                              <option value="platform_admin">{t.roleOptionAdmin}</option>
                            </select>
                            <button
                              type="submit"
                              className="border border-white/20 bg-white/5 hover:bg-[#1274de] hover:border-[#1274de] px-2 py-1 text-[9px] uppercase font-black text-white transition-colors cursor-pointer"
                            >
                              {t.save}
                            </button>
                          </form>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <DeleteUserButtonDouble
                          userId={driver.userId}
                          userName={driver.displayName}
                          deleteAction={deleteUserAccountAction}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: DRIVER MARKET */}
      {activeTab === 'market' && (
        <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell-line pb-3">
            <div>
              <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">{t.marketTitle}</h2>
              <p className="text-xs text-slate-400">{t.marketSubtitle}</p>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-1 border border-shell-line bg-black/40 p-1">
              <Link
                href="/admin?tab=market&filter=all"
                className={`px-3 py-1 text-[11px] font-bold uppercase transition-colors ${
                  marketFilter === 'all' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.filterAll} ({listings.length})
              </Link>
              <Link
                href="/admin?tab=market&filter=teams"
                className={`px-3 py-1 text-[11px] font-bold uppercase transition-colors ${
                  marketFilter === 'teams' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.filterTeamOffers}
              </Link>
              <Link
                href="/admin?tab=market&filter=drivers"
                className={`px-3 py-1 text-[11px] font-bold uppercase transition-colors ${
                  marketFilter === 'drivers' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.filterDriverApplications}
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto border border-shell-line bg-black/10">
            <table className="w-full min-w-[640px] text-left border-collapse">
              <thead>
                <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
                  <th className="p-3">{t.colType}</th>
                  <th className="p-3">{t.colPostedBy}</th>
                  <th className="p-3">{t.colTitle}</th>
                  <th className="p-3">{t.colCategories}</th>
                  <th className="p-3">{t.colDate}</th>
                  <th className="p-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {filteredListings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">{t.noPosts}</td>
                  </tr>
                ) : (
                  filteredListings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 font-semibold">
                        {listing.type === 'team_seeking_driver' ? (
                          <span className="text-cyan-400 font-extrabold uppercase text-[10px] bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5">
                            {t.teamSeekingDriver}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-extrabold uppercase text-[10px] bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5">
                            {t.driverSeekingTeam}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-white">
                        {listing.type === 'team_seeking_driver'
                          ? `${listing.user_name} (${listing.team_name || 'Team'})`
                          : listing.user_name}
                      </td>
                      <td className="p-3 truncate max-w-[220px]" title={listing.title}>
                        {listing.title}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {listing.class_tag ? (
                            listing.class_tag.split(',').map((tag: string) => {
                              const cleaned = tag.trim().toUpperCase()
                              return cleaned ? (
                                <span key={cleaned} className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[9px] font-extrabold uppercase text-slate-300">
                                  {cleaned}
                                </span>
                              ) : null
                            })
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">{t.none}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-400 text-xxs font-mono">
                        {(() => {
                          try {
                            const d = new Date(listing.created_at)
                            return isNaN(d.getTime()) ? t.recent : d.toLocaleDateString()
                          } catch (e) {
                            return t.recent
                          }
                        })()}
                      </td>
                      <td className="p-3 text-right">
                        <form action={adminDeleteMarketListing.bind(null, listing.id)}>
                          <button
                            type="submit"
                            className="border border-rose-500/30 bg-rose-500/10 hover:bg-rose-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:text-white transition-colors cursor-pointer"
                          >
                            {t.deletePost}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB CONTENT: GALLERY & FILES */}
      {activeTab === 'gallery' && (
        <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-6">
          <AdminGallery />
        </section>
      )}

      {/* TAB CONTENT: CATALOG (car/circuit content) */}
      {activeTab === 'catalog' && <AdminCatalogTab />}

      {/* TAB CONTENT: ADMINS */}
      {activeTab === 'admins' && (
        <AdminAdminsTab
          grants={grants}
          fixedAdminSteamIds={fixedAdminSteamIds}
          currentUserSteamId={session.steamId}
        />
      )}

      {/* TAB CONTENT: NEWS */}
      {activeTab === 'news' && <AdminNewsTab posts={newsPosts} />}

      {/* TAB CONTENT: SKINS */}
      {activeTab === 'skins' && <AdminSkinsTab reviews={skinReviews} />}

      {/* TAB CONTENT: DUPLICATE PROFILE MERGE */}
      {activeTab === 'merge' && <AdminUserMergeTab />}

      {/* TAB CONTENT: DATA CLEANUP */}
      {activeTab === 'system' && (
        <section className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-6">
          <div>
            <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-rose-400">{t.dataCleanupTitle}</h2>
            <p className="mt-1 text-xs text-slate-400">{t.dataCleanupSubtitle}</p>
          </div>

          <div className="border border-rose-500/20 bg-rose-500/5 p-4 rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">{t.destructiveWarning}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t.destructiveIntro}
            </p>
            <ul className="list-disc list-inside text-xs text-slate-400 space-y-1 ml-2">
              {t.destructiveList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="pt-2 border-t border-rose-500/10 text-xs text-emerald-400 font-semibold">
              {t.safetyNote}
            </div>
          </div>

          <div className="bg-black/20 border border-shell-line p-4 rounded-lg space-y-4">
            <p className="text-xs text-slate-300 font-semibold">
              {t.confirmCleanup}
            </p>

            <TripleConfirmForm
              action={resetDatabaseAction}
              label={t.confirmCleanupButton}
              pendingLabel={t.cleaningDatabase}
              confirmStep1Label={t.confirmCleanupStep1}
              typePromptLabel={t.confirmCleanupTypePrompt}
              requiredPhrase={t.confirmCleanupPhrase}
              className="border border-rose-500/40 bg-rose-600/20 hover:bg-rose-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-100 hover:text-white transition-colors cursor-pointer"
            />
          </div>
        </section>
      )}
    </div>
  )
}
