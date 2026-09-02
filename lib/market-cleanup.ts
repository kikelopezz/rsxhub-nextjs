import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'

/**
 * Automatically cleans up a driver's market listings, pending applications, and invites
 * whenever they join a team or become owner/leader of a new team.
 */
export async function cleanupDriverMarketDataOnTeamJoin(userId: string) {
  if (!userId) return

  invalidateCache(['teams_dashboard', 'market', 'platform_leagues'])

  try {
    await db.$transaction([
      db.marketListing.deleteMany({ where: { userId, type: 'driver_seeking_team' } }),
      db.marketApplication.deleteMany({ where: { userId, status: 'pending' } }),
      db.teamInvite.deleteMany({ where: { invitedUserId: userId, status: 'pending' } }),
    ])
  } catch (err) {
    console.error('Failed to cleanup driver market data for user:', userId, err)
  }
}
