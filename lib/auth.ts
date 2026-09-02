import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { createSession, getSession } from '@/lib/session'
import type { LeagueRole, PlatformRole, SessionUser } from '@/types'
import { fetchSteamPlayerSummary } from '@/lib/steam'

const PLATFORM_ROLE_WEIGHT: Record<PlatformRole, number> = {
  user: 0,
  steward: 1,
  platform_admin: 2,
  super_admin: 3,
}

const LEAGUE_ADMIN_ROLES: LeagueRole[] = ['league_owner', 'league_admin']
const LEAGUE_STEWARD_ROLES: LeagueRole[] = ['league_owner', 'league_admin', 'steward']

export const getCurrentUser = cache(async () => {
  const session = await getSession()
  if (session) {
    if (!session.userId) {
      session.userId = `steam_${session.steamId}`
    }
    // If we have a generic name or are missing the avatar, try to resolve it dynamically from Steam
    if (!session.avatarUrl || session.steamDisplayName.startsWith('Steam User')) {
      try {
        const summary = await fetchSteamPlayerSummary(session.steamId)
        if (summary && !summary.steamDisplayName.startsWith('Steam User')) {
          session.steamDisplayName = summary.steamDisplayName
          if (summary.avatarUrl) {
            session.avatarUrl = summary.avatarUrl
          }
        }
      } catch (err) {
        console.error('Failed to resolve Steam summary in getCurrentUser:', err)
      }
    }
  }
  return session
})

const DEFAULT_ADMIN_STEAM_IDS = ['76561198341588341']

