import { db } from '@/lib/db'
import { getPreferredNumbers, pickAssignedNumber, isNumberAvailable } from './league-number-management'

export function parseClassTag(leagueClassTags: string[] | undefined, rawClassTag: string) {
  const normalized = rawClassTag.trim().toUpperCase()
  if (!leagueClassTags || leagueClassTags.length === 0) return normalized || null
  if (!normalized) return null
  const allowed = new Set(leagueClassTags.map((item) => item.toUpperCase()))
  return allowed.has(normalized) ? normalized : null
}

export async function upsertLeagueRegistration({
  leagueId,
  userId,
  teamId,
  classTag,
  desiredNumber,
}: {
  leagueId: string
  userId: string
  teamId: string | null
  classTag: string | null
  desiredNumber?: number | null
}) {
  const [steam, profile] = await Promise.all([
    db.steamAccount.findUnique({ where: { userId } }),
    db.profile.findUnique({ where: { userId } }),
  ])

  let assignedNumber: number | null = null
  if (typeof desiredNumber === 'number' && desiredNumber >= 0) {
    const available = await isNumberAvailable({ leagueId, classTag, number: desiredNumber, currentUserId: userId, teamId })
    if (!available) return { ok: false as const, reason: 'number-taken' as const }
    assignedNumber = desiredNumber
  } else {
    const preferences = await getPreferredNumbers({ userId, classTag })
    assignedNumber = await pickAssignedNumber({ leagueId, classTag, preferred: preferences })
  }
  const displayName = profile?.displayName || steam?.steamDisplayName || steam?.steamId || userId

  // One active registration per (league, user, class) — replaces any prior
  // row for that key, mirroring the old deterministic-doc-id "set merge" write.
  await db.leagueRegistration.deleteMany({ where: { leagueId, userId, classTag } })
  await db.leagueRegistration.create({
    data: {
      leagueId,
      userId,
      teamId,
      displayName,
      steamId: steam?.steamId || userId,
      status: 'pending',
      classTag,
      assignedNumber,
    },
  })

  return { ok: true as const, assignedNumber }
}
