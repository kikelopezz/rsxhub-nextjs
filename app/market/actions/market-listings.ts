'use server'

/**
 * app/market/actions/market-listings.ts
 *
 * Server actions for creating and deleting market listings.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { getTeamsDashboard } from '@/lib/team-data'

export async function createMarketListing(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const type = String(formData.get('type') || 'team_seeking_driver') as 'team_seeking_driver' | 'driver_seeking_team'
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const mainSim = String(formData.get('mainSim') || 'ac') as 'ac' | 'lmu'
  const classTag = String(formData.get('classTag') || 'ALL').trim().toUpperCase()
  const contactInfo = String(formData.get('contactInfo') || '').trim()
  const teamId = formData.get('teamId') ? String(formData.get('teamId')) : null

  if (!title || !description || !contactInfo) {
    throw new Error('Missing fields')
  }

  // Check if they are already in a team when seeking a team
  if (type === 'driver_seeking_team') {
    const dashboard = await getTeamsDashboard(session.userId)
    const isAlreadyInTeam = dashboard.teams.some((team: any) =>
      team.ownerUserId === session.userId ||
      (Array.isArray(team.members) && team.members.some((m: any) => m.userId === session.userId))
    )
    if (isAlreadyInTeam) {
      throw new Error('You cannot post a driver listing if you already belong to a team.')
    }
    const cleanContact = (contactInfo || '').trim()
    if (!cleanContact || cleanContact.length < 3) {
      throw new Error('Discord contact info is required for drivers looking for a team.')
    }
  }

  let userName = session.steamDisplayName || 'Driver'
  let userAvatar = session.avatarUrl || null
  let countryCode = 'ES'
  let teamName = ''
  let teamLogo = ''

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const userDoc = await runWithTimeout(db.collection('profiles').doc(session.userId).get())
        if (userDoc.exists) {
          userName = userDoc.data()?.display_name || userName
          userAvatar = userDoc.data()?.avatar_url || userAvatar
          countryCode = userDoc.data()?.country_code || 'ES'
        }

        if (type === 'team_seeking_driver' && teamId) {
          const teamDoc = await runWithTimeout(db.collection('teams').doc(teamId).get())
          if (teamDoc.exists) {
            teamName = teamDoc.data()?.name || ''
            teamLogo = teamDoc.data()?.logo_url || ''
          }

          // Delete any existing market listings for same team
          const oldSnap = await runWithTimeout(db.collection('market_listings')
            .where('team_id', '==', teamId)
            .get())
          if (!oldSnap.empty) {
            const deleteBatch = db.batch()
            let count = 0
            oldSnap.docs.forEach((doc: any) => {
              const d = doc.data()
              if (d.type === 'team_seeking_driver') {
                deleteBatch.delete(doc.ref)
                count++
              }
            })
            if (count > 0) {
              await runWithTimeout(deleteBatch.commit())
            }
          }
        } else if (type === 'driver_seeking_team') {
          // Delete any existing driver market listings for this user
          const oldSnap = await runWithTimeout(db.collection('market_listings')
            .where('user_id', '==', session.userId)
            .get())
          if (!oldSnap.empty) {
            const deleteBatch = db.batch()
            let count = 0
            oldSnap.docs.forEach((doc: any) => {
              const d = doc.data()
              if (d.type === 'driver_seeking_team') {
                deleteBatch.delete(doc.ref)
                count++
              }
            })
            if (count > 0) {
              await runWithTimeout(deleteBatch.commit())
            }
          }
        }

        const docRef = db.collection('market_listings').doc()
        await runWithTimeout(docRef.set({
          id: docRef.id,
          type,
          user_id: session.userId,
          user_name: userName,
          user_avatar: userAvatar,
          country_code: countryCode,
          team_id: teamId,
          team_name: teamName,
          team_logo: teamLogo,
          title,
          description,
          main_sim: mainSim,
          class_tag: classTag,
          contact_info: contactInfo,
          created_at: new Date(),
        }))

        revalidatePath('/market')
        return
      } catch (err) {
        console.error('Failed to create market listing in Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existing = cookieStore.get('mock_market_listings')?.value
    let listings = existing ? JSON.parse(existing) : []

    if (type === 'team_seeking_driver' && teamId) {
      teamName = `Mock Team ${teamId.slice(0, 4).toUpperCase()}`
      listings = listings.filter((l: any) => !(l.team_id === teamId && l.type === 'team_seeking_driver'))
    } else if (type === 'driver_seeking_team') {
      listings = listings.filter((l: any) => !(l.user_id === session.userId && l.type === 'driver_seeking_team'))
    }

    const newListing = {
      id: `mock_${Date.now()}`,
      type,
      user_id: session.userId,
      user_name: userName,
      user_avatar: userAvatar,
      team_id: teamId,
      team_name: teamName,
      team_logo: teamLogo,
      title,
      description,
      main_sim: mainSim,
      class_tag: classTag,
      contact_info: contactInfo,
      created_at: new Date().toISOString(),
    }

    listings.push(newListing)
    cookieStore.set('mock_market_listings', JSON.stringify(listings), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
}

export async function deleteMarketListing(listingId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const doc = await runWithTimeout(db.collection('market_listings').doc(listingId).get())
        if (doc.exists && doc.data()?.user_id === session.userId) {
          await runWithTimeout(doc.ref.delete())
        }
        revalidatePath('/market')
        return
      } catch (err) {
        console.error('Failed to delete market listing from Firestore:', err)
        throw err
      }
    }
  }

  if (hasFirebase) return

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existing = cookieStore.get('mock_market_listings')?.value
    if (existing) {
      let listings = JSON.parse(existing)
      listings = listings.filter((item: any) => !(item.id === listingId && item.user_id === session.userId))
      cookieStore.set('mock_market_listings', JSON.stringify(listings), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
    }
  } catch (e) {
    console.error(e)
  }

  revalidatePath('/market')
}
