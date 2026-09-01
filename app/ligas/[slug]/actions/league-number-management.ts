export async function getPreferredNumbers({
  db,
  userId,
  classTag,
}: {
  db: any
  userId: string
  classTag: string | null
}) {
  const preferred: number[] = []

  if (classTag) {
    const snapshot = await db
      .collection('driver_number_preferences')
      .where('user_id', '==', userId)
      .where('class_tag', '==', classTag)
      .limit(1)
      .get()

    if (!snapshot.empty) {
      const data = snapshot.docs[0].data()
      const candidates = [data.number_1, data.number_2, data.number_3]
      for (const value of candidates) {
        if (typeof value === 'number' && value >= 0 && value <= 999 && !preferred.includes(value)) {
          preferred.push(value)
        }
      }
    }
  }

  const profileDoc = await db.collection('profiles').doc(userId).get()
  if (profileDoc.exists) {
    const fallback = profileDoc.data().racing_number
    if (typeof fallback === 'number' && fallback >= 0 && fallback <= 999 && !preferred.includes(fallback)) {
      preferred.push(fallback)
    }
  }

  return preferred
}

export async function pickAssignedNumber({
  db,
  leagueId,
  classTag,
  preferred,
}: {
  db: any
  leagueId: string
  classTag: string | null
  preferred: number[]
}) {
  let query = db.collection('league_registrations').where('league_id', '==', leagueId)
  if (classTag) query = query.where('class_tag', '==', classTag)
  const snapshot = await query.get()

  const used = new Set(
    snapshot.docs
      .map((doc: any) => doc.data().assigned_number)
      .filter((value: any): value is number => typeof value === 'number' && value >= 0),
  )

  for (const candidate of preferred) {
    if (!used.has(candidate)) return candidate
  }

  for (let number = 0; number <= 999; number += 1) {
    if (!used.has(number)) return number
  }

  return null
}

export async function isNumberAvailable({
  db,
  leagueId,
  classTag,
  number,
  currentUserId,
  teamId,
}: {
  db: any
  leagueId: string
  classTag: string | null
  number: number
  currentUserId: string
  teamId?: string | null
}) {
  let query = db
    .collection('league_registrations')
    .where('league_id', '==', leagueId)
    .where('assigned_number', '==', number)
  if (classTag) query = query.where('class_tag', '==', classTag)
  const snapshot = await query.get()

  const rows = snapshot.docs.map((doc: any) => doc.data())
  return !rows.some((row: any) => {
    if (row.user_id === currentUserId) return false
    if (teamId && row.team_id === teamId) return false
    return true
  })
}

export function parseDesiredNumber(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) return -1
  return parsed
}