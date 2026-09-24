'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { canAccessPlatformAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
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

  const actorCanAssignOwner = canAccessPlatformAdmin(platformRole) || leagueRole === 'league_owner'
  if (role === 'league_owner' && !actorCanAssignOwner) redirect(`/admin/ligas/${leagueId}/miembros?error=forbidden`)

  try {
    const account = await db.steamAccount.findFirst({ where: { steamId } })
    if (!account) redirect(`/admin/ligas/${leagueId}/miembros?error=user-not-found`)

    const targetUserId = account.userId

    if (role === 'league_owner' && targetUserId === session.userId && !canAccessPlatformAdmin(platformRole)) {
      redirect(`/admin/ligas/${leagueId}/miembros?error=owner-self`)
    }

    await db.leagueMember.upsert({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
      create: { leagueId, userId: targetUserId, role },
      update: { role },
    })
  } catch (error) {
    console.error('Failed to assign league role:', error)
    redirect(`/admin/ligas/${leagueId}/miembros?error=user-not-found`)
  }

  revalidatePath(`/admin/ligas/${leagueId}/miembros`)
  redirect(`/admin/ligas/${leagueId}/miembros?updated=1`)
}

export async function adminDeleteMarketListing(listingId: string) {
  await guardPlatformAdmin()

  try {
    await db.marketListing.delete({ where: { id: listingId } })
  } catch (error) {
    console.error('Failed to delete market listing:', error)
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

  try {
    if (newRole === 'platform_admin' || newRole === 'steward') {
      const existing = await db.platformRole.findFirst({ where: { userId: targetUserId } })
      if (existing) {
        await db.platformRole.update({ where: { id: existing.id }, data: { role: newRole } })
      } else {
        await db.platformRole.create({ data: { userId: targetUserId, role: newRole } })
      }
    } else {
      await db.platformRole.deleteMany({ where: { userId: targetUserId } })
    }
  } catch (err) {
    console.error('Failed to update user role:', err)
  }

  invalidateCache([`platform_role_${targetUserId}`, 'platform_drivers', 'platform_roles'])
  revalidatePath('/admin')
}

export async function updateDriverNameAction(formData: FormData) {
  await guardPlatformAdmin()

  const targetUserId = String(formData.get('targetUserId') || '')
  const displayName = String(formData.get('displayName') || '').trim().slice(0, 60)
  if (!targetUserId || !displayName) return

  try {
    // The name is denormalized in a few places (team roster, registrations), so keep them in sync.
    await db.$transaction([
      db.profile.updateMany({ where: { userId: targetUserId }, data: { displayName } }),
      db.teamMember.updateMany({ where: { userId: targetUserId }, data: { displayName } }),
      db.leagueRegistration.updateMany({ where: { userId: targetUserId }, data: { displayName } }),
    ])
  } catch (err) {
    console.error('Failed to update driver name:', err)
  }

  invalidateCache(['platform_drivers', 'teams_dashboard', 'platform_leagues', 'leagues'])
  revalidatePath('/admin')
  revalidatePath('/equipos')
  revalidatePath('/ligas')
  revalidatePath(`/perfil/${targetUserId}`)
}

export async function deleteUserAccountAction(targetUserId: string) {
  const session = await guardPlatformAdmin()

  if (targetUserId === session.userId) {
    throw new Error('No puedes eliminar tu propia cuenta de administrador.')
  }

  try {
    // Mirrors the original scope exactly: wipes the profile, roles, team
    // memberships, registrations, and market listings, but deliberately
    // leaves the users/steam_accounts identity rows in place.
    await db.$transaction([
      db.profile.deleteMany({ where: { userId: targetUserId } }),
      db.platformRole.deleteMany({ where: { userId: targetUserId } }),
      db.teamMember.deleteMany({ where: { userId: targetUserId } }),
      db.leagueRegistration.deleteMany({ where: { userId: targetUserId } }),
      db.marketListing.deleteMany({ where: { userId: targetUserId } }),
    ])
  } catch (err) {
    console.error('Failed to delete user account:', err)
    throw err
  }

  invalidateCache()
  revalidatePath('/admin')
}
