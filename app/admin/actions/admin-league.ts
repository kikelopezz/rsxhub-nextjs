'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  canAccessPlatformAdmin,
  canManageLeague,
  canStewardLeague,
  getCurrentUser,
  getLeagueRole,
  getPlatformRole,
} from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import type { LeagueRole } from '@/types'

export async function guardPlatformAdmin() {
  const session = await getCurrentUser()
  const role = await getPlatformRole(session?.userId)
  if (!session || !canAccessPlatformAdmin(role)) redirect('/perfil')
  return session
}

function parseClassTags(formData: FormData) {
  const fromButtons = formData
    .getAll('classTags')
    .map((entry) => String(entry || '').trim().toUpperCase())
    .filter(Boolean)
  const fromText = String(formData.get('customClassTags') || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
  return Array.from(new Set([...fromButtons, ...fromText])).slice(0, 8)
}

export async function createLeague(formData: FormData) {
  const session = await guardPlatformAdmin()

  const title = String(formData.get('title') || '')
  const slug = String(formData.get('slug') || '')
  const classTags = parseClassTags(formData)

  const league = await db.league.create({
    data: {
      title,
      slug,
      shortDescription: String(formData.get('shortDescription') || ''),
      fullDescription: String(formData.get('fullDescription') || ''),
      simulator: String(formData.get('simulator') || 'ac') as any,
      format: String(formData.get('format') || 'sprint') as any,
      status: String(formData.get('status') || 'draft') as any,
      bannerUrl: String(formData.get('bannerUrl') || '') || null,
      isFeatured: formData.get('featured') === 'on',
      registrationMode: String(formData.get('registrationMode') || 'individual') as any,
      classTags,
    },
  })

  await db.leagueMember.create({
    data: { leagueId: league.id, userId: session.userId, role: 'league_owner' },
  })

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  redirect('/admin?created=1')
}

export async function guardLeaguePermission(leagueId: string, required: 'manage' | 'steward') {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const platformRole = await getPlatformRole(session.userId)
  if (canAccessPlatformAdmin(platformRole)) {
    return { session, platformRole, leagueRole: null as LeagueRole | null }
  }

  const leagueRole = await getLeagueRole(leagueId, session.userId)
  const allowed = required === 'manage' ? canManageLeague(leagueRole) : canStewardLeague(leagueRole)

  if (!allowed) redirect('/admin')

  return { session, platformRole, leagueRole }
}

export async function updateLeague(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  await guardLeaguePermission(leagueId, 'manage')

  try {
    await db.league.update({
      where: { id: leagueId },
      data: {
        title: String(formData.get('title') || ''),
        slug: String(formData.get('slug') || ''),
        shortDescription: String(formData.get('shortDescription') || ''),
        fullDescription: String(formData.get('fullDescription') || ''),
        simulator: String(formData.get('simulator') || 'ac') as any,
        format: String(formData.get('format') || 'sprint') as any,
        status: String(formData.get('status') || 'draft') as any,
        bannerUrl: String(formData.get('bannerUrl') || '') || null,
        isFeatured: formData.get('featured') === 'on',
        registrationMode: String(formData.get('registrationMode') || 'individual') as any,
        classTags: parseClassTags(formData),
      },
    })
  } catch (error) {
    console.error('Failed to update league:', error)
    redirect(`/admin/ligas/${leagueId}?leagueError=update-failed`)
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(`/admin/ligas/${leagueId}?leagueUpdated=1`)
}

export async function quickUpdateLeagueStatusAction(formData: FormData) {
  await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')
  const status = String(formData.get('status') || 'draft')

  if (!leagueId) redirect('/admin?error=missing-fields')

  await db.league.update({ where: { id: leagueId }, data: { status: status as any } }).catch((error) => {
    console.error('Failed to update league status:', error)
  })

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect('/admin?tab=leagues&updated=1')
}

export async function quickToggleLeagueRegistrationAction(formData: FormData) {
  await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')

  if (!leagueId) redirect('/admin?error=missing-fields')

  // registrationOpen is derived from status === 'open'; toggling flips between open/draft.
  const league = await db.league.findUnique({ where: { id: leagueId }, select: { status: true } })
  if (league) {
    await db.league.update({
      where: { id: leagueId },
      data: { status: league.status === 'open' ? 'draft' : 'open' },
    }).catch((error) => console.error('Failed to toggle registration:', error))
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect('/admin?tab=leagues&updated=1')
}

export async function quickToggleLeagueFeaturedAction(formData: FormData) {
  await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')

  if (!leagueId) redirect('/admin?error=missing-fields')

  const league = await db.league.findUnique({ where: { id: leagueId }, select: { isFeatured: true } })
  if (league) {
    await db.league.update({ where: { id: leagueId }, data: { isFeatured: !league.isFeatured } }).catch((error) =>
      console.error('Failed to toggle featured:', error)
    )
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect('/admin?tab=leagues&updated=1')
}

export async function deleteLeagueAction(formData: FormData) {
  await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')

  if (!leagueId) redirect('/admin?error=missing-fields')

  // Every child table cascades from leagues via FK — one delete is enough.
  await db.league.delete({ where: { id: leagueId } }).catch((error) => {
    console.error('Failed to delete league:', error)
  })

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  redirect('/admin?tab=leagues&updated=1')
}
