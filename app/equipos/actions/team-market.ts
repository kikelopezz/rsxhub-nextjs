'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
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

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const appRef = db.collection('market_applications').doc(applicationId)
        const appDoc = await appRef.get()
        if (!appDoc.exists) redirect(`${redirectTo}?error=app-not-found`)
        const appData = appDoc.data()
        const hiredUserId = appData?.user_id
        const applicantName = appData?.user_name || 'Driver'

        const teamDoc = await db.collection('teams').doc(teamId).get()
        const teamName = teamDoc.exists ? (teamDoc.data()?.name || 'the team') : 'the team'

        // Add to team_members
        await db.collection('team_members').doc(`${teamId}_${hiredUserId}`).set({
          team_id: teamId,
          user_id: hiredUserId,
          role: 'driver',
          created_at: new Date(),
        })

        // Update application status
        await appRef.update({ status: 'accepted' })

        // Cleanup: Delete hired driver's listings, applications, and invites
        try {
          const listingsSnap = await db.collection('market_listings').where('user_id', '==', hiredUserId).get()
          const b1 = db.batch()
          listingsSnap.docs.forEach((doc: any) => b1.delete(doc.ref))
          await b1.commit()
        } catch {}

        try {
          const appsSnap = await db.collection('market_applications').where('user_id', '==', hiredUserId).get()
          const b2 = db.batch()
          appsSnap.docs.forEach((doc: any) => {
            if (doc.data()?.status === 'pending') b2.delete(doc.ref)
          })
          await b2.commit()
        } catch {}

        try {
          const invitesSnap = await db.collection('team_invites').where('invited_user_id', '==', hiredUserId).get()
          const b3 = db.batch()
          invitesSnap.docs.forEach((doc: any) => {
            if (doc.data()?.status === 'pending') b3.delete(doc.ref)
          })
          await b3.commit()
        } catch {}

        await cleanupDriverMarketDataOnTeamJoin(hiredUserId)

        // Send notifications
        if (hiredUserId) {
          await createNotification({
            userId: hiredUserId,
            title: `Application Accepted!`,
            message: `Congratulations! You have been accepted as an official driver for ${teamName}.`,
            link: `/equipos/${teamId}`,
          })
        }

        await createNotification({
          userId: session.userId,
          title: `Driver Joined`,
          message: `Driver ${applicantName} is now an official driver for ${teamName}.`,
          link: `/equipos/${teamId}`,
        })
      } catch (err) {
        console.error('Failed to accept application:', err)
        redirect(`${redirectTo}?error=accept-failed`)
      }
    }
  } else {
    // Mock Mode Fallback
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()

      const appsVal = cookieStore.get('mock_market_applications')?.value
      let apps = appsVal ? JSON.parse(appsVal) : []
      const appIdx = apps.findIndex((a: any) => a.id === applicationId)

      if (appIdx !== -1) {
        const appData = apps[appIdx]
        const hiredUserId = appData.userId

        // Add to mock teams members
        const teamsVal = cookieStore.get('mock_teams')?.value
        const teams = teamsVal ? JSON.parse(teamsVal) : []
        const teamIdx = teams.findIndex((t: any) => t.id === teamId)

        if (teamIdx !== -1) {
          const team = teams[teamIdx]
          if (!team.members) team.members = []
          if (!team.members.some((m: any) => m.userId === hiredUserId)) {
            team.members.push({
              id: `member_${teamId}_${hiredUserId}`,
              teamId,
              userId: hiredUserId,
              role: 'driver',
              createdAt: new Date().toISOString(),
              displayName: appData.userName,
            })
          }
          cookieStore.set('mock_teams', JSON.stringify(teams), { path: '/', maxAge: 60 * 60 * 24 * 30 })
        }

        apps[appIdx].status = 'accepted'
        apps = apps.filter((a: any) => a.id === applicationId || !(a.userId === hiredUserId && a.status === 'pending'))
        cookieStore.set('mock_market_applications', JSON.stringify(apps), { path: '/', maxAge: 60 * 60 * 24 * 7 })

        // Cleanup driver's mock listings
        const listingsVal = cookieStore.get('mock_market_listings')?.value
        if (listingsVal) {
          let listings = JSON.parse(listingsVal)
          listings = listings.filter((l: any) => l.user_id !== hiredUserId)
          cookieStore.set('mock_market_listings', JSON.stringify(listings), { path: '/', maxAge: 60 * 60 * 24 * 7 })
        }
      }
    } catch (e) {
      console.error(e)
    }
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

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const appRef = db.collection('market_applications').doc(applicationId)
        const appDoc = await appRef.get()
        if (appDoc.exists) {
          const appData = appDoc.data()
          const applicantUserId = appData?.user_id
          const applicantName = appData?.user_name || 'Driver'

          const teamDoc = await db.collection('teams').doc(teamId).get()
          const teamName = teamDoc.exists ? (teamDoc.data()?.name || 'the team') : 'the team'

          await appRef.update({ status: 'declined' })

          if (applicantUserId) {
            await createNotification({
              userId: applicantUserId,
              title: `Application Update`,
              message: `Your application to join ${teamName} was declined.`,
              link: '/market',
            })
          }

          await createNotification({
            userId: session.userId,
            title: `Application Declined`,
            message: `You declined the application from ${applicantName} for ${teamName}.`,
            link: `/equipos/${teamId}`,
          })
        }
      } catch (err) {
        console.error('Failed to decline application:', err)
        redirect(`${redirectTo}?error=decline-failed`)
      }
    }
  } else {
    // Mock Mode
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const appsVal = cookieStore.get('mock_market_applications')?.value
      const apps = appsVal ? JSON.parse(appsVal) : []
      const appIdx = apps.findIndex((a: any) => a.id === applicationId)
      if (appIdx !== -1) {
        apps[appIdx].status = 'declined'
        cookieStore.set('mock_market_applications', JSON.stringify(apps), { path: '/', maxAge: 60 * 60 * 24 * 7 })
      }
    } catch (e) {
      console.error(e)
    }
  }

  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?updated=1`)
}