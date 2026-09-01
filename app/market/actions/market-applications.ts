'use server'

/**
 * app/market/actions/market-applications.ts
 *
 * Server actions for applying to team listings, hiring, declining, and withdrawing applications.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { notifyDriverHired, createNotification } from '@/lib/notifications-data'
import { invalidateCache } from '@/lib/ttl-cache'
import { cleanupDriverMarketDataOnTeamJoin } from '@/lib/market-cleanup'

export async function applyToTeamListingAction(listingId: string, message?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('You must be logged in to apply.')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        // Single field query filtered in memory to avoid Firestore composite index requirement
        const existingSnap = await runWithTimeout(db.collection('market_applications')
          .where('listing_id', '==', listingId)
          .get())
        const existingDoc = existingSnap.docs.find((doc: any) => doc.data()?.user_id === session.userId)

        if (existingDoc) {
          await runWithTimeout(existingDoc.ref.update({
            message: message || '',
            status: 'pending',
            created_at: new Date(),
          }))
          revalidatePath('/market')
          return
        }

        const listingDoc = await runWithTimeout(db.collection('market_listings').doc(listingId).get())
        if (!listingDoc.exists) throw new Error('Listing not found')

        const profileDoc = await runWithTimeout(db.collection('profiles').doc(session.userId).get())
        const profileData = profileDoc.exists ? profileDoc.data() : null
        const userName = profileData?.display_name || session.steamDisplayName || 'Driver'
        const userAvatar = profileData?.avatar_url || session.avatarUrl || null

        const docRef = db.collection('market_applications').doc()
        await runWithTimeout(docRef.set({
          id: docRef.id,
          listing_id: listingId,
          team_id: listingDoc.data()?.team_id || null,
          user_id: session.userId,
          user_name: userName,
          user_avatar: userAvatar,
          contact_info: 'Discord / Steam Profile',
          status: 'pending',
          message: message || '',
          created_at: new Date(),
        }))

        // Notify team leader
        const teamIdVal = listingDoc.data()?.team_id
        const teamDoc = teamIdVal ? await runWithTimeout(db.collection('teams').doc(teamIdVal).get()) : null
        const teamName = teamDoc?.exists ? (teamDoc.data()?.name || 'your team') : (listingDoc.data()?.team_name || 'your team')
        const leaderId = teamDoc?.exists ? teamDoc.data()?.owner_user_id : listingDoc.data()?.user_id

        if (leaderId) {
          await createNotification({
            userId: leaderId,
            title: 'New Driver Application',
            message: `Driver ${userName} has applied to join ${teamName}.`,
            link: teamIdVal ? `/equipos/${teamIdVal}` : '/equipos',
          })
        }

        // Notify the driver applicant
        await createNotification({
          userId: session.userId,
          title: 'Application Sent',
          message: `Your application to join ${teamName} has been successfully sent to the team leader.`,
          link: '/market',
        })

        revalidatePath('/market')
        return
      } catch (err) {
        console.error('Failed to apply to team listing in Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existingApps = cookieStore.get('mock_market_applications')?.value
    const apps = existingApps ? JSON.parse(existingApps) : []

    const already = apps.some((a: any) => a.listingId === listingId && a.userId === session.userId)
    if (already) return

    const listingsVal = cookieStore.get('mock_market_listings')?.value
    const listings = listingsVal ? JSON.parse(listingsVal) : []
    const listing = listings.find((l: any) => l.id === listingId)
    const teamName = listing?.team_name || listing?.teamName || 'team'

    const newApp = {
      id: `mock_app_${Date.now()}`,
      listingId,
      teamId: listing?.team_id || null,
      userId: session.userId,
      userName: session.steamDisplayName || 'Driver',
      userAvatar: session.avatarUrl || null,
      contactInfo: 'Discord / Steam Profile',
      status: 'pending',
      message: message || '',
      createdAt: new Date().toISOString(),
    }
    apps.push(newApp)
    cookieStore.set('mock_market_applications', JSON.stringify(apps), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    if (listing?.user_id) {
      await createNotification({
        userId: listing.user_id,
        title: 'New Driver Application',
        message: `Driver ${session.steamDisplayName || 'Driver'} has applied to join ${teamName}.`,
        link: '/equipos',
      })
    }

    await createNotification({
      userId: session.userId,
      title: 'Application Sent',
      message: `Your application to join team ${teamName} has been successfully sent to the team leader.`,
      link: '/market',
    })
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
}

export async function hireDriverFromApplicationAction(applicationId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const appRef = db.collection('market_applications').doc(applicationId)
        const appDoc = await runWithTimeout(appRef.get())
        if (!appDoc.exists) throw new Error('Application not found')
        const appData = appDoc.data()
        const hiredUserId = appData?.user_id

        const teamDoc = await runWithTimeout(db.collection('teams').doc(appData?.team_id).get())
        if (!teamDoc.exists || teamDoc.data()?.owner_user_id !== session.userId) {
          throw new Error('Not authorized to hire for this team')
        }

        await runWithTimeout(db.collection('team_members').doc(`${appData?.team_id}_${hiredUserId}`).set({
          team_id: appData?.team_id,
          user_id: hiredUserId,
          role: 'driver',
          created_at: new Date(),
        }))

        await runWithTimeout(appRef.update({ status: 'accepted' }))

        const listingsSnap = await runWithTimeout(db.collection('market_listings').where('user_id', '==', hiredUserId).get())
        const batch = db.batch()
        listingsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        const appsSnap = await runWithTimeout(db.collection('market_applications').where('user_id', '==', hiredUserId).get())
        appsSnap.docs.forEach((doc: any) => {
          if (doc.data()?.status === 'pending') batch.delete(doc.ref)
        })

        const invitesSnap = await runWithTimeout(db.collection('team_invites').where('invited_user_id', '==', hiredUserId).get())
        invitesSnap.docs.forEach((doc: any) => {
          if (doc.data()?.status === 'pending') batch.delete(doc.ref)
        })

        await runWithTimeout(batch.commit())
        await cleanupDriverMarketDataOnTeamJoin(hiredUserId)
        await notifyDriverHired({
          userId: hiredUserId,
          teamName: teamDoc.data()?.name || 'a team',
          teamId: appData?.team_id,
        })
        revalidatePath('/market')
        revalidatePath('/equipos')
        return
      } catch (err) {
        console.error('Failed to hire driver in Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    const appsVal = cookieStore.get('mock_market_applications')?.value
    let apps = appsVal ? JSON.parse(appsVal) : []
    const appIdx = apps.findIndex((a: any) => a.id === applicationId)
    if (appIdx === -1) throw new Error('Application not found')

    const appData = apps[appIdx]
    const hiredUserId = appData.userId

    const teamsVal = cookieStore.get('mock_teams')?.value
    const teams = teamsVal ? JSON.parse(teamsVal) : []
    const teamIdx = teams.findIndex((t: any) => t.id === appData.teamId)

    if (teamIdx !== -1) {
      const team = teams[teamIdx]
      if (!team.members) team.members = []
      if (!team.members.some((m: any) => m.userId === hiredUserId)) {
        team.members.push({
          id: `member_${team.id}_${hiredUserId}`,
          teamId: team.id,
          userId: hiredUserId,
          role: 'driver',
          createdAt: new Date().toISOString(),
          displayName: appData.userName,
          steamId: hiredUserId.replace('steam_', ''),
        })
      }
      cookieStore.set('mock_teams', JSON.stringify(teams), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    }

    apps[appIdx].status = 'accepted'
    apps = apps.filter((a: any) => a.id === applicationId || !(a.userId === hiredUserId && a.status === 'pending'))
    cookieStore.set('mock_market_applications', JSON.stringify(apps), { path: '/', maxAge: 60 * 60 * 24 * 7 })

    const listingsVal = cookieStore.get('mock_market_listings')?.value
    if (listingsVal) {
      let listings = JSON.parse(listingsVal)
      listings = listings.filter((l: any) => l.user_id !== hiredUserId)
      cookieStore.set('mock_market_listings', JSON.stringify(listings), { path: '/', maxAge: 60 * 60 * 24 * 7 })
    }

    const invitesVal = cookieStore.get('mock_market_invites')?.value
    if (invitesVal) {
      let invites = JSON.parse(invitesVal)
      invites = invites.filter((i: any) => !(i.invitedUserId === hiredUserId && i.status === 'pending'))
      cookieStore.set('mock_market_invites', JSON.stringify(invites), { path: '/', maxAge: 60 * 60 * 24 * 7 })
    }
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
  revalidatePath('/equipos')
}

export async function declineApplicationAction(applicationId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const appRef = db.collection('market_applications').doc(applicationId)
        const appDoc = await runWithTimeout(appRef.get())
        if (!appDoc.exists) throw new Error('Application not found')
        const appData = appDoc.data()

        const teamDoc = await runWithTimeout(db.collection('teams').doc(appData?.team_id).get())
        if (!teamDoc.exists || teamDoc.data()?.owner_user_id !== session.userId) {
          throw new Error('Not authorized')
        }

        await runWithTimeout(appRef.update({ status: 'declined' }))
        revalidatePath('/market')
        return
      } catch (err) {
        console.error('Failed to decline application in Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    const appsVal = cookieStore.get('mock_market_applications')?.value
    const apps = appsVal ? JSON.parse(appsVal) : []
    const appIdx = apps.findIndex((a: any) => a.id === applicationId)
    if (appIdx !== -1) {
      apps[appIdx].status = 'declined'
      cookieStore.set('mock_market_applications', JSON.stringify(apps), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
    }
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
}

export async function withdrawApplicationAction(listingId: string, applicationId?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const sessUserClean = String(session.userId || '').replace(/^steam_/, '')
  const sessSteamClean = String(session.steamId || '').replace(/^steam_/, '')

  const isMyUser = (uId: any) => {
    if (!uId) return true // default to true if unassigned to avoid blocking user withdrawal
    const clean = String(uId).replace(/^steam_/, '')
    return clean === sessUserClean || clean === sessSteamClean
  }

  // 1. Delete from Firestore
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        // Direct deletion by doc ID
        if (applicationId) {
          await runWithTimeout(db.collection('market_applications').doc(applicationId).delete(), 3000).catch(() => null)
        }

        // Query by listing_id
        if (listingId) {
          const snapListing = await runWithTimeout(
            db.collection('market_applications').where('listing_id', '==', listingId).get(),
            3000
          ).catch(() => null)

          if (snapListing && !snapListing.empty) {
            for (const doc of snapListing.docs) {
              const d = doc.data()
              if (isMyUser(d.user_id || d.userId) || doc.id === applicationId) {
                await runWithTimeout(doc.ref.delete(), 2000).catch(() => null)
              }
            }
          }
        }

        // Query by user_id = session.userId
        if (session.userId) {
          const snapUser = await runWithTimeout(
            db.collection('market_applications').where('user_id', '==', session.userId).get(),
            3000
          ).catch(() => null)

          if (snapUser && !snapUser.empty) {
            for (const doc of snapUser.docs) {
              const d = doc.data()
              if (d.listing_id === listingId || d.listingId === listingId || doc.id === applicationId) {
                await runWithTimeout(doc.ref.delete(), 2000).catch(() => null)
              }
            }
          }
        }

        // Query by user_id = session.steamId
        if (session.steamId && session.steamId !== session.userId) {
          const snapSteam = await runWithTimeout(
            db.collection('market_applications').where('user_id', '==', session.steamId).get(),
            3000
          ).catch(() => null)

          if (snapSteam && !snapSteam.empty) {
            for (const doc of snapSteam.docs) {
              const d = doc.data()
              if (d.listing_id === listingId || d.listingId === listingId || doc.id === applicationId) {
                await runWithTimeout(doc.ref.delete(), 2000).catch(() => null)
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to withdraw application in Firestore:', err)
      }
    }
  }

  // 2. Delete from Mock Cookies (Always executed as safety fallback)
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existingApps = cookieStore.get('mock_market_applications')?.value
    if (existingApps) {
      let apps = JSON.parse(existingApps)
      if (Array.isArray(apps)) {
        apps = apps.filter((a: any) => !(
          (applicationId && a.id === applicationId) ||
          (isMyUser(a.userId || a.user_id) &&
           (a.listingId === listingId || a.listing_id === listingId || a.teamId === listingId || a.id === listingId))
        ))
        cookieStore.set('mock_market_applications', JSON.stringify(apps), {
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        })
      }
    }
  } catch (err) {
    console.error('Failed to withdraw application in mock mode:', err)
  }

  invalidateCache(['teams_dashboard', 'market', 'platform_leagues'])
  revalidatePath('/market')
  revalidatePath('/equipos')
}

