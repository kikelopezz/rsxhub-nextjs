import { db } from '@/lib/db'

export async function getPreferredNumbers({
  userId,
  classTag,
}: {
  userId: string
  classTag: string | null
}) {
  const preferred: number[] = []

  if (classTag) {
    const rows = await db.driverNumberPreference.findMany({
      where: { userId, classTag },
      orderBy: { priority: 'asc' },
    })
    for (const row of rows) {
      if (row.number >= 0 && row.number <= 999 && !preferred.includes(row.number)) {
        preferred.push(row.number)
      }
    }
  }

  const profile = await db.profile.findUnique({ where: { userId } })
  const fallback = profile?.racingNumber
  if (typeof fallback === 'number' && fallback >= 0 && fallback <= 999 && !preferred.includes(fallback)) {
    preferred.push(fallback)
  }

  return preferred
}

export async function pickAssignedNumber({
  leagueId,
  classTag,
  preferred,
}: {
  leagueId: string
  classTag: string | null
  preferred: number[]
}) {
  const rows = await db.leagueRegistration.findMany({
    where: { leagueId, ...(classTag ? { classTag } : {}) },
    select: { assignedNumber: true },
  })

  const used = new Set(rows.map((r) => r.assignedNumber).filter((v): v is number => typeof v === 'number' && v >= 0))

  for (const candidate of preferred) {
    if (!used.has(candidate)) return candidate
  }

  for (let number = 0; number <= 999; number += 1) {
    if (!used.has(number)) return number
  }

  return null
}

export async function isNumberAvailable({
  leagueId,
  classTag,
  number,
  currentUserId,
  teamId,
}: {
  leagueId: string
  classTag: string | null
  number: number
  currentUserId: string
  teamId?: string | null
}) {
  const rows = await db.leagueRegistration.findMany({
    where: { leagueId, assignedNumber: number, ...(classTag ? { classTag } : {}) },
  })

  return !rows.some((row) => {
    if (row.userId === currentUserId) return false
    if (teamId && row.teamId === teamId) return false
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