export function getConfiguredAdminSteamIds() {
  const envAdmins = (process.env.ADMIN_STEAM_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return Array.from(new Set([...DEFAULT_ADMIN_STEAM_IDS, ...envAdmins]))
}

export async function getGrantedAdminSteamIds(): Promise<string[]> {
  return fetchWithTTLCache('admin_grants_steam_ids', async () => {
    try {
      const grants = await db.adminGrant.findMany({ select: { steamId: true } })
      return grants.map((g) => g.steamId)
    } catch (error) {
      console.error('Failed to fetch granted admin Steam IDs:', error)
      return []
    }
  }, 20)
}

export function canAccessPlatformAdmin(role?: PlatformRole | null) {
  return role === 'super_admin' || role === 'platform_admin'
}

export function canManageLeague(role?: LeagueRole | null) {
  return !!role && LEAGUE_ADMIN_ROLES.includes(role)
}

export function canStewardLeague(role?: LeagueRole | PlatformRole | null) {
  return role === 'super_admin' || role === 'platform_admin' || role === 'steward' || (!!role && LEAGUE_STEWARD_ROLES.includes(role as LeagueRole))
}

export const getPlatformRole = cache(async (userId?: string): Promise<PlatformRole | null> => {
  const session = await getSession()
  if (!session) return null

  // 1. Configured Admin Steam IDs (env var) take top priority
  const configuredAdmins = getConfiguredAdminSteamIds()
  if (configuredAdmins.includes(session.steamId)) return 'super_admin'

  // 2. Admin access granted from the admin panel (by Steam ID, works even before the person has logged in)
  const grantedAdmins = await getGrantedAdminSteamIds()
  if (grantedAdmins.includes(session.steamId)) return 'platform_admin'

  const resolvedUserId = userId || session.userId
  if (!resolvedUserId) return 'user'

  // 3. Check platform_roles
  return fetchWithTTLCache(`platform_role_${resolvedUserId}`, async () => {
    try {
      const roles = await db.platformRole.findMany({ where: { userId: resolvedUserId } })
      if (roles.length > 0) {
        const topRole = roles
          .map((r) => r.role as PlatformRole)
          .sort((a, b) => PLATFORM_ROLE_WEIGHT[b] - PLATFORM_ROLE_WEIGHT[a])[0]
        if (topRole && topRole !== 'user') return topRole
      }
    } catch (error) {
      console.error('Failed to get platform role:', error)
    }
    return 'user'
  }, 30)
})

export const getLeagueRole = cache(async (leagueId: string, userId?: string): Promise<LeagueRole | null> => {
  const session = await getSession()
  if (!session) return null
  const resolvedUserId = userId || session.userId
  if (!resolvedUserId) return null

  try {
    const member = await db.leagueMember.findFirst({ where: { leagueId, userId: resolvedUserId } })
    return (member?.role as LeagueRole) || null
  } catch (error) {
    console.error('Failed to get league role:', error)
    return null
  }
})

export const getLeagueMemberships = cache(async (userId?: string) => {
  const session = await getSession()
  if (!session) return []
  const resolvedUserId = userId || session.userId
  if (!resolvedUserId) return []

  try {
    const members = await db.leagueMember.findMany({ where: { userId: resolvedUserId } })
    return members.map((m) => ({ leagueId: m.leagueId, role: m.role as LeagueRole }))
  } catch (error) {
    console.error('Failed to get league memberships:', error)
    return []
  }
})

export const getAdminAccessContext = cache(async (userId?: string) => {
  const session = await getSession()
  if (!session) {
    return {
      platformRole: null as PlatformRole | null,
      memberships: [] as Array<{ leagueId: string; role: LeagueRole }>,
      managedLeagueIds: [] as string[],
      canAccessAnyLeagueAdmin: false,
      canAccessPlatformAdmin: false,
    }
  }

  const platformRole = await getPlatformRole(userId)
  const memberships = await getLeagueMemberships(userId)
  const managedLeagueIds = memberships.filter((item) => canStewardLeague(item.role)).map((item) => item.leagueId)
  const platformAdmin = canAccessPlatformAdmin(platformRole)

  return {
    platformRole,
    memberships,
    managedLeagueIds,
    canAccessAnyLeagueAdmin: platformAdmin || managedLeagueIds.length > 0,
    canAccessPlatformAdmin: platformAdmin,
  }
})

export async function isAdminUser() {
  const access = await getAdminAccessContext()
  return access.canAccessAnyLeagueAdmin
}

export async function upsertUserFromSteam(user: SessionUser) {
  try {
    // Postgres's unique constraint on steam_accounts.steam_id plus a real
    // transaction give us the same "no duplicate account for a brand-new
    // Steam ID" guarantee Firestore needed a dedicated lookup index for —
    // a concurrent duplicate insert simply fails the unique constraint here.
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.steamAccount.findUnique({ where: { steamId: user.steamId } })

      if (existing) {
        await tx.steamAccount.update({
          where: { userId: existing.userId },
          data: {
            steamDisplayName: user.steamDisplayName,
            steamAvatarUrl: user.avatarUrl || null,
          },
        })
        return { userId: existing.userId, isNew: false }
      }

      const newUser = await tx.user.create({ data: {} })

      await tx.steamAccount.create({
        data: {
          userId: newUser.id,
          steamId: user.steamId,
          steamDisplayName: user.steamDisplayName,
          steamAvatarUrl: user.avatarUrl || null,
          steamProfileUrl: `https://steamcommunity.com/profiles/${user.steamId}`,
        },
      })

      await tx.profile.create({
        data: {
          userId: newUser.id,
          displayName: user.steamDisplayName,
          mainSim: 'ac',
          avatarUrl: user.avatarUrl || null,
          countryCode: 'ES',
          bio: '',
          onboarded: false,
        },
      })

      await tx.platformRole.create({
        data: { userId: newUser.id, role: 'user' },
      })

      return { userId: newUser.id, isNew: true }
    })

    let isNew = result.isNew
    if (!isNew) {
      const profile = await db.profile.findUnique({ where: { userId: result.userId } })
      if (!profile || !profile.onboarded) {
        isNew = true
      }
    }

    await createSession({ ...user, userId: result.userId })
    return { ok: true, userId: result.userId, isNew }
  } catch (error) {
    // A unique-constraint race (two logins for the same brand-new Steam ID
    // at once) lands here — retry once by re-reading the now-existing row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await db.steamAccount.findUnique({ where: { steamId: user.steamId } })
      if (existing) {
        const profile = await db.profile.findUnique({ where: { userId: existing.userId } })
        await createSession({ ...user, userId: existing.userId })
        return { ok: true, userId: existing.userId, isNew: !profile?.onboarded }
      }
    }
    console.error('Failed to upsert user from Steam:', error)
    throw error
  }
}
