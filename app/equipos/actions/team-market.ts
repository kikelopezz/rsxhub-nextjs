'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications-data'
import { cleanupDriverMarketDataOnTeamJoin } from '@/lib/market-cleanup'
import { guardSession, canManageTeam } from './team-parsers'

export async function acceptDriverApplicationAction(formData: FormData) {
  const session = await guardSession()
  const teamId = String(formData.get('teamId') || '')
  const applicationId = String(formData.get('applicationId') || '')
  const redirectTo = `/equipos/${teamId}`

  if (!teamId || !applicationId) redirect(`${redirectTo}?error=invalid-app`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  try {
    const application = await db.marketApplication.findUnique({ where: { id: applicationId } })
    if (!application) redirect(`${redirectTo}?error=app-not-found`)
    const hiredUserId = application.userId
    const applicantName = application.userName || 'Driver'

    const team = await db.team.findUnique({ where: { id: teamId } })
    const teamName = team?.name || 'the team'

    await db.$transaction([
      db.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: hiredUserId } },
        create: { teamId, userId: hiredUserId, role: 'driver' },
        update: {},
      }),
      db.marketApplication.update({ where: { id: applicationId }, data: { status: 'accepted' } }),
      db.marketListing.deleteMany({ where: { userId: hiredUserId } }),
      db.marketApplication.updateMany({
        where: { userId: hiredUserId, status: 'pending', id: { not: applicationId } },
        data: { status: 'declined' },
      }),
      db.teamInvite.updateMany({ where: { invitedUserId: hiredUserId, status: 'pending' }, data: { status: 'rejected' } }),
    ])

    await cleanupDriverMarketDataOnTeamJoin(hiredUserId)

    if (hiredUserId) {
      await createNotification({
        userId: hiredUserId,
        title: 'Application Accepted!',
        message: `Congratulations! You have been accepted as an official driver for ${teamName}.`,
        link: `/equipos/${teamId}`,
      })
    }

    await createNotification({
      userId: session.userId,
      title: 'Driver Joined',
      message: `Driver ${applicantName} is now an official driver for ${teamName}.`,
      link: `/equipos/${teamId}`,
    })
  } catch (err) {
    console.error('Failed to accept application:', err)
    redirect(`${redirectTo}?error=accept-failed`)
  }

  revalidatePath('/market')
  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?roleUpdated=1`)
}

export async function declineDriverApplicationAction(formData: FormData) {
  const session = await guardSession()
  const teamId = String(formData.get('teamId') || '')
  const applicationId = String(formData.get('applicationId') || '')
  const redirectTo = `/equipos/${teamId}`

  if (!teamId || !applicationId) redirect(`${redirectTo}?error=invalid-app`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  try {
    const application = await db.marketApplication.findUnique({ where: { id: applicationId } })
    if (application) {
      const applicantUserId = application.userId
      const applicantName = application.userName || 'Driver'

      const team = await db.team.findUnique({ where: { id: teamId } })
      const teamName = team?.name || 'the team'

      await db.marketApplication.update({ where: { id: applicationId }, data: { status: 'declined' } })

      if (applicantUserId) {
        await createNotification({
          userId: applicantUserId,
          title: 'Application Update',
          message: `Your application to join ${teamName} was declined.`,
          link: '/market',
        })
      }

      await createNotification({
        userId: session.userId,
        title: 'Application Declined',
        message: `You declined the application from ${applicantName} for ${teamName}.`,
        link: `/equipos/${teamId}`,
      })
    }
  } catch (err) {
    console.error('Failed to decline application:', err)
    redirect(`${redirectTo}?error=decline-failed`)
  }

  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?updated=1`)
}
