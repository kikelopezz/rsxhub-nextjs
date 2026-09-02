'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardPlatformAdmin } from './admin-league'

const STEAM_ID_PATTERN = /^\d{10,20}$/

export async function grantAdminAction(formData: FormData) {
  const session = await guardPlatformAdmin()

  const steamId = String(formData.get('steamId') || '').trim()

  if (!STEAM_ID_PATTERN.test(steamId)) {
    redirect('/admin?tab=admins&error=invalid-steamid')
  }

  try {
    const profile = await db.profile.findUnique({ where: { userId: session.userId } })
    const grantedByName = profile?.displayName || session.steamDisplayName

    await db.adminGrant.upsert({
      where: { steamId },
      create: { steamId, grantedByUserId: session.userId, grantedByName },
      update: { grantedByUserId: session.userId, grantedByName },
    })
  } catch (error) {
    console.error('Failed to grant admin access:', error)
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

  try {
    await db.adminGrant.delete({ where: { steamId } })
  } catch (error) {
    console.error('Failed to revoke admin access:', error)
  }

  invalidateCache(['admin_grants_steam_ids', 'admin_grants_list'])
  revalidatePath('/admin')
  redirect('/admin?tab=admins&revoked=1')
}
