'use server'

/**
 * app/market/actions/market-applications.ts
 *
 * Server actions for applying to team listings, hiring, declining, and withdrawing applications.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyDriverHired, createNotification } from '@/lib/notifications-data'
import { invalidateCache } from '@/lib/ttl-cache'
import { cleanupDriverMarketDataOnTeamJoin } from '@/lib/market-cleanup'

export async function applyToTeamListingAction(listingId: string, message?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('You must be logged in to apply.')

  const existing = await db.marketApplication.findFirst({ where: { listingId, userId: session.userId } })
  if (existing) {
    await db.marketApplication.update({ where: { id: existing.id }, data: { message: message || '', status: 'pending' } })
    revalidatePath('/market')
    return
  }

  const listing = await db.marketListing.findUnique({ where: { id: listingId } })
  if (!listing) throw new Error('Listing not found')

  const profile = await db.profile.findUnique({ where: { userId: session.userId } })
  const userName = profile?.displayName || session.steamDisplayName || 'Driver'
  const userAvatar = profile?.avatarUrl || session.avatarUrl || null

  await db.marketApplication.create({
    data: {
      listingId,
      teamId: listing.teamId,
      userId: session.userId,
      userName,
      userAvatar,
      contactInfo: 'Discord / Steam Profile',
      status: 'pending',
      message: message || '',
    },
  })

  const team = listing.teamId ? await db.team.findUnique({ where: { id: listing.teamId } }) : null
  const teamName = team?.name || listing.teamName || 'your team'
  const leaderId = team?.ownerUserId || listing.userId

  if (leaderId) {
    await createNotification({
      userId: leaderId,
      title: 'New Driver Application',
      message: `Driver ${userName} has applied to join ${teamName}.`,
      link: listing.teamId ? `/equipos/${listing.teamId}` : '/equipos',
    })
  }

  await createNotification({
    userId: session.userId,
    title: 'Application Sent',
    message: `Your application to join ${teamName} has been successfully sent to the team leader.`,
    link: '/market',
  })

  revalidatePath('/market')
}

export async function hireDriverFromApplicationAction(applicationId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const application = await db.marketApplication.findUnique({ where: { id: applicationId } })
  if (!application) throw new Error('Application not found')
  const hiredUserId = application.userId

  const team = application.teamId ? await db.team.findUnique({ where: { id: application.teamId } }) : null
  if (!team || team.ownerUserId !== session.userId) {
    throw new Error('Not authorized to hire for this team')
  }

  await db.$transaction([
    db.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: hiredUserId } },
      create: { teamId: team.id, userId: hiredUserId, role: 'driver' },
      update: {},
    }),
    db.marketApplication.update({ where: { id: applicationId }, data: { status: 'accepted' } }),
    db.marketListing.deleteMany({ where: { userId: hiredUserId } }),
    db.marketApplication.updateMany({ where: { userId: hiredUserId, status: 'pending', id: { not: applicationId } }, data: { status: 'declined' } }),
    db.teamInvite.updateMany({ where: { invitedUserId: hiredUserId, status: 'pending' }, data: { status: 'rejected' } }),
  ])

  await cleanupDriverMarketDataOnTeamJoin(hiredUserId)
  await notifyDriverHired({ userId: hiredUserId, teamName: team.name || 'a team', teamId: team.id })

  revalidatePath('/market')
  revalidatePath('/equipos')
}

export async function declineApplicationAction(applicationId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const application = await db.marketApplication.findUnique({ where: { id: applicationId } })
  if (!application) throw new Error('Application not found')

  const team = application.teamId ? await db.team.findUnique({ where: { id: application.teamId } }) : null
  if (!team || team.ownerUserId !== session.userId) {
    throw new Error('Not authorized')
  }

  await db.marketApplication.update({ where: { id: applicationId }, data: { status: 'declined' } })
  revalidatePath('/market')
}

export async function withdrawApplicationAction(listingId: string, applicationId?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const candidateUserIds = Array.from(new Set([session.userId, session.steamId].filter(Boolean))) as string[]

  await db.marketApplication.deleteMany({
    where: {
      OR: [
        ...(applicationId ? [{ id: applicationId }] : []),
        { listingId, userId: { in: candidateUserIds } },
      ],
    },
  })

  invalidateCache(['teams_dashboard', 'market', 'platform_leagues'])
  revalidatePath('/market')
  revalidatePath('/equipos')
}
