'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { canAccessPlatformAdmin } from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { invalidateCache } from '@/lib/ttl-cache'
import type { LeagueRole } from '@/types'
import { guardPlatformAdmin, guardLeaguePermission } from './admin-league'

function normalizeLeagueRole(rawRole: string): LeagueRole {
  const safeRole = rawRole as LeagueRole
  const allowedRoles: LeagueRole[] = ['league_owner', 'league_admin', 'steward', 'team_manager', 'driver']
  return allowedRoles.includes(safeRole) ? safeRole : 'driver'
}

export async function assignLeagueRole(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const steamId = String(formData.get('steamId') || '').trim()
  const role = normalizeLeagueRole(String(formData.get('role') || 'driver'))

  if (!steamId) redirect(`/admin/ligas/${leagueId}/miembros?error=user-not-found`)

  const { session, platformRole, leagueRole } = await guardLeaguePermission(leagueId, 'manage')
  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')

  const actorCanAssignOwner = canAccessPlatformAdmin(platformRole) || leagueRole === 'league_owner'
  if (role === 'league_owner' && !actorCanAssignOwner) redirect(`/admin/ligas/${leagueId}/miembros?error=forbidden`)

  try {
    const steamSnapshot = await db.collection('steam_accounts').where('steam_id', '==', steamId).limit(1).get()
    if (steamSnapshot.empty) redirect(`/admin/ligas/${leagueId}/miembros?error=user-not-found`)

    const targetUserId = steamSnapshot.docs[0].data().user_id
    if (!targetUserId) redirect(`/admin/ligas/${leagueId}/miembros?error=user-not-found`)

    if (role === 'league_owner' && targetUserId === session.userId && !canAccessPlatformAdmin(platformRole)) {
      redirect(`/admin/ligas/${leagueId}/miembros?error=owner-self`)
    }

    await db.collection('league_members').doc(`${leagueId}_${targetUserId}`).set({
      league_id: leagueId,
      user_id: targetUserId,
      role,
      created_at: new Date(),
    }, { merge: true })
  } catch (error) {
    console.error('Failed to assign league role in Firestore:', error)
    redirect(`/admin/ligas/${leagueId}/miembros?error=user-not-found`)
  }

  revalidatePath(`/admin/ligas/${leagueId}/miembros`)
  redirect(`/admin/ligas/${leagueId}/miembros?updated=1`)
}

export async function adminDeleteMarketListing(listingId: string) {
  await guardPlatformAdmin()

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        await db.collection('market_listings').doc(listingId).delete()
      } catch (error) {
        console.error('Failed to delete market listing from Firestore:', error)
      }
    }
  } else {
    // Mock Mode Fallback
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_market_listings')?.value
      if (existing) {
        let current = JSON.parse(existing)
        if (Array.isArray(current)) {
          current = current.filter((item: any) => item.id !== listingId)
          cookieStore.set('mock_market_listings', JSON.stringify(current), { path: '/', maxAge: 60 * 60 * 24 * 30 })
        }
      }
    } catch (e) {
      console.error('Failed to delete mock listing:', e)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/market')
  redirect('/admin?deleted_listing=1')
}

export async function updateUserRoleAction(formData: FormData) {
  await guardPlatformAdmin()

  const targetUserId = String(formData.get('targetUserId') || '')
  const newRole = String(formData.get('role') || 'user') as 'user' | 'steward' | 'platform_admin'

  if (!targetUserId) return

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const rolesSnap = await runWithTimeout(
          db.collection('platform_roles').where('user_id', '==', targetUserId).get(),
          3000
        )
        if (newRole === 'platform_admin' || newRole === 'steward') {
          if (rolesSnap.empty) {
            const docRef = db.collection('platform_roles').doc()
            await runWithTimeout(docRef.set({
              id: docRef.id,
              user_id: targetUserId,
              role: newRole,
              created_at: new Date(),
            }))
          } else {
            await runWithTimeout(rolesSnap.docs[0].ref.update({ role: newRole }))
          }
        } else {
          if (!rolesSnap.empty) {
            const batch = db.batch()
            rolesSnap.docs.forEach((doc: any) => batch.delete(doc.ref))
            await runWithTimeout(batch.commit())
          }
        }
      } catch (err) {
        console.error('Failed to update user role in Firestore:', err)
      }
    }
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.set(`user_role_${targetUserId}`, newRole, { path: '/', maxAge: 60 * 60 * 24 * 30 })
  } catch {}

  invalidateCache([`platform_role_${targetUserId}`, 'platform_drivers', 'platform_roles'])
  revalidatePath('/admin')
}

export async function deleteUserAccountAction(targetUserId: string) {
  const session = await guardPlatformAdmin()

  if (targetUserId === session.userId) {
    throw new Error('No puedes eliminar tu propia cuenta de administrador.')
  }

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const batch = db.batch()

        // 1. Delete profile doc
        batch.delete(db.collection('profiles').doc(targetUserId))

        // 2. Delete platform_roles
        const rolesSnap = await runWithTimeout(db.collection('platform_roles').where('user_id', '==', targetUserId).get(), 3000)
        rolesSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 3. Delete team memberships
        const membersSnap = await runWithTimeout(db.collection('team_members').where('user_id', '==', targetUserId).get(), 3000)
        membersSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 4. Delete registrations
        const regsSnap = await runWithTimeout(db.collection('league_registrations').where('user_id', '==', targetUserId).get(), 3000)
        regsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 5. Delete market listings
        const marketSnap = await runWithTimeout(db.collection('market_listings').where('user_id', '==', targetUserId).get(), 3000)
        marketSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        await runWithTimeout(batch.commit(), 4000)
      } catch (err) {
        console.error('Failed to delete user account from Firestore:', err)
        throw err
      }
    }
  }

  invalidateCache()
  revalidatePath('/admin')
}