'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getRegistrations, getLeagueBySlug } from '@/lib/platform-data'
import { invalidateCache } from '@/lib/ttl-cache'

function parseCarNumber(dorsal: any): number {
  if (dorsal == null) return 0
  const str = String(dorsal).replace(/[^0-9]/g, '')
  const num = parseInt(str, 10)
  return isNaN(num) ? 0 : num
}

export async function registerTeamAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  let slug = String(formData.get('slug') || '')
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const inputClassTag = String(formData.get('classTag') || '').trim().toUpperCase()
  const carModel = String(formData.get('carModel') || '')
  const carNumberInput = parseCarNumber(formData.get('carNumber'))
  const driverUserIds = formData.getAll('driverUserIds').map(String)

  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required.')
  }

  const league = await db.league.findUnique({ where: { id: leagueId }, select: { slug: true, classTags: true } })
  const leagueClassTags = league?.classTags || []
  if (!slug) slug = league?.slug || leagueId

  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { cars: { include: { drivers: true } } },
  })

  if (!team) throw new Error('Team not found.')

  // A brand-new team starts as "pending" until a platform admin approves it — it can't
  // register for a championship until then.
  if (team.status !== 'approved') {
    throw new Error(
      team.status === 'rejected'
        ? 'This team has been rejected and cannot register for championships.'
        : 'This team is still pending admin approval and cannot register for championships yet.'
    )
  }

  // Find all cars in the team's workshop that match the league's classTags
  const matchingCars = (team?.cars || []).filter((car) => {
    if (!car.category) return false
    const c1 = car.category.toUpperCase()
    if (car.leagueId && car.leagueId !== leagueId) return false
    return leagueClassTags.some((tag) => {
      const c2 = tag.toUpperCase()
      return c1 === c2 || (c1.startsWith('LMP') && c2.startsWith('LMP'))
    })
  })

  type CarToRegister = {
    classTag: string
    carModel: string
    carNumber: number
    driverUserIds: string[]
  }

  const carsToRegister: CarToRegister[] = []

  if (matchingCars.length > 0) {
    for (const car of matchingCars) {
      const carClassTag = car.category.toUpperCase()
      const carNum = parseCarNumber(car.dorsal)
      const carMod = car.modelName || ''

      const leagueDrivers = car.drivers.filter((d) => d.leagueId === leagueId).map((d) => d.userId)
      const defaultDrivers = car.drivers.filter((d) => !d.leagueId).map((d) => d.userId)
      let carDrivers = leagueDrivers.length > 0 ? leagueDrivers : defaultDrivers

      if (carDrivers.length === 0) {
        carDrivers = driverUserIds.length > 0 ? driverUserIds : [session.userId]
      }

      carsToRegister.push({ classTag: carClassTag, carModel: carMod, carNumber: carNum, driverUserIds: carDrivers })
    }
  } else {
    // Fallback: register the single selected class from the form
    let fallbackClassTag = inputClassTag
    if (!fallbackClassTag || fallbackClassTag === 'GENERAL' || !leagueClassTags.map((t) => t.toUpperCase()).includes(fallbackClassTag)) {
      fallbackClassTag = (leagueClassTags[0] || 'GT3').toUpperCase()
    }

    // No car of the team's is bound to *this* league yet (its GT3/HYPERCAR car
    // lives on whichever league it first registered for) — but the team may
    // already run this same category elsewhere. Reuse that car's default roster
    // so every driver already racing this class for the team gets entered here
    // too, instead of only whoever clicked "Register team".
    const templateCar = (team?.cars || []).find((c) => c.category.toUpperCase() === fallbackClassTag)
    const templateDrivers = templateCar
      ? templateCar.drivers.filter((d) => !d.leagueId).map((d) => d.userId)
      : []

    carsToRegister.push({
      classTag: fallbackClassTag,
      carModel: carModel || templateCar?.modelName || '',
      carNumber: carNumberInput,
      driverUserIds: driverUserIds.length > 0 ? driverUserIds : templateDrivers.length > 0 ? templateDrivers : [session.userId],
    })
  }

  // Get current registrations to check for taken numbers
  const registrations = await getRegistrations(leagueId)

  function resolveFreeNumber(classTag: string, preferred: number): number {
    const isTaken = (num: number) =>
      registrations.some((r) => r.classTag === classTag && r.assignedNumber === num && r.status !== 'rejected')
    if (preferred > 0 && !isTaken(preferred)) return preferred
    for (let num = 12; num <= 99; num++) {
      if (!isTaken(num)) return num
    }
    return preferred > 0 ? preferred : 12
  }

  const rowsToInsert: {
    leagueId: string
    userId: string
    teamId: string
    displayName: string
    status: 'approved'
    classTag: string
    assignedNumber: number
  }[] = []

  for (const carToReg of carsToRegister) {
    const driverInfos = await Promise.all(
      carToReg.driverUserIds.map(async (userId) => {
        let displayName = `Pilot ${userId.slice(0, 4)}`
        try {
          const profile = await db.profile.findUnique({ where: { userId } })
          if (profile) {
            displayName = profile.displayName || displayName
          } else {
            const steam = await db.steamAccount.findUnique({ where: { userId } })
            if (steam) displayName = steam.steamDisplayName || displayName
          }
        } catch (e) {
          console.error('Failed to resolve display name for driver registration:', e)
        }
        return { userId, displayName }
      })
    )

    const regCarNumber = resolveFreeNumber(carToReg.classTag, carToReg.carNumber)

    // getRegistrations() only shows a registration once it finds a TeamCar with a
    // matching category+dorsal bound to this league (or unbound) — it's how stale
    // rows get hidden after a car's number changes elsewhere. A team's cars are
    // normally bound to whichever league they were first registered for, so this
    // team joining a *second* league with no car of its own here yet would create
    // a registration with no matching car, and getRegistrations would silently
    // drop it everywhere (it'd show as "approved" in the DB but invisible in the UI).
    // Make sure this league always has its own bound car to match against.
    const existingLeagueCar = (team?.cars || []).find(
      (c) => c.leagueId === leagueId && c.category.toUpperCase() === carToReg.classTag.toUpperCase()
    )
    if (existingLeagueCar) {
      if (existingLeagueCar.dorsal !== String(regCarNumber)) {
        await db.teamCar.update({ where: { id: existingLeagueCar.id }, data: { dorsal: String(regCarNumber) } })
      }
    } else {
      await db.teamCar.create({
        data: {
          teamId,
          category: carToReg.classTag,
          dorsal: String(regCarNumber),
          modelName: carToReg.carModel || null,
          leagueId,
        },
      })
    }

    for (const info of driverInfos) {
      rowsToInsert.push({
        leagueId,
        userId: info.userId,
        teamId,
        displayName: info.displayName,
        status: 'approved',
        classTag: carToReg.classTag,
        assignedNumber: regCarNumber,
      })
    }
  }

  await db.$transaction([
    db.leagueRegistration.deleteMany({ where: { leagueId, teamId } }),
    db.leagueRegistration.createMany({ data: rowsToInsert }),
  ])

  invalidateCache(['teams_dashboard', 'platform_leagues', 'leagues', 'registrations_', 'event_confirmations_'])
  revalidatePath('/ligas')
  if (slug) revalidatePath(`/ligas/${slug}`)
  revalidatePath('/equipos')
}

export async function unregisterTeamAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  let slug = String(formData.get('slug') || '')
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTag = String(formData.get('classTag') || '')

  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required.')
  }

  if (!slug) {
    const league = await db.league.findUnique({ where: { id: leagueId }, select: { slug: true } })
    slug = league?.slug || ''
  }

  await db.leagueRegistration.deleteMany({
    where: {
      leagueId,
      teamId,
      ...(classTag ? { classTag: { equals: classTag, mode: 'insensitive' } } : {}),
    },
  })

  invalidateCache(['teams_dashboard', 'registrations_', 'event_confirmations_'])
  revalidatePath('/ligas')
  if (slug) revalidatePath(`/ligas/${slug}`)
  revalidatePath('/equipos')
}
