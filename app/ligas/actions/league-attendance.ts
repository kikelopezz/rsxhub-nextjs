'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLeagueBySlug } from '@/lib/platform-data'

export async function confirmAttendanceAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const eventId = String(formData.get('eventId') || '')
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTag = String(formData.get('classTag') || '').trim().toUpperCase()
  const carNumber = Number(formData.get('carNumber') || 0)
  const carModel = String(formData.get('carModel') || '')
  const slug = String(formData.get('slug') || '')

  if (!eventId || !leagueId || !teamId || !classTag || !carNumber) {
    throw new Error('All fields are required.')
  }

  // 0. Verify car has assigned drivers, and collect this car's driver ids
  const team = await db.team.findUnique({ where: { id: teamId }, include: { cars: { include: { drivers: true } } } })
  const car = team?.cars.find((c) => {
    const sameClass = c.category.toUpperCase() === classTag
    const sameDorsal = c.dorsal.trim() === String(carNumber).trim() || Number(c.dorsal) === carNumber
    return sameClass && sameDorsal
  })

  let driverUserIds: string[] = []
  if (car) {
    const leagueDrivers = car.drivers.filter((d) => d.leagueId === leagueId || d.leagueId === slug).map((d) => d.userId)
    const defaultDrivers = car.drivers.filter((d) => !d.leagueId).map((d) => d.userId)
    driverUserIds = Array.from(new Set(leagueDrivers.length > 0 ? leagueDrivers : defaultDrivers))
    if (driverUserIds.length === 0) {
      throw new Error('No se puede confirmar asistencia: El vehículo no tiene pilotos asignados.')
    }
  }

  // 1. Get the league's category (car) limit
  let categoryLimit = 30
  try {
    const league = await getLeagueBySlug(slug)
    if (league?.classLimits?.[classTag] !== undefined) {
      categoryLimit = league.classLimits[classTag]
    }
  } catch (e) {
    console.error('Failed to get league classLimits:', e)
  }

  // 2. Count current confirmed cars in this category, and enforce the event's driver cap
  const [currentConfirmed, event, existing] = await Promise.all([
    db.leagueEventConfirmation.count({ where: { eventId, classTag } }),
    db.leagueEvent.findUnique({ where: { id: eventId } }),
    db.leagueEventConfirmation.findUnique({
      where: { eventId_teamId_classTag_carNumber: { eventId, teamId, classTag, carNumber } },
    }),
  ])

  if (event) {
    const eventLimit = await db.leagueClassLimit.findUnique({
      where: { leagueId_eventId_classTag: { leagueId, eventId, classTag } },
    })
    if (eventLimit) categoryLimit = eventLimit.maxCars

    if (event.maxDrivers != null && driverUserIds.length > 0) {
      const allConfirmed = await db.leagueEventConfirmation.findMany({
        where: { eventId },
        include: { drivers: true },
      })
      const distinctDrivers = new Set<string>()
      for (const c of allConfirmed) {
        if (c.id === existing?.id) continue
        c.drivers.forEach((d) => distinctDrivers.add(d.userId))
      }
      driverUserIds.forEach((id) => distinctDrivers.add(id))

      if (distinctDrivers.size > event.maxDrivers) {
        throw new Error(`¡Límite de pilotos alcanzado para esta carrera (${event.maxDrivers} máximo)!`)
      }
    }
  }

  const effectiveCurrentConfirmed = existing ? currentConfirmed - 1 : currentConfirmed
  if (effectiveCurrentConfirmed >= categoryLimit) {
    throw new Error(`¡La parrilla para la categoría ${classTag} está llena (${categoryLimit} coches máximo)!`)
  }

  // 3. Save the confirmation
  await db.leagueEventConfirmation.upsert({
    where: { eventId_teamId_classTag_carNumber: { eventId, teamId, classTag, carNumber } },
    create: {
      eventId,
      leagueId,
      teamId,
      classTag,
      carNumber,
      carModel,
      drivers: { create: driverUserIds.map((userId) => ({ userId })) },
    },
    update: {
      carModel,
      confirmedAt: new Date(),
      drivers: { deleteMany: {}, create: driverUserIds.map((userId) => ({ userId })) },
    },
  })

  revalidatePath(`/ligas/${slug}`)
}

export async function cancelAttendanceAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const eventId = String(formData.get('eventId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTag = String(formData.get('classTag') || '').trim().toUpperCase()
  const carNumber = Number(formData.get('carNumber') || 0)
  const slug = String(formData.get('slug') || '')

  if (!eventId || !teamId || !classTag || !carNumber) {
    throw new Error('All fields are required.')
  }

  await db.leagueEventConfirmation.deleteMany({ where: { eventId, teamId, classTag, carNumber } })

  revalidatePath(`/ligas/${slug}`)
}
