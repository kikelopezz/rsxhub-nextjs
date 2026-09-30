'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { logAdminAction } from '@/lib/audit-log'
import { guardPlatformAdmin } from './admin-league'

const STEAM_ID_PATTERN = /^\d{10,20}$/

export async function grantAdminAction(formData: FormData) {
  const session = await guardPlatformAdmin()

  const steamId = String(formData.get('steamId') || '').trim()
  // Opcional: vacío o 0 = sin caducidad, como hasta ahora.
  const expiresInDays = Math.max(0, Math.min(3650, Number(formData.get('expiresInDays')) || 0))
  const expiresAt = expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null

  if (!STEAM_ID_PATTERN.test(steamId)) {
    redirect('/admin?tab=admins&error=invalid-steamid')
  }

  try {
    const profile = await db.profile.findUnique({ where: { userId: session.userId } })
    const grantedByName = profile?.displayName || session.steamDisplayName

    await db.adminGrant.upsert({
      where: { steamId },
      create: { steamId, grantedByUserId: session.userId, grantedByName, expiresAt },
      update: { grantedByUserId: session.userId, grantedByName, expiresAt },
    })
    await logAdminAction({
      actorUserId: session.userId,
      actorName: session.steamDisplayName,
      action: 'grant_admin',
      targetId: steamId,
      detail: expiresAt ? `hasta ${expiresAt.toISOString()}` : 'sin caducidad',
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
    // Sin esto, quien ya tenía la sesión abierta seguiría siendo admin hasta que su JWT caducase solo.
    const account = await db.steamAccount.findUnique({ where: { steamId } })
    if (account) await db.user.update({ where: { id: account.userId }, data: { sessionVersion: { increment: 1 } } })
    await logAdminAction({ actorUserId: session.userId, actorName: session.steamDisplayName, action: 'revoke_admin', targetId: steamId })
  } catch (error) {
    console.error('Failed to revoke admin access:', error)
    redirect('/admin?tab=admins&error=action-failed')
  }

  invalidateCache(['admin_grants_steam_ids', 'admin_grants_list'])
  revalidatePath('/admin')
  redirect('/admin?tab=admins&revoked=1')
}
