'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getLeagueBySlug } from '@/lib/platform-data'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'

import {
  getPreferredNumbers as _getPreferredNumbers,
  pickAssignedNumber as _pickAssignedNumber,
  isNumberAvailable as _isNumberAvailable,
  parseDesiredNumber,
} from './actions/league-number-management'
import {
  upsertLeagueRegistration as _upsertLeagueRegistration,
  parseClassTag,
} from './actions/league-registration-upsert'

export async function getPreferredNumbers(params: Parameters<typeof _getPreferredNumbers>[0]) {
  return _getPreferredNumbers(params)
}

export async function pickAssignedNumber(params: Parameters<typeof _pickAssignedNumber>[0]) {
  return _pickAssignedNumber(params)
}

export async function isNumberAvailable(params: Parameters<typeof _isNumberAvailable>[0]) {
  return _isNumberAvailable(params)
}

export async function upsertLeagueRegistration(params: Parameters<typeof _upsertLeagueRegistration>[0]) {
  return _upsertLeagueRegistration(params)
}

export async function registerForLeague(formData: FormData) {
  const slug = String(formData.get('slug') || '')
  const league = await getLeagueBySlug(slug)
  const session = await getCurrentUser()

  if (!league) redirect('/ligas')
  if (!session) redirect(`/ligas/${slug}?register=login`)
  if (!league.registrationOpen || league.status !== 'open') redirect(`/ligas/${slug}?register=closed`)

  const mode = String(formData.get('registrationMode') || 'driver').toLowerCase()
  const registrationMode = league.registrationMode || 'individual'
  const classTag = parseClassTag(league.classTags, String(formData.get('classTag') || ''))
  if (league.classTags && league.classTags.length > 0 && !classTag) redirect(`/ligas/${slug}?register=class-required`)

  if (registrationMode === 'team' && mode !== 'team') redirect(`/ligas/${slug}?register=team-only`)
  if (registrationMode === 'individual' && mode === 'team') redirect(`/ligas/${slug}?register=individual-only`)

  if (mode === 'team') {
    const teamId = String(formData.get('teamId') || '').trim()
    const carModel = String(formData.get('carModel') || '').trim()
    const parsedCarNumber = parseDesiredNumber(formData.get('carNumber'))
    const selectedDrivers = formData
      .getAll('driverUserIds')
      .map((value) => String(value).trim())
      .filter(Boolean)
    if (parsedCarNumber === -1) redirect(`/ligas/${slug}?register=number-invalid`)

    if (!teamId) redirect(`/ligas/${slug}?register=team-data-required`)

    try {
      const team = await db.team.findUnique({
        where: { id: teamId },
        include: { cars: { include: { drivers: true } }, members: true },
      })
      const managerRow = team?.members.find((m) => m.userId === session.userId)

      const canManage = team?.ownerUserId === session.userId || managerRow?.role === 'owner' || managerRow?.role === 'manager'
      if (!canManage) redirect(`/ligas/${slug}?register=forbidden`)

      const memberUserIds = new Set(team!.members.map((m) => m.userId))

      const allowedCars = await db.leagueCar.findMany({ where: { leagueId: league.id, isActive: true } })

      const leagueClassTags = league.classTags || []
      const teamCars = team!.cars

      type CategoryToRegister = { classTag: string; carNumber: number; carModel: string | null; driverUserIds: string[] }
      const categoriesToRegister: CategoryToRegister[] = []

      const matchingCars = teamCars.filter((car) => {
        const c1 = car.category.toUpperCase()
        return leagueClassTags.some((tag) => {
          const c2 = tag.toUpperCase()
          return c1 === c2 || (c1.startsWith('LMP') && c2.startsWith('LMP'))
        })
      })

      if (matchingCars.length > 0) {
        for (const car of matchingCars) {
          const catUpper = car.category.toUpperCase()
          const matchedLeagueClass =
            leagueClassTags.find((tag) => {
              const t = tag.toUpperCase()
              return t === catUpper || (t.startsWith('LMP') && catUpper.startsWith('LMP'))
            }) || catUpper
          const allowedForCategory = allowedCars.find((ac) => {
            const classUpper = ac.classTag?.toUpperCase()
            return classUpper === catUpper || (classUpper?.startsWith('LMP') && catUpper.startsWith('LMP'))
          })
          const matchedModel = allowedForCategory ? allowedForCategory.model : carModel || null

          const leagueDrivers = car.drivers.filter((d) => d.leagueId === league.id || d.leagueId === league.slug).map((d) => d.userId)
          const defaultDrivers = car.drivers.filter((d) => !d.leagueId).map((d) => d.userId)
          const carDriversRaw = leagueDrivers.length > 0 ? leagueDrivers : defaultDrivers
          const carDrivers = carDriversRaw.filter((id) => memberUserIds.has(id))

          const finalDrivers = carDrivers.length > 0 ? carDrivers : Array.from(memberUserIds)

          if (finalDrivers.length > 0) {
            categoriesToRegister.push({
              classTag: matchedLeagueClass,
              carNumber: Number(car.dorsal || parsedCarNumber || '12'),
              carModel: matchedModel,
              driverUserIds: finalDrivers,
            })
          }
        }
      }

      if (categoriesToRegister.length === 0) {
        const teamDrivers = Array.from(memberUserIds)
        if (teamDrivers.length > 0) {
          for (const leagueClass of leagueClassTags) {
            const catUpper = leagueClass.toUpperCase()
            const allowedForCategory = allowedCars.find((ac) => {
              const classUpper = ac.classTag?.toUpperCase()
              return classUpper === catUpper || (classUpper?.startsWith('LMP') && catUpper.startsWith('LMP'))
            })
            categoriesToRegister.push({
              classTag: leagueClass,
              carNumber: parsedCarNumber || 12,
              carModel: allowedForCategory ? allowedForCategory.model : null,
              driverUserIds: teamDrivers,
            })
          }
        }
      }

      if (categoriesToRegister.length === 0) {
        categoriesToRegister.push({
          classTag: classTag || 'GENERAL',
          carNumber: parsedCarNumber || 12,
          carModel: carModel || null,
          driverUserIds: [session.userId],
        })
      }

      // Check if any of the drivers are already registered in the league elsewhere
      const allDriversToRegister = Array.from(new Set(categoriesToRegister.flatMap((c) => c.driverUserIds)))
      if (allDriversToRegister.length > 0) {
        const existingDrivers = await db.leagueRegistration.findMany({
          where: { leagueId: league.id, userId: { in: allDriversToRegister } },
        })
        const activeDrivers = existingDrivers.filter((r) => r.status !== 'rejected' && r.teamId !== teamId)
        if (activeDrivers.length > 0) {
          redirect(`/ligas/${slug}?register=driver-already-assigned`)
        }
      }

      // Make sure the team has a car entry for every league category, creating
      // empty placeholders (no drivers) for ones it doesn't have yet.
      const existingCategories = new Set(teamCars.map((c) => c.category.toUpperCase()))
      const updatedClassTags = Array.from(new Set([...(team!.classTags || []), ...leagueClassTags].map((t) => t.toUpperCase())))

      for (const category of leagueClassTags) {
        const catUpper = category.toUpperCase()
        if (existingCategories.has(catUpper)) continue
        const isSelectedCategory = Boolean(classTag && catUpper === classTag.toUpperCase())
        await db.teamCar.create({
          data: {
            teamId,
            category: catUpper,
            dorsal: String(parsedCarNumber || '12'),
            skinUrl: '',
            drivers: isSelectedCategory && selectedDrivers.length > 0
              ? { create: selectedDrivers.map((userId) => ({ userId })) }
              : undefined,
          },
        })
      }

      await db.team.update({ where: { id: teamId }, data: { classTags: updatedClassTags } })

      revalidatePath('/equipos')
      revalidatePath(`/equipos/${teamId}`)

      // Perform the team registration for each category
      for (const catToReg of categoriesToRegister) {
        const teamReg = await db.leagueTeamRegistration.upsert({
          where: {
            leagueId_teamId_classTag_carNumber: {
              leagueId: league.id,
              teamId,
              classTag: catToReg.classTag,
              carNumber: catToReg.carNumber,
            },
          },
          create: {
            leagueId: league.id,
            teamId,
            classTag: catToReg.classTag,
            carNumber: catToReg.carNumber,
            carModel: catToReg.carModel,
            createdByUserId: session.userId,
          },
          update: { carModel: catToReg.carModel },
        })

        const insertedDrivers: { userId: string; assignedNumber: number | null }[] = []
        for (const driverUserId of catToReg.driverUserIds) {
          const result = await upsertLeagueRegistration({
            leagueId: league.id,
            userId: driverUserId,
            teamId,
            classTag: catToReg.classTag,
            desiredNumber: catToReg.carNumber,
          })
          if (!result.ok) {
            if (result.reason === 'number-taken') redirect(`/ligas/${slug}?register=number-taken`)
            redirect(`/ligas/${slug}?register=error`)
          }
          insertedDrivers.push({ userId: driverUserId, assignedNumber: result.assignedNumber })
        }

        // Replace the driver mapping for this car registration wholesale.
        await db.leagueTeamRegistrationDriver.deleteMany({ where: { teamRegistrationId: teamReg.id } })
        await db.leagueTeamRegistrationDriver.createMany({
          data: insertedDrivers.map((item) => ({
            teamRegistrationId: teamReg.id,
            userId: item.userId,
            assignedNumber: item.assignedNumber,
          })),
        })
      }
    } catch (e) {
      console.error(e)
      redirect(`/ligas/${slug}?register=error`)
    }

    invalidateCache([`registrations_${league.id}`, 'registrations_all', 'platform_drivers'])
    revalidatePath(`/ligas/${slug}`)
    revalidatePath('/ligas')
    redirect(`/ligas/${slug}?register=team-success`)
  }

  // Individual registration check
  try {
    const existing = await db.leagueRegistration.findFirst({ where: { leagueId: league.id, userId: session.userId } })
    if (existing && existing.status !== 'rejected') {
      redirect(`/ligas/${slug}?register=exists`)
    }

    const representedTeamId = String(formData.get('representedTeamId') || '').trim()
    const parsedDesiredNumber = parseDesiredNumber(formData.get('desiredNumber'))
    if (parsedDesiredNumber === -1) redirect(`/ligas/${slug}?register=number-invalid`)

    let finalTeamId: string | null = null
    if (representedTeamId) {
      const team = await db.team.findUnique({ where: { id: representedTeamId }, include: { members: true } })
      const isMember = team?.ownerUserId === session.userId || team?.members.some((m) => m.userId === session.userId)
      if (!isMember) redirect(`/ligas/${slug}?register=forbidden`)
      finalTeamId = team?.id || null
    }

    const result = await upsertLeagueRegistration({
      leagueId: league.id,
      userId: session.userId,
      teamId: finalTeamId,
      classTag,
      desiredNumber: parsedDesiredNumber,
    })

    if (!result.ok) {
      if (result.reason === 'number-taken') redirect(`/ligas/${slug}?register=number-taken`)
      redirect(`/ligas/${slug}?register=error`)
    }
  } catch (e) {
    console.error(e)
    redirect(`/ligas/${slug}?register=error`)
  }

  invalidateCache([`registrations_${league.id}`, 'registrations_all', 'platform_drivers'])
  revalidatePath(`/ligas/${slug}`)
  revalidatePath('/ligas')
  redirect(`/ligas/${slug}?register=success`)
}

