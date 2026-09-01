'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardPlatformAdmin } from './admin-league'

const STEAM_ID_PATTERN = /^\d{10,20}$/

export async function grantAdminAction(formData: FormData) {
  const session = await guardPlatformAdmin()

  const steamId = String(formData.get('steamId') || '').trim()

  if (!STEAM_ID_PATTERN.test(steamId)) {
    redirect('/admin?tab=admins&error=invalid-steamid')
  }

  if (!hasFirebase) redirect('/admin?tab=admins&mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?tab=admins&mode=mock')

  try {
    let grantedByName = session.steamDisplayName
    try {
      const profileDoc = await db.collection('profiles').doc(session.userId).get()
      if (profileDoc.exists) {
        grantedByName = profileDoc.data()?.display_name || grantedByName
      }
    } catch {}

    await runWithTimeout(
      db.collection('admin_grants').doc(steamId).set({
        steam_id: steamId,
        granted_by_user_id: session.userId,
        granted_by_name: grantedByName,
        created_at: new Date(),
      }),
      3500
    )
  } catch (error) {
    console.error('Failed to grant admin access in Firestore:', error)
    redirect('/admin?tab=admins&error=grant-failed')
  }

  invalidateCache(['admin_grants_steam_ids', 'admin_grants_list'])
  revalidatePath('/admin')
  redirect('/admin?tab=admins&granted=1')
}

export async function revokeAdminAction(formData: FormData) {
  const session = await guardPlatformAdmin()

  const steamId = String(formData.get('steamId') || '').trim()
  if (!steamId) redirect('/admin?tab=admins&error=missing-fields')

  if (steamId === session.steamId) {
    redirect('/admin?tab=admins&error=cannot-revoke-self')
  }

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        await runWithTimeout(db.collection('admin_grants').doc(steamId).delete(), 3500)
      } catch (error) {
        console.error('Failed to revoke admin access in Firestore:', error)
      }
    }
  }

  invalidateCache(['admin_grants_steam_ids', 'admin_grants_list'])
  revalidatePath('/admin')
  redirect('/admin?tab=admins&revoked=1')
}
