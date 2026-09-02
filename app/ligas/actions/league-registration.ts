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

    carsToRegister.push({
      classTag: fallbackClassTag,
      carModel,
      carNumber: carNumberInput,
      driverUserIds: driverUserIds.length > 0 ? driverUserIds : [session.userId],
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
    status: 'pending'
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

    for (const info of driverInfos) {
      rowsToInsert.push({
        leagueId,
        userId: info.userId,
        teamId,
        displayName: info.displayName,
        status: 'pending',
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
