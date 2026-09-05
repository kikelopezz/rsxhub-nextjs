'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { guardPlatformAdmin } from './admin-league'

export type MergeCandidateUser = {
  userId: string
  steamId: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
}

// Search by SteamID or display name so an admin can find the two rows behind a duplicate
// profile (same person, two different Steam logins) before merging them.
export async function searchUsersForMergeAction(query: string): Promise<MergeCandidateUser[]> {
  await guardPlatformAdmin()

  const q = query.trim()
  if (q.length < 2) return []

  const accounts = await db.steamAccount.findMany({
    where: {
      OR: [
        { steamId: { contains: q } },
        { steamDisplayName: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 15,
    orderBy: { steamDisplayName: 'asc' },
  })
  if (accounts.length === 0) return []

  const userIds = accounts.map((a) => a.userId)
  const profiles = await db.profile.findMany({ where: { userId: { in: userIds } } })
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]))

  return accounts.map((a) => {
    const profile = profileByUser.get(a.userId)
    return {
      userId: a.userId,
      steamId: a.steamId,
      displayName: profile?.displayName || a.steamDisplayName,
      avatarUrl: profile?.avatarUrl || a.steamAvatarUrl || null,
      createdAt: a.createdAt.toISOString(),
    }
  })
}

// Reassigns every relation that carries a plain `userId` (or similar) field from
// `fromUserId` (the duplicate) to `toUserId` (the account to keep), then deletes the
// duplicate — its SteamAccount/Profile go with it via cascade. Tables with a unique
// constraint that includes userId need per-row conflict handling: if `toUserId` already
// has a row with that same unique key, the duplicate's row is dropped instead of moved
// (it would just be a second copy of something the primary account already has).
export async function mergeUserAccountsAction(formData: FormData) {
  await guardPlatformAdmin()

  const fromUserId = String(formData.get('fromUserId') || '').trim()
  const toUserId = String(formData.get('toUserId') || '').trim()

  if (!fromUserId || !toUserId) throw new Error('Missing fromUserId/toUserId.')
  if (fromUserId === toUserId) throw new Error('Cannot merge a user into itself.')

  const [fromUser, toUser] = await Promise.all([
    db.user.findUnique({ where: { id: fromUserId } }),
    db.user.findUnique({ where: { id: toUserId } }),
  ])
  if (!fromUser) throw new Error('Duplicate account not found.')
  if (!toUser) throw new Error('Primary account not found.')

  await db.$transaction(async (tx) => {
    // --- Unique-constrained relations: reassign, or drop the duplicate's row if the
    // primary account already has one occupying that same unique slot. ---

    const platformRoles = await tx.platformRole.findMany({ where: { userId: fromUserId } })
    for (const row of platformRoles) {
      const exists = await tx.platformRole.findFirst({ where: { userId: toUserId, role: row.role } })
      if (exists) await tx.platformRole.delete({ where: { id: row.id } })
      else await tx.platformRole.update({ where: { id: row.id }, data: { userId: toUserId } })
    }

    const leagueMembers = await tx.leagueMember.findMany({ where: { userId: fromUserId } })
    for (const row of leagueMembers) {
      const exists = await tx.leagueMember.findFirst({ where: { userId: toUserId, leagueId: row.leagueId } })
      if (exists) await tx.leagueMember.delete({ where: { id: row.id } })
      else await tx.leagueMember.update({ where: { id: row.id }, data: { userId: toUserId } })
    }

    const teamMembers = await tx.teamMember.findMany({ where: { userId: fromUserId } })
    for (const row of teamMembers) {
      const exists = await tx.teamMember.findFirst({ where: { userId: toUserId, teamId: row.teamId } })
      if (exists) await tx.teamMember.delete({ where: { id: row.id } })
      else await tx.teamMember.update({ where: { id: row.id }, data: { userId: toUserId } })
    }

    const carDrivers = await tx.teamCarDriver.findMany({ where: { userId: fromUserId } })
    for (const row of carDrivers) {
      const exists = await tx.teamCarDriver.findFirst({
        where: { userId: toUserId, carId: row.carId, leagueId: row.leagueId, isReserve: row.isReserve },
      })
      if (exists) await tx.teamCarDriver.delete({ where: { id: row.id } })
      else await tx.teamCarDriver.update({ where: { id: row.id }, data: { userId: toUserId } })
    }

    const regDrivers = await tx.leagueTeamRegistrationDriver.findMany({ where: { userId: fromUserId } })
    for (const row of regDrivers) {
      const exists = await tx.leagueTeamRegistrationDriver.findFirst({
        where: { userId: toUserId, teamRegistrationId: row.teamRegistrationId },
      })
      if (exists) await tx.leagueTeamRegistrationDriver.delete({ where: { id: row.id } })
      else await tx.leagueTeamRegistrationDriver.update({ where: { id: row.id }, data: { userId: toUserId } })
    }

    const confirmationDrivers = await tx.eventConfirmationDriver.findMany({ where: { userId: fromUserId } })
    for (const row of confirmationDrivers) {
      const exists = await tx.eventConfirmationDriver.findFirst({
        where: { userId: toUserId, confirmationId: row.confirmationId },
      })
      if (exists) await tx.eventConfirmationDriver.delete({ where: { id: row.id } })
      else await tx.eventConfirmationDriver.update({ where: { id: row.id }, data: { userId: toUserId } })
    }

    const numberPrefs = await tx.driverNumberPreference.findMany({ where: { userId: fromUserId } })
    for (const row of numberPrefs) {
      const exists = await tx.driverNumberPreference.findFirst({
        where: { userId: toUserId, classTag: row.classTag, priority: row.priority },
      })
      if (exists) await tx.driverNumberPreference.delete({ where: { id: row.id } })
      else await tx.driverNumberPreference.update({ where: { id: row.id }, data: { userId: toUserId } })
    }

    // --- Plain reference fields: no unique constraint on userId alone, safe to move in bulk. ---

    await tx.leagueRegistration.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } })
    await tx.leagueResult.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } })
    await tx.leagueResultImport.updateMany({ where: { uploadedByUserId: fromUserId }, data: { uploadedByUserId: toUserId } })
    await tx.team.updateMany({ where: { ownerUserId: fromUserId }, data: { ownerUserId: toUserId } })
    await tx.teamInvite.updateMany({ where: { invitedByUserId: fromUserId }, data: { invitedByUserId: toUserId } })
    await tx.teamInvite.updateMany({ where: { invitedUserId: fromUserId }, data: { invitedUserId: toUserId } })
    await tx.marketListing.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } })
    await tx.marketApplication.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } })
    await tx.userNotification.updateMany({ where: { userId: fromUserId }, data: { userId: toUserId } })
    await tx.lineupChangeLog.updateMany({ where: { changedById: fromUserId }, data: { changedById: toUserId } })

    // Everything worth keeping now points at `toUserId`. Deleting the duplicate cascades
    // its SteamAccount and Profile away — that Steam login no longer resolves to a
    // separate identity.
    await tx.user.delete({ where: { id: fromUserId } })
  })

  revalidatePath('/admin')
}
