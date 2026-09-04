'use server'

/**
 * Auto-syncs league_registrations when a team's car list is saved: for every
 * league the team's cars reference (explicitly, or by matching class), it
 * replaces that league's registrations for this team with one row per
 * assigned driver — mirroring what registerTeamAction does, but triggered
 * from the team-editor save instead of an explicit "register" action.
 */

import { db } from '@/lib/db'

export async function syncLeagueRegistrations(teamId: string): Promise<string[]> {
  const syncedLeagueSlugs: string[] = []

  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { cars: { include: { drivers: true } }, members: true },
  })
  if (!team) return syncedLeagueSlugs

  const existingRegLeagueIds = (await db.leagueRegistration.findMany({ where: { teamId }, select: { leagueId: true } })).map(
    (r) => r.leagueId,
  )
  const carLeagueIds = team.cars.map((c) => c.leagueId).filter((id): id is string => Boolean(id))
  const targetLeagueIds = Array.from(new Set([...existingRegLeagueIds, ...carLeagueIds, team.leagueId].filter((id): id is string => Boolean(id))))

  for (const leagueIdOrSlug of targetLeagueIds) {
    const league = await db.league.findFirst({ where: { OR: [{ id: leagueIdOrSlug }, { slug: leagueIdOrSlug }] } })
    if (!league) continue

    const leagueClassTags = league.classTags || []
    const matchingCars = team.cars.filter((car) => {
      const c1 = car.category.toUpperCase()
      const isExplicitLeague = Boolean(car.leagueId && (car.leagueId === league.id || car.leagueId === league.slug))
      if (car.leagueId && !isExplicitLeague) return false
      return (
        isExplicitLeague ||
        leagueClassTags.length === 0 ||
        leagueClassTags.some((tag) => {
          const c2 = tag.toUpperCase()
          return c1 === c2 || (c1.startsWith('LMP') && c2.startsWith('LMP'))
        })
      )
    })

    if (matchingCars.length === 0) continue

    const otherRegs = await db.leagueRegistration.findMany({
      where: { leagueId: league.id, teamId: { not: teamId } },
    })

    const registrationsInThisLeague: { userId: string; displayName: string; classTag: string; assignedNumber: number }[] = []

    for (const car of matchingCars) {
      const carClassTag = car.category.toUpperCase()
      const carDorsal = car.dorsal.trim()

      const isTaken = (num: number) =>
        otherRegs.some((r) => r.classTag === carClassTag && r.assignedNumber === num && r.status !== 'rejected')

      let regCarNumber = carDorsal ? Number(carDorsal) : NaN
      if (!Number.isFinite(regCarNumber) || isTaken(regCarNumber)) {
        regCarNumber = 12
        while (isTaken(regCarNumber) && regCarNumber <= 99) regCarNumber++
      }

      const leagueDrivers = car.drivers.filter((d) => d.leagueId === league.id || d.leagueId === league.slug).map((d) => d.userId)
      const defaultDrivers = car.drivers.filter((d) => !d.leagueId).map((d) => d.userId)
      const carDrivers = leagueDrivers.length > 0 ? leagueDrivers : defaultDrivers

      if (carDrivers.length === 0) {
        // No drivers assigned to this car anymore — drop any event confirmations for it.
        await db.leagueEventConfirmation.deleteMany({
          where: { teamId, classTag: carClassTag, carNumber: Number.isFinite(regCarNumber) ? regCarNumber : undefined },
        })
      } else {
        for (const userId of carDrivers) {
          const member = team.members.find((m) => m.userId === userId)
          const displayName = member?.displayName || `Pilot ${userId.slice(0, 4)}`
          registrationsInThisLeague.push({ userId, displayName, classTag: carClassTag, assignedNumber: regCarNumber })
        }
      }
    }

    await db.$transaction([
      db.leagueRegistration.deleteMany({ where: { leagueId: league.id, teamId } }),
      db.leagueRegistration.createMany({
        data: registrationsInThisLeague.map((r) => ({
          leagueId: league.id,
          userId: r.userId,
          teamId,
          displayName: r.displayName,
          status: 'approved',
          classTag: r.classTag,
          assignedNumber: r.assignedNumber,
        })),
      }),
    ])
    syncedLeagueSlugs.push(league.slug)
  }

  return syncedLeagueSlugs
}
