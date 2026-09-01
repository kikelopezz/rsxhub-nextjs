import Link from 'next/link'
import NextImage from 'next/image'
import { redirect } from 'next/navigation'
import { getAdminAccessContext, getCurrentUser, getConfiguredAdminSteamIds } from '@/lib/auth'
import { getLeagueEvents, getLeagues, getRegistrations, getAllRegisteredDrivers } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { simulatorLabel } from '@/lib/utils'
import { SubmitButton } from '@/components/submit-button'
import { ConfirmForm } from '@/components/confirm-form'
import { DeleteLeagueButton } from '@/components/delete-league-button'
import { DeleteTeamButtonDouble } from '@/components/delete-team-button-double'
import { DeleteUserButtonDouble } from '@/components/delete-user-button-double'
import { AdminGallery } from '@/components/admin-gallery'
import { ShieldAlert, ShieldCheck, Trophy, Shield, Store, Image as ImageIcon, Trash2, Users, User } from 'lucide-react'
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
import { AdminAdminsTab } from './components/admin-admins-tab'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

async function fetchAdminMarketListings(): Promise<any[]> {
  return fetchWithTTLCache('admin_market_listings', async () => {
    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        try {
          const snap = await db.collection('market_listings').orderBy('created_at', 'desc').get()
          return snap.docs.map((doc: any) => {
            const data = doc.data()
            const createdAtVal =
              data.created_at && typeof data.created_at.toDate === 'function'
                ? data.created_at.toDate().toISOString()
                : data.created_at || new Date().toISOString()
            return {
              id: doc.id,
              type: data.type || 'team_seeking_driver',
              user_id: data.user_id || '',
              user_name: data.user_name || 'Driver',
              user_avatar: data.user_avatar || null,
              team_id: data.team_id || null,
              team_name: data.team_name || null,
              team_logo: data.team_logo || null,
              title: data.title || '',
              description: data.description || '',
              main_sim: data.main_sim || 'ac',
              class_tag: data.class_tag || 'ALL',
              contact_info: data.contact_info || '',
              created_at: createdAtVal,
            }
          })
        } catch (error) {
          console.error('Failed to get market listings from Firestore:', error)
          return []
        }
      }
    }
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_market_listings')?.value
      if (existing) return JSON.parse(existing)
    } catch {}
    return []
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
    if (!hasFirebase) return []
    const db = getFirestoreDb()
    if (!db) return []
    try {
      const snap = await db.collection('admin_grants').orderBy('created_at', 'desc').get()
      return Promise.all(
        snap.docs.map(async (doc: any) => {
          const data = doc.data()
          const steamId = doc.id
          let displayName: string | null = null
          let avatarUrl: string | null = null
          try {
            const steamSnap = await db.collection('steam_accounts').where('steam_id', '==', steamId).limit(1).get()
            if (!steamSnap.empty) {
              const steamData = steamSnap.docs[0].data()
              displayName = steamData.steam_display_name || null
              avatarUrl = steamData.steam_avatar_url || null
            }
          } catch {}
          const createdAtVal =
            data.created_at && typeof data.created_at.toDate === 'function'
              ? data.created_at.toDate().toISOString()
              : data.created_at || new Date().toISOString()
          return {
            steamId,
            grantedByName: data.granted_by_name || 'Admin',
            createdAt: createdAtVal,
            displayName,
            avatarUrl,
          }
        })
      )
    } catch (error) {
      console.error('Failed to get admin grants from Firestore:', error)
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

  const [leagues, events, registrations, { teams }, drivers, listings, grants] = await Promise.all([
    getLeagues(),
    getLeagueEvents(),
    getRegistrations(),
    getTeamsDashboard(session.userId),
    getAllRegisteredDrivers(),
    fetchAdminMarketListings(),
    fetchAdminGrants(),
  ])

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
      <div className="border-b border-shell-line pb-4">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white italic flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-cyan-400 shrink-0" />
          {t.title}
        </h1>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
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
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="h-3.5 w-3.5 text-cyan-400" />
          {t.tabTeams} ({teams.length})
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
        <AdminTeamsTab teams={teams} />
      )}

      {/* TAB CONTENT: DRIVERS */}
      {activeTab === 'drivers' && (
        <section className="shell-panel p-4 md:p-5 rounded-lg space-y-4">
          <div className="border-b border-shell-line pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white italic">{t.driversTitle}</h2>
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
        <section className="shell-panel p-4 md:p-5 rounded-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell-line pb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white italic">{t.marketTitle}</h2>
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
        <section className="shell-panel p-4 md:p-5 rounded-lg space-y-6">
          <AdminGallery />
        </section>
      )}

      {/* TAB CONTENT: ADMINS */}
      {activeTab === 'admins' && (
        <AdminAdminsTab
          grants={grants}
          fixedAdminSteamIds={fixedAdminSteamIds}
          currentUserSteamId={session.steamId}
        />
      )}

      {/* TAB CONTENT: DATA CLEANUP */}
      {activeTab === 'system' && (
        <section className="shell-panel p-4 md:p-5 rounded-lg space-y-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-rose-400 italic">{t.dataCleanupTitle}</h2>
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

            <ConfirmForm action={resetDatabaseAction} confirmMessage={t.confirmCleanup}>
              <SubmitButton
                label={t.confirmCleanupButton}
                pendingLabel={t.cleaningDatabase}
                className="border border-rose-500/40 bg-rose-600/20 hover:bg-rose-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-100 hover:text-white transition-colors cursor-pointer"
              />
            </ConfirmForm>
          </div>
        </section>
      )}
    </div>
  )
}