export async function unregisterFromLeague(formData: FormData) {
  const slug = String(formData.get('slug') || '')
  const registrationId = String(formData.get('registrationId') || '').trim()
  const teamCarKey = String(formData.get('teamCarKey') || '').trim()
  const parsedTeamCar = teamCarKey.split('||')
  const teamId = parsedTeamCar.length === 3 ? parsedTeamCar[0] : String(formData.get('teamId') || '').trim()
  const classTagRaw = parsedTeamCar.length === 3 ? parsedTeamCar[1] : String(formData.get('classTag') || '').trim()
  const classTag = classTagRaw === '__NULL__' ? null : classTagRaw
  const carNumberRaw = parsedTeamCar.length === 3 ? parsedTeamCar[2] : String(formData.get('carNumber') || '').trim()

  const league = await getLeagueBySlug(slug)
  const session = await getCurrentUser()
  if (!league) redirect('/ligas')
  if (!session) redirect(`/ligas/${slug}?register=login`)

  try {
    if (teamId && carNumberRaw) {
      const carNumber = Number(carNumberRaw)
      if (!Number.isInteger(carNumber)) redirect(`/ligas/${slug}?register=error`)

      const team = await db.team.findUnique({ where: { id: teamId }, include: { members: true } })
      const memberRow = team?.members.find((m) => m.userId === session.userId)
      const canManageCar = team?.ownerUserId === session.userId || memberRow?.role === 'owner' || memberRow?.role === 'manager'
      if (!canManageCar) redirect(`/ligas/${slug}?register=forbidden`)

      await db.leagueRegistration.deleteMany({
        where: { leagueId: league.id, teamId, assignedNumber: carNumber, classTag },
      })
      await db.leagueTeamRegistration.deleteMany({
        where: { leagueId: league.id, teamId, carNumber, classTag },
      })
    } else if (registrationId) {
      let target = await db.leagueRegistration.findUnique({ where: { id: registrationId } })
      if (!target || target.leagueId !== league.id) {
        target = await db.leagueRegistration.findFirst({ where: { leagueId: league.id, userId: session.userId } })
        if (!target) redirect(`/ligas/${slug}?register=error`)
      }

      const resolvedUserId = target.userId
      const resolvedTeamId = target.teamId
      const resolvedClassTag = target.classTag
      const resolvedAssignedNumber = target.assignedNumber

      let canRemove = resolvedUserId === session.userId
      if (!canRemove && resolvedTeamId) {
        const team = await db.team.findUnique({ where: { id: resolvedTeamId }, include: { members: true } })
        const memberRow = team?.members.find((m) => m.userId === session.userId)
        canRemove = team?.ownerUserId === session.userId || memberRow?.role === 'owner' || memberRow?.role === 'manager'
      }

      if (!canRemove) redirect(`/ligas/${slug}?register=forbidden`)

      await db.leagueRegistration.delete({ where: { id: target.id } })

      if (resolvedTeamId) {
        const teamReg = await db.leagueTeamRegistration.findFirst({
          where: { leagueId: league.id, teamId: resolvedTeamId, classTag: resolvedClassTag, carNumber: resolvedAssignedNumber ?? undefined },
        })

        if (teamReg) {
          await db.leagueTeamRegistrationDriver.deleteMany({ where: { teamRegistrationId: teamReg.id, userId: resolvedUserId } })
          const remaining = await db.leagueTeamRegistrationDriver.count({ where: { teamRegistrationId: teamReg.id } })
          if (remaining === 0) {
            await db.leagueTeamRegistration.delete({ where: { id: teamReg.id } })
          }
        }
      }
    } else {
      // General withdrawal — remove every registration this user holds in the league.
      await db.leagueRegistration.deleteMany({ where: { leagueId: league.id, userId: session.userId } })
      await db.leagueTeamRegistrationDriver.deleteMany({
        where: { userId: session.userId, teamRegistration: { leagueId: league.id } },
      })
    }
  } catch (e) {
    console.error(e)
    redirect(`/ligas/${slug}?register=error`)
  }

  invalidateCache([`registrations_${league.id}`, 'registrations_all', 'platform_drivers'])
  revalidatePath(`/ligas/${slug}`)
  revalidatePath('/ligas')
  redirect(`/ligas/${slug}?register=withdrawn`)
}
