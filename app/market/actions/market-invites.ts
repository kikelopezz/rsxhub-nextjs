'use server'

/**
 * app/market/actions/market-invites.ts
 *
 * Server actions for inviting drivers from market listings and accepting/declining invites.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { notifyTeamInvitation } from '@/lib/notifications-data'
import { cleanupDriverMarketDataOnTeamJoin } from '@/lib/market-cleanup'

export async function inviteDriverFromListingAction(driverListingId: string, teamId: string, customMessage?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const listingDoc = await runWithTimeout(db.collection('market_listings').doc(driverListingId).get())
        if (!listingDoc.exists) throw new Error('Listing not found')
        const listingData = listingDoc.data()

        const teamDoc = await runWithTimeout(db.collection('teams').doc(teamId).get())
        if (!teamDoc.exists || teamDoc.data()?.owner_user_id !== session.userId) {
          throw new Error('Not authorized')
        }

        // Check if already invited (single field query, filtered in memory)
        const existingSnap = await runWithTimeout(db.collection('team_invites')
          .where('team_id', '==', teamId)
          .get())
        const alreadyInvited = existingSnap.docs.some((doc: any) => {
          const d = doc.data()
          return d?.invited_user_id === listingData?.user_id && d?.status === 'pending'
        })
        if (alreadyInvited) return

        const docRef = db.collection('team_invites').doc()
        await runWithTimeout(docRef.set({
          id: docRef.id,
          team_id: teamId,
          invited_by_user_id: session.userId,
          invited_user_id: listingData?.user_id,
          invited_steam_id: '',
          message: customMessage || 'Team invitation from Driver Market',
          status: 'pending',
          created_at: new Date(),
          listing_id: driverListingId,
        }))

        if (listingData?.user_id) {
          await notifyTeamInvitation({
            invitedUserId: listingData.user_id,
            teamName: teamDoc.data()?.name || 'a team',
            message: customMessage || 'Join our team for the upcoming championships.',
          })
        }
        revalidatePath('/market')
        return
      } catch (err) {
        console.error('Failed to invite driver in Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    const listingVal = cookieStore.get('mock_market_listings')?.value
    const listings = listingVal ? JSON.parse(listingVal) : []
    const listing = listings.find((l: any) => l.id === driverListingId)
    if (!listing) throw new Error('Listing not found')

    const invitesVal = cookieStore.get('mock_market_invites')?.value
    const invites = invitesVal ? JSON.parse(invitesVal) : []

    const already = invites.some((i: any) => i.listingId === driverListingId && i.teamId === teamId)
    if (already) return

    const teamsVal = cookieStore.get('mock_teams')?.value
    const teams = teamsVal ? JSON.parse(teamsVal) : []
    const team = teams.find((t: any) => t.id === teamId)

    const newInvite = {
      id: `mock_inv_${Date.now()}`,
      listingId: driverListingId,
      teamId,
      teamName: team?.name || 'Team',
      teamLogo: cookieStore.get(`mock_team_logo_${teamId}`)?.value || team?.logoUrl || null,
      invitedUserId: listing.user_id,
      invitedByUserId: session.userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    invites.push(newInvite)
    cookieStore.set('mock_market_invites', JSON.stringify(invites), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    if (listing.user_id) {
      await notifyTeamInvitation({
        invitedUserId: listing.user_id,
        teamName: team?.name || 'Team',
        message: customMessage || 'Join our team for the upcoming championships.',
      })
    }
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
}

export async function acceptInviteFromMarketAction(inviteId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const inviteRef = db.collection('team_invites').doc(inviteId)
        const inviteDoc = await runWithTimeout(inviteRef.get())
        if (!inviteDoc.exists) throw new Error('Invite not found')
        const inviteData = inviteDoc.data()

        if (inviteData?.invited_user_id !== session.userId) {
          throw new Error('Not authorized')
        }

        await runWithTimeout(db.collection('team_members').doc(`${inviteData?.team_id}_${session.userId}`).set({
          team_id: inviteData?.team_id,
          user_id: session.userId,
          role: 'driver',
          created_at: new Date(),
        }))

        await runWithTimeout(inviteRef.update({ status: 'accepted' }))

        const listingsSnap = await runWithTimeout(db.collection('market_listings').where('user_id', '==', session.userId).get())
        const batch = db.batch()
        listingsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        const appsSnap = await runWithTimeout(db.collection('market_applications').where('user_id', '==', session.userId).get())
        appsSnap.docs.forEach((doc: any) => {
          if (doc.data()?.status === 'pending') batch.delete(doc.ref)
        })

        const invitesSnap = await runWithTimeout(db.collection('team_invites').where('invited_user_id', '==', session.userId).get())
        invitesSnap.docs.forEach((doc: any) => {
          if (doc.data()?.status === 'pending' && doc.id !== inviteId) batch.delete(doc.ref)
        })

        await runWithTimeout(batch.commit())
        await cleanupDriverMarketDataOnTeamJoin(session.userId)
        revalidatePath('/market')
        revalidatePath('/equipos')
        return
      } catch (err) {
        console.error('Failed to accept invite in Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    let invitesVal = cookieStore.get('mock_market_invites')?.value
    let invites = invitesVal ? JSON.parse(invitesVal) : []
    const inviteIdx = invites.findIndex((i: any) => i.id === inviteId)
    if (inviteIdx === -1) throw new Error('Invite not found')

    const inviteData = invites[inviteIdx]
    if (inviteData.invitedUserId !== session.userId) throw new Error('Unauthorized')

    const teamsVal = cookieStore.get('mock_teams')?.value
    const teams = teamsVal ? JSON.parse(teamsVal) : []
    const teamIdx = teams.findIndex((t: any) => t.id === inviteData.teamId)

    if (teamIdx !== -1) {
      const team = teams[teamIdx]
      if (!team.members) team.members = []
      if (!team.members.some((m: any) => m.userId === session.userId)) {
        team.members.push({
          id: `member_${team.id}_${session.userId}`,
          teamId: team.id,
          userId: session.userId,
          role: 'driver',
          createdAt: new Date().toISOString(),
          displayName: session.steamDisplayName || 'Driver',
          steamId: session.userId.replace('steam_', ''),
        })
      }
      cookieStore.set('mock_teams', JSON.stringify(teams), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    }

    invites[inviteIdx].status = 'accepted'
    invites = invites.filter((i: any) => i.id === inviteId || !(i.invitedUserId === session.userId && i.status === 'pending'))
    cookieStore.set('mock_market_invites', JSON.stringify(invites), { path: '/', maxAge: 60 * 60 * 24 * 7 })

    const appsVal = cookieStore.get('mock_market_applications')?.value
    if (appsVal) {
      let apps = JSON.parse(appsVal)
      apps = apps.filter((a: any) => !(a.userId === session.userId && a.status === 'pending'))
      cookieStore.set('mock_market_applications', JSON.stringify(apps), { path: '/', maxAge: 60 * 60 * 24 * 7 })
    }

    const listingsVal = cookieStore.get('mock_market_listings')?.value
    if (listingsVal) {
      let listings = JSON.parse(listingsVal)
      listings = listings.filter((l: any) => l.user_id !== session.userId)
      cookieStore.set('mock_market_listings', JSON.stringify(listings), { path: '/', maxAge: 60 * 60 * 24 * 7 })
    }
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
  revalidatePath('/equipos')
}

export async function declineInviteFromMarketAction(inviteId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const inviteRef = db.collection('team_invites').doc(inviteId)
        const inviteDoc = await runWithTimeout(inviteRef.get())
        if (!inviteDoc.exists) throw new Error('Invite not found')
        const inviteData = inviteDoc.data()

        if (inviteData?.invited_user_id !== session.userId) {
          throw new Error('Not authorized')
        }

        await runWithTimeout(inviteRef.update({ status: 'rejected' }))
        revalidatePath('/market')
        return
      } catch (err) {
        console.error('Failed to decline invite in Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    const invitesVal = cookieStore.get('mock_market_invites')?.value
    const invites = invitesVal ? JSON.parse(invitesVal) : []
    const inviteIdx = invites.findIndex((i: any) => i.id === inviteId)
    if (inviteIdx !== -1) {
      invites[inviteIdx].status = 'rejected'
      cookieStore.set('mock_market_invites', JSON.stringify(invites), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
    }
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
}
