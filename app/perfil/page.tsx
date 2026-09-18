export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/auth'
import { getRegistrations, getLeagues } from '@/lib/platform-data'
import { db } from '@/lib/db'
import { parseConnections, type Connections } from '@/lib/connections'
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
    isPublic: true,
    bannerUrl: null as string | null,
    accentColor: null as string | null,
    connections: {} as Connections,
  }
  let pendingInvites: Array<{ id: string; teamName: string; teamLogoUrl: string | null; invitedBy: string; message: string | null }> = []

  try {
    const [dbProfile, matchingInvites] = await Promise.all([
      db.profile.findUnique({ where: { userId: session.userId } }),
      db.teamInvite.findMany({
        where: {
          status: 'pending',
          OR: [{ invitedUserId: session.userId }, { invitedSteamId: session.steamId }],
        },
      }),
    ])

    if (dbProfile) {
      profile = {
        id: dbProfile.userId,
        displayName: dbProfile.displayName || session.steamDisplayName,
        countryCode: dbProfile.countryCode || 'ES',
        bio: dbProfile.bio || '',
        mainSim: dbProfile.mainSim,
        avatarUrl: dbProfile.avatarUrl || session.avatarUrl || null,
        steamId: session.steamId,
        steamDisplayName: session.steamDisplayName,
        preferredCategories: dbProfile.preferredCategories || [],
        isPublic: dbProfile.isPublic,
        bannerUrl: dbProfile.bannerUrl || null,
        accentColor: dbProfile.accentColor || null,
        connections: parseConnections(dbProfile.connections),
      }
    }

    const teamIds = Array.from(new Set(matchingInvites.map((item) => item.teamId)))
    const inviterIds = Array.from(new Set(matchingInvites.map((item) => item.invitedByUserId)))

    const [teams, profiles, steamAccounts] = await Promise.all([
      teamIds.length > 0 ? db.team.findMany({ where: { id: { in: teamIds } } }) : Promise.resolve([]),
      inviterIds.length > 0 ? db.profile.findMany({ where: { userId: { in: inviterIds } } }) : Promise.resolve([]),
      inviterIds.length > 0 ? db.steamAccount.findMany({ where: { userId: { in: inviterIds } } }) : Promise.resolve([]),
    ])

    const teamById = new Map(teams.map((tm) => [tm.id, { name: tm.name, logoUrl: tm.logoUrl }]))
    const inviterNameByUserId = new Map(profiles.map((p) => [p.userId, p.displayName]))
    steamAccounts.forEach((s) => {
      if (!inviterNameByUserId.get(s.userId)) inviterNameByUserId.set(s.userId, s.steamDisplayName)
    })

    pendingInvites = matchingInvites.map((item) => {
      const teamInfo = teamById.get(item.teamId)
      return {
        id: item.id,
        teamName: teamInfo?.name || t.teamFallback,
        teamLogoUrl: teamInfo?.logoUrl || null,
        invitedBy: inviterNameByUserId.get(item.invitedByUserId) || t.userFallback,
        message: item.message,
      }
    })
  } catch (e) {
    console.error('Failed to load profile details:', e)
  }

  const [allRegistrations, leagues] = await Promise.all([getRegistrations(), getLeagues()])
  const registrations = allRegistrations.filter((item) => item.userId === session.userId)

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
