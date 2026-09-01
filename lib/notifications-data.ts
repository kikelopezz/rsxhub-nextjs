import { cache } from 'react'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
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
    let rawList: UserNotification[] = []

    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        try {
          const snap = await db
            .collection('user_notifications')
            .where('user_id', '==', userId)
            .get()

        if (!snap.empty) {
          rawList = snap.docs.map((doc: any) => {
            const data = doc.data()
            let createdIso = new Date().toISOString()
            if (data.created_at) {
              if (typeof data.created_at.toDate === 'function') {
                createdIso = data.created_at.toDate().toISOString()
              } else {
                createdIso = new Date(data.created_at).toISOString()
              }
            }

            return {
              id: doc.id,
              userId: data.user_id || '',
              title: data.title || '',
              message: data.message || '',
              read: Boolean(data.read),
              createdAt: createdIso,
              link: data.link || null,
            }
          })
        }
      } catch (err) {
        console.error('Failed to fetch user notifications from Firestore:', err)
      }
    }
  }

  // Fallback / merge mock cookie mode
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const cookieVal = cookieStore.get(`mock_notifications_${userId}`)?.value || cookieStore.get('mock_notifications')?.value
    if (cookieVal) {
      const mockList: UserNotification[] = JSON.parse(cookieVal)
      const userMocks = mockList.filter((n) => n.userId === userId)
      rawList = [...rawList, ...userMocks]
    }
  } catch (e) {}

  // Deduplicate by title + message
  const seen = new Set<string>()
  const uniqueList: UserNotification[] = []
  
  // Sort descending by date first
  rawList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  for (const item of rawList) {
    const key = `${item.title}_${item.message}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueList.push(item)
    }
  }

    return uniqueList.slice(0, 30)
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

  let createdInFirestore = false

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const snap = await db
          .collection('user_notifications')
          .where('user_id', '==', userId)
          .get()

        const isDuplicate = snap.docs.some((doc: any) => {
          const d = doc.data()
          if (d.title === title && d.message === message) return true
          return false
        })

        if (isDuplicate) return

        await db.collection('user_notifications').add({
          user_id: userId,
          title,
          message,
          read: false,
          created_at: new Date(),
          link: link || null,
        })
        createdInFirestore = true
      } catch (err) {
        console.error('Failed to create notification in Firestore:', err)
      }
    }
  }

  // Fallback to mock cookie ONLY if not saved in Firestore
  if (!createdInFirestore) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const key = `mock_notifications_${userId}`
      const existing = cookieStore.get(key)?.value
      let current: UserNotification[] = existing ? JSON.parse(existing) : []

      const isDup = current.some((n) => n.title === title && n.message === message)
      if (isDup) return

      current.unshift({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        title,
        message,
        read: false,
        createdAt: new Date().toISOString(),
        link: link || null,
      })
      cookieStore.set(key, JSON.stringify(current.slice(0, 30)), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    } catch (e) {
      console.error('Failed to save mock notification cookie:', e)
    }
  }
}

export async function markNotificationAsRead(userId: string, notificationId?: string) {
  if (!userId) return

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        if (notificationId) {
          await db.collection('user_notifications').doc(notificationId).update({ read: true })
        } else {
          const snap = await db.collection('user_notifications').where('user_id', '==', userId).where('read', '==', false).get()
          const batch = db.batch()
          snap.docs.forEach((doc: any) => batch.update(doc.ref, { read: true }))
          await batch.commit()
        }
      } catch (err) {
        console.error('Failed to mark notification read in Firestore:', err)
      }
    }
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const key = `mock_notifications_${userId}`
    const existing = cookieStore.get(key)?.value
    if (existing) {
      let current: UserNotification[] = JSON.parse(existing)
      current = current.map((n) => {
        if (!notificationId || n.id === notificationId) {
          return { ...n, read: true }
        }
        return n
      })
      cookieStore.set(key, JSON.stringify(current), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    }
  } catch (e) {}
}

export async function clearAllNotifications(userId: string) {
  if (!userId) return

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const snap = await db.collection('user_notifications').where('user_id', '==', userId).get()
        if (!snap.empty) {
          const batch = db.batch()
          snap.docs.forEach((doc: any) => batch.delete(doc.ref))
          await batch.commit()
        }
      } catch (err) {
        console.error('Failed to clear notifications in Firestore:', err)
      }
    }
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const key = `mock_notifications_${userId}`
    cookieStore.delete(key)
    cookieStore.delete('mock_notifications')
  } catch (e) {}
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
  for (const userId of userIds) {
    await createNotification({
      userId,
      title: `Upcoming Round: ${eventTitle}`,
      message: `The session at ${circuitName} is scheduled for ${startsAt}.`,
      link: leagueSlug ? `/ligas/${leagueSlug}` : '/calendario',
    })
  }
}
