export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/auth'
import { getRegistrations, getLeagues } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { SteamLoginButton } from '@/components/steam-login-button'
import PerfilContent from './perfil-content'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; edit?: string }>
}) {
  const session = await getCurrentUser()
  const qs = await searchParams
  const t = getDictionary(await getLocale()).perfil.page

  if (!session) {
    return (
      <div className="shell-panel p-6 rounded-lg text-white max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white">{t.signInRequired}</h1>
        <p className="text-sm text-slate-400">{t.signInHint}</p>
        <SteamLoginButton className="inline-flex px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-shell-accent rounded-lg cursor-pointer hover:opacity-90 transition-opacity">
          {t.signInWithSteam}
        </SteamLoginButton>
      </div>
    )
  }

  let profile = {
    id: session.userId,
    displayName: session.steamDisplayName,
    countryCode: 'ES',
    bio: '',
    mainSim: 'ac' as 'ac' | 'lmu',
    avatarUrl: session.avatarUrl ?? null,
    steamId: session.steamId,
    steamDisplayName: session.steamDisplayName,
    preferredCategories: [] as string[],
  }
  let pendingInvites: Array<{ id: string; teamName: string; teamLogoUrl: string | null; invitedBy: string; message: string | null }> = []

  const db = getFirestoreDb()
  if (hasFirebase && db) {
    try {
      const [doc, invitesSnapshot] = await Promise.all([
        db.collection('profiles').doc(session.userId).get(),
        db.collection('team_invites').where('status', '==', 'pending').get(),
      ])
      if (doc.exists) {
        const data = doc.data()
        profile = {
          id: doc.id,
          displayName: data.display_name || session.steamDisplayName,
          countryCode: data.country_code || 'ES',
          bio: data.bio || '',
          mainSim: (data.main_sim || 'ac') as 'ac' | 'lmu',
          avatarUrl: data.avatar_url || session.avatarUrl || null,
          steamId: session.steamId,
          steamDisplayName: session.steamDisplayName,
          preferredCategories: data.preferred_categories || [],
        }
      }

      const matchingInvites = invitesSnapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => item.invited_user_id === session.userId || String(item.invited_steam_id || '') === session.steamId)

      const teamIds = Array.from(new Set(matchingInvites.map((item: any) => item.team_id)))
      const inviterIds = Array.from(new Set(matchingInvites.map((item: any) => item.invited_by_user_id)))

      const [teamSnaps, pSnaps, sSnaps] = await Promise.all([
        Promise.all(teamIds.map((id: any) => db.collection('teams').doc(id).get())),
        Promise.all(inviterIds.map((id: any) => db.collection('profiles').doc(id).get())),
        Promise.all(inviterIds.map((id: any) => db.collection('steam_accounts').doc(id).get())),
      ])
      const teamDocs = teamSnaps.filter((s: any) => s.exists).map((s: any) => ({ id: s.id, ...s.data() }))
      const profileDocs = pSnaps.filter((s: any) => s.exists).map((s: any) => ({ id: s.id, ...s.data() }))
      const steamDocs = sSnaps.filter((s: any) => s.exists).map((s: any) => ({ id: s.id, ...s.data() }))

      const teamById = new Map(teamDocs.map((t: any) => [t.id, { name: t.name || '', logoUrl: t.logo_url || t.logoUrl || null }]))
      const inviterNameByUserId = new Map(profileDocs.map((p: any) => [p.user_id, p.display_name || '']))
      steamDocs.forEach((s: any) => {
        if (!inviterNameByUserId.get(s.user_id)) {
          inviterNameByUserId.set(s.user_id, s.steam_display_name || '')
        }
      })

      pendingInvites = matchingInvites.map((item: any) => {
        const teamInfo = teamById.get(item.team_id)
        return {
          id: item.id,
          teamName: teamInfo?.name || t.teamFallback,
          teamLogoUrl: teamInfo?.logoUrl || null,
          invitedBy: inviterNameByUserId.get(item.invited_by_user_id) || t.userFallback,
          message: item.message,
        }
      })
    } catch (e) {
      console.error('Failed to load profile details from Firestore:', e)
    }
  }

  // Load mock invites if pendingInvites is empty
  if (pendingInvites.length === 0) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const mockProfile = cookieStore.get(`mock_profile_${session.userId}`)?.value || cookieStore.get('mock_profile')?.value
      if (mockProfile) {
        const parsed = JSON.parse(mockProfile)
        if (!parsed.user_id || parsed.user_id === session.userId) {
          profile.displayName = parsed.display_name || profile.displayName
          profile.countryCode = parsed.country_code || profile.countryCode
          profile.bio = parsed.bio || profile.bio
          profile.mainSim = parsed.main_sim || profile.mainSim
          profile.avatarUrl = parsed.avatar_url || profile.avatarUrl
          profile.preferredCategories = parsed.preferred_categories || profile.preferredCategories
        }
      }

      const mockInvitesVal = cookieStore.get('mock_invites')?.value
      const mockMarketInvitesVal = cookieStore.get('mock_market_invites')?.value
      const mockInvites = mockInvitesVal ? JSON.parse(mockInvitesVal) : []
      const mockMarketInvites = mockMarketInvitesVal ? JSON.parse(mockMarketInvitesVal) : []
      const dashboard = await getTeamsDashboard(session.userId)
      const teamMap = new Map(dashboard.teams.map((t) => [t.id, t]))

      const combinedMock = [...mockInvites, ...mockMarketInvites]
      combinedMock.forEach((inv: any) => {
        const targetUserId = inv.invited_user_id || inv.invitedUserId
        const targetSteamId = String(inv.invited_steam_id || inv.invitedSteamId || '')
        const isTarget = (targetUserId && targetUserId === session.userId) || (targetSteamId && targetSteamId === session.steamId)
        const isPending = inv.status === 'pending'
        if (isTarget && isPending) {
          const team = teamMap.get(inv.team_id || inv.teamId)
          const teamLogoUrl = inv.teamLogo || team?.logoUrl || cookieStore.get(`mock_team_logo_${inv.team_id || inv.teamId}`)?.value || null
          pendingInvites.push({
            id: inv.id,
            teamName: team?.name || inv.teamName || t.teamFallback,
            teamLogoUrl,
            invitedBy: inv.invitedBy || t.teamAdminFallback,
            message: inv.message || null,
          })
        }
      })
    } catch (e) {
      console.error('Failed to read mock_profile or invites cookie:', e)
    }
  }

  const registrations = (await getRegistrations()).filter((item) => item.userId === session.userId)
  const leagues = await getLeagues()

  return (
    <PerfilContent
      profile={profile}
      registrations={registrations}
      leagues={leagues}
      pendingInvites={pendingInvites}
      qsInvite={qs.invite}
      initialEditOpen={qs.edit === '1'}
    />
  )
}
