import { cache } from 'react'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
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
  if (!hasFirebase) return []
  return fetchWithTTLCache('admin_grants_steam_ids', async () => {
    const db = getFirestoreDb()
    if (!db) return []
    try {
      const snapshot = await runWithTimeout(db.collection('admin_grants').get(), 3000)
      return snapshot.docs.map((doc: any) => doc.id)
    } catch (error) {
      console.error('Failed to fetch granted admin Steam IDs from Firestore:', error)
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

  // 3. Check Firestore platform_roles
  return fetchWithTTLCache(`platform_role_${resolvedUserId}`, async () => {
    const db = getFirestoreDb()
    if (db) {
      try {
        const snapshot = await runWithTimeout(db.collection('platform_roles').where('user_id', '==', resolvedUserId).get(), 3000)
        if (!snapshot.empty) {
          const roles = snapshot.docs.map((doc: any) => doc.data().role as PlatformRole)
          const topRole = roles.sort((a: PlatformRole, b: PlatformRole) => PLATFORM_ROLE_WEIGHT[b] - PLATFORM_ROLE_WEIGHT[a])[0]
          if (topRole && topRole !== 'user') return topRole
        }
      } catch (error) {
        console.error('Failed to get platform role from Firestore:', error)
      }
      // Firestore is configured and answered: never fall through to the mock cookie in this mode.
      return 'user'
    }

    // 3. Demo mode only (no Firestore configured): fallback to mock cookie if set
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const mockRole = cookieStore.get('mock_role')?.value
      if (mockRole === 'admin') return 'super_admin'
    } catch (e) {}

    return 'user'
  }, 30)
})

export const getLeagueRole = cache(async (leagueId: string, userId?: string): Promise<LeagueRole | null> => {
  // Demo mode only (no Firestore configured): allow the mock role cookie to drive access.
  if (!hasFirebase) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const mockRole = cookieStore.get('mock_role')?.value
      if (mockRole === 'admin') return 'league_owner'
      if (mockRole === 'leader') return 'steward'
      if (mockRole === 'driver') return null
    } catch (e) {}
  }

  const session = await getSession()
  if (!session) return null
  const resolvedUserId = userId || session.userId
  if (!resolvedUserId) return null

  if (!hasFirebase) return null
  const db = getFirestoreDb()
  if (!db) return null

  try {
    const snapshot = await runWithTimeout(
      db
        .collection('league_members')
        .where('league_id', '==', leagueId)
        .where('user_id', '==', resolvedUserId)
        .limit(1)
        .get(),
      3000
    )

    if (snapshot.empty) return null
    return (snapshot.docs[0].data().role as LeagueRole) || null
  } catch (error) {
    console.error('Failed to get league role from Firestore:', error)
    return null
  }
})

