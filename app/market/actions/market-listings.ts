'use server'

/**
 * app/market/actions/market-listings.ts
 *
 * Server actions for creating and deleting market listings.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { db } from '@/lib/db'
import { userBelongsToTeam } from '@/lib/team-data'

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
  const leagueId = formData.get('leagueId') ? String(formData.get('leagueId')) : null

  if (!title || !description || !contactInfo) {
    throw new Error('Missing fields')
  }

  if (type === 'driver_seeking_team') {
    if (await userBelongsToTeam(session.userId)) {
      throw new Error('You cannot post a driver listing if you already belong to a team.')
    }
    if (contactInfo.trim().length < 3) {
      throw new Error('Discord contact info is required for drivers looking for a team.')
    }
  }

  const profile = await db.profile.findUnique({ where: { userId: session.userId } })
  const userName = profile?.displayName || session.steamDisplayName || 'Driver'
  const userAvatar = profile?.avatarUrl || session.avatarUrl || null
  const countryCode = profile?.countryCode || 'ES'
  let teamName = ''
  let teamLogo = ''
  let leagueTitle = ''

  if (leagueId) {
    const league = await db.league.findUnique({ where: { id: leagueId }, select: { title: true } })
    leagueTitle = league?.title || ''
  }

  if (type === 'team_seeking_driver' && teamId) {
    const team = await db.team.findUnique({ where: { id: teamId } })
    teamName = team?.name || ''
    teamLogo = team?.logoUrl || ''
    await db.marketListing.deleteMany({ where: { teamId, type: 'team_seeking_driver' } })
  } else if (type === 'driver_seeking_team') {
    await db.marketListing.deleteMany({ where: { userId: session.userId, type: 'driver_seeking_team' } })
  }

  await db.marketListing.create({
    data: {
      type,
      userId: session.userId,
      userName,
      userAvatar,
      countryCode,
      teamId,
      teamName,
      teamLogo,
      leagueId,
      leagueTitle: leagueTitle || null,
      title,
      description,
      mainSim,
      classTag,
      contactInfo,
    },
  })

  revalidatePath('/market')
}

export async function deleteMarketListing(listingId: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  const where = access.canAccessPlatformAdmin ? { id: listingId } : { id: listingId, userId: session.userId }

  await db.marketListing.deleteMany({ where })

  revalidatePath('/market')
}
