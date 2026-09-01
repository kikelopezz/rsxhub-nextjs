import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { invalidateCache } from '@/lib/ttl-cache'
import { cookies } from 'next/headers'

/**
 * Automatically cleans up a driver's market listings, pending applications, and invites
 * whenever they join a team or become owner/leader of a new team.
 */
export async function cleanupDriverMarketDataOnTeamJoin(userId: string) {
  if (!userId) return

  // 1. Invalidate platform caches
  invalidateCache(['teams_dashboard', 'market', 'platform_leagues'])

  // 2. Firestore cleanup
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        // A. Delete driver's market listings (type: 'driver_seeking_team')
        const listingsSnap = await runWithTimeout(
          db.collection('market_listings')
            .where('user_id', '==', userId)
            .get(),
          3000
        )
        if (!listingsSnap.empty) {
          const deleteBatch = db.batch()
          let count = 0
          listingsSnap.docs.forEach((doc: any) => {
            const d = doc.data()
            if (d.type === 'driver_seeking_team' || d.type === 'driver_application') {
              deleteBatch.delete(doc.ref)
              count++
            }
          })
          if (count > 0) {
            await runWithTimeout(deleteBatch.commit(), 3000)
          }
        }

        // B. Delete/Reject all pending applications sent by this driver to other teams
        const appsSnap = await runWithTimeout(
          db.collection('market_applications')
            .where('user_id', '==', userId)
            .get(),
          3000
        )
        if (!appsSnap.empty) {
          const deleteBatch = db.batch()
          let count = 0
          appsSnap.docs.forEach((doc: any) => {
            const d = doc.data()
            if (d.status === 'pending') {
              deleteBatch.delete(doc.ref)
              count++
            }
          })
          if (count > 0) {
            await runWithTimeout(deleteBatch.commit(), 3000)
          }
        }

        // C. Delete/Decline all pending market invites sent to this driver
        const invitesSnap = await runWithTimeout(
          db.collection('market_invites')
            .where('driver_user_id', '==', userId)
            .get(),
          3000
        )
        if (!invitesSnap.empty) {
          const deleteBatch = db.batch()
          let count = 0
          invitesSnap.docs.forEach((doc: any) => {
            const d = doc.data()
            if (d.status === 'pending') {
              deleteBatch.delete(doc.ref)
              count++
            }
          })
          if (count > 0) {
            await runWithTimeout(deleteBatch.commit(), 3000)
          }
        }
      } catch (err) {
        console.error('Failed to cleanup driver market data in Firestore for user:', userId, err)
      }
    }
  }

  // 3. Fallback / Mock mode cleanup in cookies
  try {
    const cookieStore = await cookies()

    // Mock Listings
    const mockListingsVal = cookieStore.get('mock_market_listings')?.value
    if (mockListingsVal) {
      const mockListings = JSON.parse(mockListingsVal)
      if (Array.isArray(mockListings)) {
        const filtered = mockListings.filter((l: any) => !(l.user_id === userId && l.type === 'driver_seeking_team'))
        cookieStore.set('mock_market_listings', JSON.stringify(filtered), { path: '/' })
      }
    }

    // Mock Applications
    const mockAppsVal = cookieStore.get('mock_market_applications')?.value
    if (mockAppsVal) {
      const mockApps = JSON.parse(mockAppsVal)
      if (Array.isArray(mockApps)) {
        const filtered = mockApps.filter((a: any) => !(a.userId === userId && a.status === 'pending'))
        cookieStore.set('mock_market_applications', JSON.stringify(filtered), { path: '/' })
      }
    }
  } catch (err) {
    console.error('Failed mock market cleanup:', err)
  }
}
