'use server'

/**
 * app/market/actions/market-invites.ts
 *
 * Server actions for inviting drivers from market listings and accepting/declining invites.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyTeamInvitation } from '@/lib/notifications-data'
import { cleanupDriverMarketDataOnTeamJoin } from '@/lib/market-cleanup'

export async function inviteDriverFromListingAction(driverListingId: string, teamId: string, customMessage?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const listing = await db.marketListing.findUnique({ where: { id: driverListingId } })
  if (!listing) throw new Error('Listing not found')

  const team = await db.team.findUnique({ where: { id: teamId } })
  if (!team || team.ownerUserId !== session.userId) {
    throw new Error('Not authorized')
  }

  if (listing.userId) {
    const alreadyInvited = await db.teamInvite.findFirst({ where: { teamId, invitedUserId: listing.userId, status: 'pending' } })
    if (alreadyInvited) return
  }

  await db.teamInvite.create({
    data: {
      teamId,
      invitedByUserId: session.userId,
      invitedUserId: listing.userId,
      invitedSteamId: '',
      message: customMessage || 'Team invitation from Driver Market',
      listingId: driverListingId,
    },
  })

  if (listing.userId) {
    await notifyTeamInvitation({
      invitedUserId: listing.userId,
      teamName: team.name || 'a team',
      message: customMessage || 'Join our team for the upcoming championships.',
    })
  }

  revalidatePath('/market')
}

export async function acceptInviteFromMarketAction(inviteId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const invite = await db.teamInvite.findUnique({ where: { id: inviteId } })
  if (!invite) throw new Error('Invite not found')
  if (invite.invitedUserId !== session.userId) throw new Error('Not authorized')

  await db.$transaction([
    db.teamMember.upsert({
      where: { teamId_userId: { teamId: invite.teamId, userId: session.userId } },
      create: { teamId: invite.teamId, userId: session.userId, role: 'driver' },
      update: {},
    }),
    db.teamInvite.update({ where: { id: inviteId }, data: { status: 'accepted' } }),
    db.marketListing.deleteMany({ where: { userId: session.userId } }),
    db.marketApplication.updateMany({ where: { userId: session.userId, status: 'pending' }, data: { status: 'declined' } }),
    db.teamInvite.updateMany({ where: { invitedUserId: session.userId, status: 'pending', id: { not: inviteId } }, data: { status: 'rejected' } }),
  ])

  await cleanupDriverMarketDataOnTeamJoin(session.userId)

  revalidatePath('/market')
  revalidatePath('/equipos')
}

export async function declineInviteFromMarketAction(inviteId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const invite = await db.teamInvite.findUnique({ where: { id: inviteId } })
  if (!invite) throw new Error('Invite not found')
  if (invite.invitedUserId !== session.userId) throw new Error('Not authorized')

  await db.teamInvite.update({ where: { id: inviteId }, data: { status: 'rejected' } })
  revalidatePath('/market')
}
