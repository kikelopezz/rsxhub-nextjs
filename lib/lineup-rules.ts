import { db } from '@/lib/db'
export { carLineupKey } from './car-key'

export const MAX_LINEUP_CHANGES_PER_DAY = 3

/** Locked starting at 00:00 UTC of the event's qualifying day (or race day, if it has no qualy). */
export function isLineupLockedForRace(
  event: { startsAt: Date; qualyStartsAt: Date | null; hasQualy: boolean },
  now: Date = new Date()
): boolean {
  const referenceDate = event.hasQualy && event.qualyStartsAt ? event.qualyStartsAt : event.startsAt
  const lockDayStart = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()))
  return now.getTime() >= lockDayStart.getTime()
}

/** The soonest upcoming event for a league, or null if none scheduled. */
export async function getNextLeagueEvent(leagueId: string, now: Date = new Date()) {
  return db.leagueEvent.findFirst({
    where: { leagueId, startsAt: { gte: now } },
    orderBy: { startsAt: 'asc' },
  })
}

export async function countLineupChangesToday(carKey: string, now: Date = new Date()): Promise<number> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return db.lineupChangeLog.count({
    where: { carId: carKey, changedAt: { gte: startOfDay } },
  })
}

export function sameDriverSet(a: string[], b: string[]): boolean {
  const sa = Array.from(new Set(a)).sort()
  const sb = Array.from(new Set(b)).sort()
  if (sa.length !== sb.length) return false
  return sa.every((v, i) => v === sb[i])
}
