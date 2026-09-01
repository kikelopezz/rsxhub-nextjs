import { getPreferredNumbers, pickAssignedNumber, isNumberAvailable } from './league-number-management'

export function parseClassTag(leagueClassTags: string[] | undefined, rawClassTag: string) {
  const normalized = rawClassTag.trim().toUpperCase()
  if (!leagueClassTags || leagueClassTags.length === 0) return normalized || null
  if (!normalized) return null
  const allowed = new Set(leagueClassTags.map((item) => item.toUpperCase()))
  return allowed.has(normalized) ? normalized : null
}

export async function upsertLeagueRegistration({
  db,
  leagueId,
  userId,
  teamId,
  classTag,
  desiredNumber,
}: {
  db: any
  leagueId: string
  userId: string
  teamId: string | null
  classTag: string | null
  desiredNumber?: number | null
}) {
  const steamDoc = await db.collection('steam_accounts').doc(userId).get()
  const profileDoc = await db.collection('profiles').doc(userId).get()

  const steam = steamDoc.exists ? steamDoc.data() : { steam_id: userId, steam_display_name: 'Driver' }
  const profile = profileDoc.exists ? profileDoc.data() : null

  let assignedNumber: number | null = null
  if (typeof desiredNumber === 'number' && desiredNumber >= 0) {
    const available = await isNumberAvailable({ db, leagueId, classTag, number: desiredNumber, currentUserId: userId, teamId })
    if (!available) return { ok: false as const, reason: 'number-taken' as const }
    assignedNumber = desiredNumber
  } else {
    const preferences = await getPreferredNumbers({ db, userId, classTag })
    assignedNumber = await pickAssignedNumber({ db, leagueId, classTag, preferred: preferences })
  }
  const displayName = profile?.display_name || steam.steam_display_name || steam.steam_id

  const docId = teamId ? `${leagueId}_${userId}_${classTag || 'noclass'}` : `${leagueId}_${userId}`
  await db.collection('league_registrations').doc(docId).set({
    league_id: leagueId,
    user_id: userId,
    team_id: teamId,
    display_name: displayName,
    steam_id: steam.steam_id,
    status: 'pending',
    class_tag: classTag,
    assigned_number: assignedNumber,
    created_at: new Date(),
  }, { merge: true })

  return { ok: true as const, assignedNumber }
}