import { cache } from 'react'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'

export interface UserNotification {
  id: string
  userId: string
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string | null
}

export const getUserNotifications = cache(async (userId: string): Promise<UserNotification[]> => {
  if (!userId) return []

  return fetchWithTTLCache(`user_notifications_${userId}`, async () => {
    try {
      const rows = await db.userNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 })
      return rows.map((n) => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        link: n.link,
      }))
    } catch (err) {
      console.error('Failed to fetch user notifications:', err)
      return []
    }
  }, 30)
})

export async function createNotification({
  userId,
  title,
  message,
  link,
}: {
  userId: string
  title: string
  message: string
  link?: string
}) {
  if (!userId) return

  try {
    const isDuplicate = await db.userNotification.findFirst({ where: { userId, title, message } })
    if (isDuplicate) return

    await db.userNotification.create({ data: { userId, title, message, read: false, link: link || null } })
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}

export async function markNotificationAsRead(userId: string, notificationId?: string) {
  if (!userId) return

  try {
    if (notificationId) {
      await db.userNotification.update({ where: { id: notificationId }, data: { read: true } })
    } else {
      await db.userNotification.updateMany({ where: { userId, read: false }, data: { read: true } })
    }
  } catch (err) {
    console.error('Failed to mark notification read:', err)
  }
}

export async function clearAllNotifications(userId: string) {
  if (!userId) return

  try {
    await db.userNotification.deleteMany({ where: { userId } })
  } catch (err) {
    console.error('Failed to clear notifications:', err)
  }
}

export async function notifyDriverHired({
  userId,
  teamName,
  teamId,
}: {
  userId: string
  teamName: string
  teamId: string
}) {
  await createNotification({
    userId,
    title: `Welcome to ${teamName}!`,
    message: `You've been accepted as an official driver for ${teamName}. Check your team dashboard!`,
    link: `/equipos/${teamId}`,
  })
}

export async function notifyTeamInvitation({
  invitedUserId,
  teamName,
  message,
}: {
  invitedUserId: string
  teamName: string
  message?: string
}) {
  await createNotification({
    userId: invitedUserId,
    title: `Team Invitation: ${teamName}`,
    message: message || `${teamName} has sent you an invitation to join their team.`,
    link: '/perfil',
  })
}

export async function notifyTeamApplication({
  leaderUserId,
  driverName,
  teamName,
  classTag,
}: {
  leaderUserId: string
  driverName: string
  teamName: string
  classTag?: string
}) {
  await createNotification({
    userId: leaderUserId,
    title: 'New Driver Application',
    message: `Driver ${driverName} has applied to join ${teamName}${classTag ? ` in the ${classTag} class` : ''}.`,
    link: '/equipos',
  })
}

export async function notifyLeagueRegistrationStatus({
  userId,
  leagueTitle,
  leagueSlug,
  status,
  assignedNumber,
}: {
  userId: string
  leagueTitle: string
  leagueSlug?: string
  status: 'accepted' | 'rejected'
  assignedNumber?: string | null
}) {
  if (status === 'accepted') {
    await createNotification({
      userId,
      title: `Registration Approved: ${leagueTitle}`,
      message: `Your registration in ${leagueTitle}${assignedNumber ? ` with car number #${assignedNumber}` : ''} has been confirmed. Get ready for the first round!`,
      link: leagueSlug ? `/ligas/${leagueSlug}` : '/ligas',
    })
  } else {
    await createNotification({
      userId,
      title: `Registration Updated: ${leagueTitle}`,
      message: `Your registration request for ${leagueTitle} has been updated.`,
      link: leagueSlug ? `/ligas/${leagueSlug}` : '/ligas',
    })
  }
}

export async function notifyRaceEventScheduled({
  userIds,
  eventTitle,
  circuitName,
  startsAt,
  leagueSlug,
}: {
  userIds: string[]
  eventTitle: string
  circuitName: string
  startsAt: string
  leagueSlug?: string
}) {
  await Promise.all(
    userIds.map((userId) =>
      createNotification({
        userId,
        title: `Upcoming Round: ${eventTitle}`,
        message: `The session at ${circuitName} is scheduled for ${startsAt}.`,
        link: leagueSlug ? `/ligas/${leagueSlug}` : '/calendario',
      })
    )
  )
}
