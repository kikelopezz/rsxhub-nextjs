'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

import { invalidateCache } from '@/lib/ttl-cache'

export async function respondTeamInvite(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const inviteId = String(formData.get('inviteId') || '')
  const decision = String(formData.get('decision') || '').toLowerCase()
  if (!inviteId || (decision !== 'accepted' && decision !== 'rejected')) redirect('/perfil')

  try {
    const invite = await db.teamInvite.findUnique({ where: { id: inviteId } })
    if (invite && invite.status === 'pending') {
      const isInviteForUser = invite.invitedUserId === session.userId || String(invite.invitedSteamId || '') === session.steamId

      if (isInviteForUser) {
        await db.teamInvite.update({ where: { id: inviteId }, data: { status: decision as any } })

        if (decision === 'accepted') {
          await db.$transaction([
            db.teamMember.upsert({
              where: { teamId_userId: { teamId: invite.teamId, userId: session.userId } },
              create: { teamId: invite.teamId, userId: session.userId, role: 'driver' },
              update: {},
            }),
            db.marketListing.deleteMany({ where: { userId: session.userId } }),
            db.marketApplication.updateMany({ where: { userId: session.userId, status: 'pending' }, data: { status: 'declined' } }),
            db.teamInvite.updateMany({ where: { invitedUserId: session.userId, status: 'pending', id: { not: inviteId } }, data: { status: 'rejected' } }),
          ])
        }
      }
    }
  } catch (error) {
    console.error('Failed to respond to team invite:', error)
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/perfil')
  revalidatePath('/equipos')
  revalidatePath('/market')
  redirect(`/perfil?invite=${decision}`)
}

export async function updateProfile(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Unauthorized: No active session found.' }

  const preferredCategories = formData.getAll('preferredCategories').map((value) => String(value).trim().toUpperCase())
  const isPublic = formData.get('isPublic') === 'true'
  const bannerUrl = String(formData.get('bannerUrl') || '').trim() || null
  const accentColor = String(formData.get('accentColor') || '').trim() || null

  try {
    await db.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        displayName: String(formData.get('displayName') || '').trim() || session.steamDisplayName,
        countryCode: String(formData.get('countryCode') || 'ES').trim().toUpperCase(),
        bio: String(formData.get('bio') || ''),
        mainSim: String(formData.get('mainSim') || 'ac') as any,
        preferredCategories,
        avatarUrl: session.avatarUrl || null,
        isPublic,
        bannerUrl,
        accentColor,
      },
      update: {
        displayName: String(formData.get('displayName') || '').trim() || session.steamDisplayName,
        countryCode: String(formData.get('countryCode') || 'ES').trim().toUpperCase(),
        bio: String(formData.get('bio') || ''),
        mainSim: String(formData.get('mainSim') || 'ac') as any,
        preferredCategories,
        avatarUrl: session.avatarUrl || null,
        isPublic,
        bannerUrl,
        accentColor,
      },
    })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return { success: false, error: 'Failed to save the profile.' }
  }

  revalidatePath('/perfil')
  revalidatePath('/perfil/editar')
  revalidatePath(`/perfil/${session.userId}`)
  return { success: true }
}