export const getLeagueMemberships = cache(async (userId?: string) => {
  // Demo mode only (no Firestore configured): allow the mock role cookie to drive access.
  if (!hasFirebase) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const mockRole = cookieStore.get('mock_role')?.value
      if (mockRole === 'leader' || mockRole === 'admin') {
        const { getLeagues } = await import('@/lib/platform-data')
        const leagues = await getLeagues()
        return leagues.map((l: any) => ({
          leagueId: l.id,
          role: (mockRole === 'admin' ? 'league_owner' : 'steward') as LeagueRole,
        }))
      }
    } catch (e) {}
  }

  const session = await getSession()
  if (!session) return []
  const resolvedUserId = userId || session.userId
  if (!resolvedUserId) return []

  if (!hasFirebase) return []
  const db = getFirestoreDb()
  if (!db) return []

  try {
    const snapshot = await runWithTimeout(
      db.collection('league_members').where('user_id', '==', resolvedUserId).get(),
      3000
    )
    if (snapshot.empty) return []

    return snapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        leagueId: data.league_id as string,
        role: data.role as LeagueRole,
      }
    })
  } catch (error) {
    console.error('Failed to get league memberships from Firestore:', error)
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
  const managedLeagueIds = memberships.filter((item: any) => canStewardLeague(item.role)).map((item: any) => item.leagueId)
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
  const resolvedUserId = user.userId || `steam_${user.steamId}`
  if (!hasFirebase) {
    await createSession({ ...user, userId: resolvedUserId })
    let isNew = true
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const mockProfileStr = cookieStore.get(`mock_profile_${resolvedUserId}`)?.value || cookieStore.get('mock_profile')?.value
      if (mockProfileStr) {
        const parsed = JSON.parse(mockProfileStr)
        if (!parsed.user_id || parsed.user_id === resolvedUserId) {
          if (parsed.onboarded) {
            isNew = false
          }
        }
      }
    } catch (e) {
      console.error('Failed to read mock_profile during upsertUserFromSteam:', e)
    }
    return { ok: true, mode: 'session-only', isNew }
  }
  const db = getFirestoreDb()
  if (!db) {
    await createSession({ ...user, userId: resolvedUserId })
    let isNew = true
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const mockProfileStr = cookieStore.get(`mock_profile_${resolvedUserId}`)?.value || cookieStore.get('mock_profile')?.value
      if (mockProfileStr) {
        const parsed = JSON.parse(mockProfileStr)
        if (!parsed.user_id || parsed.user_id === resolvedUserId) {
          if (parsed.onboarded) {
            isNew = false
          }
        }
      }
    } catch (e) {}
    return { ok: true, mode: 'session-only', isNew }
  }

  try {
    // Resolving "does this Steam ID already have an account?" via a collection
    // query (where steam_id == ...) is vulnerable to the data source's own
    // eventual consistency: two logins for the same brand-new Steam ID landing
    // close together could both see "no match" and each create a separate
    // user/profile — a duplicate profile for the same person. A transaction
    // keyed by a direct document lookup (steam_id as the doc ID) doesn't have
    // that gap, so it's used as the source of truth for existence, with the
    // old query kept only as a one-time fallback for accounts created before
    // this index existed (so they get backfilled into it instead of
    // duplicated).
    const steamIdIndexRef = db.collection('steam_id_index').doc(user.steamId)
    let userId = ''
    let isNew = false

    await db.runTransaction(async (tx: any) => {
      const indexDoc = await tx.get(steamIdIndexRef)

      if (indexDoc.exists) {
        userId = indexDoc.data()?.user_id || ''
        tx.update(db.collection('steam_accounts').doc(userId), {
          steam_display_name: user.steamDisplayName,
          steam_avatar_url: user.avatarUrl || null,
        })
        return
      }

      // No index entry yet — check the legacy query in case this account was
      // created before the index existed, so it gets linked instead of duplicated.
      const legacySnapshot = await tx.get(
        db.collection('steam_accounts').where('steam_id', '==', user.steamId).limit(1),
      )

      if (!legacySnapshot.empty) {
        const doc = legacySnapshot.docs[0]
        userId = doc.data().user_id || doc.id
        tx.set(steamIdIndexRef, { user_id: userId, created_at: new Date() })
        tx.update(db.collection('steam_accounts').doc(userId), {
          steam_display_name: user.steamDisplayName,
          steam_avatar_url: user.avatarUrl || null,
        })
        return
      }

      // Genuinely new Steam ID: create the user, profile, role, and index entry together.
      isNew = true
      const userRef = db.collection('users').doc()
      userId = userRef.id

      tx.set(userRef, { created_at: new Date() })

      tx.set(db.collection('steam_accounts').doc(userId), {
        user_id: userId,
        steam_id: user.steamId,
        steam_display_name: user.steamDisplayName,
        steam_avatar_url: user.avatarUrl || null,
        steam_profile_url: `https://steamcommunity.com/profiles/${user.steamId}`,
        created_at: new Date(),
      })

      tx.set(db.collection('profiles').doc(userId), {
        user_id: userId,
        display_name: user.steamDisplayName,
        main_sim: 'ac',
        avatar_url: user.avatarUrl || null,
        country_code: 'ES',
        bio: '',
        onboarded: false,
        created_at: new Date(),
      })

      tx.set(db.collection('platform_roles').doc(userId), {
        user_id: userId,
        role: 'user',
        created_at: new Date(),
      })

      tx.set(steamIdIndexRef, { user_id: userId, created_at: new Date() })
    })

    if (!isNew) {
      // Check if they are actually onboarded
      try {
        const profileDoc = await db.collection('profiles').doc(userId).get()
        if (profileDoc.exists) {
          const profileData = profileDoc.data()
          if (!profileData || !profileData.onboarded) {
            isNew = true
          }
        } else {
          isNew = true
        }
      } catch (err) {
        console.error('Failed to read profile status during Steam callback:', err)
      }
    }

    await createSession({ ...user, userId })
    return { ok: true, userId, isNew }
  } catch (error) {
    console.error('Failed to upsert user from Steam in Firestore:', error)
    console.log('Falling back to session-only authentication mode.')
    await createSession({ ...user, userId: `steam_${user.steamId}` })
    return { ok: true, mode: 'session-only-fallback', isNew: true }
  }
}
