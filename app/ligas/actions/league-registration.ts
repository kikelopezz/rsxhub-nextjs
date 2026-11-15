'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getRegistrations, getLeagueBySlug } from '@/lib/platform-data'
import { invalidateCache } from '@/lib/ttl-cache'
import { sameClassTag } from '@/lib/class-tag-match'
import { parseConnections } from '@/lib/connections'
import { getMinHoursForCategory } from '@/lib/data/categories'
import { getAssettoCorsaHours } from '@/lib/steam-hours'

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

  const league = await db.league.findUnique({ where: { id: leagueId }, select: { slug: true, classTags: true, requiresPayment: true } })
  const leagueClassTags = league?.classTags || []
  // Ligas de pago no se auto-aprueban: quedan "pending" hasta que un admin confirme
  // el pago (fuera de la plataforma) y las apruebe desde el panel de admin.
  const initialStatus: 'approved' | 'pending' = league?.requiresPayment ? 'pending' : 'approved'
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
    if (car.leagueId && car.leagueId !== leagueId) return false
    return leagueClassTags.some((tag) => sameClassTag(car.category, tag))
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
    const templateCar = (team?.cars || []).find((c) => sameClassTag(c.category, fallbackClassTag))
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

  // Discord obligatorio: cada piloto inscrito en un coche debe tener su usuario de Discord en
  // el perfil (ver onboarding) — es el canal que usan los organizadores para avisos de carrera.
  const driverIdsToCheck = Array.from(new Set(carsToRegister.flatMap((c) => c.driverUserIds)))
  if (driverIdsToCheck.length > 0) {
    const profiles = await db.profile.findMany({ where: { userId: { in: driverIdsToCheck } } })
    const missingDiscord = driverIdsToCheck.filter((userId) => {
      const profile = profiles.find((p) => p.userId === userId)
      return !parseConnections(profile?.connections).discord
    })
    if (missingDiscord.length > 0) {
      throw new Error('Todos los pilotos del coche deben indicar su usuario de Discord en su perfil antes de inscribirse.')
    }
  }

  // Horas mínimas de Assetto Corsa por categoría (admin > Categorías de coches). Solo bloquea
  // cuando la categoría tiene un mínimo configurado — sin eso, el comportamiento no cambia.
  if (driverIdsToCheck.length > 0) {
    const minHoursByClass = new Map<string, number>()
    for (const car of carsToRegister) {
      if (!minHoursByClass.has(car.classTag)) {
        minHoursByClass.set(car.classTag, await getMinHoursForCategory(car.classTag))
      }
    }
    if (Array.from(minHoursByClass.values()).some((h) => h > 0)) {
      const steamAccounts = await db.steamAccount.findMany({ where: { userId: { in: driverIdsToCheck } } })
      const steamIdByUserId = new Map(steamAccounts.map((s) => [s.userId, s.steamId]))
      for (const car of carsToRegister) {
        const minHours = minHoursByClass.get(car.classTag) || 0
        if (minHours <= 0) continue
        for (const driverUserId of car.driverUserIds) {
          const steamId = steamIdByUserId.get(driverUserId)
          const hours = steamId ? await getAssettoCorsaHours(steamId) : null
          if (hours == null || hours < minHours) {
            throw new Error(
              `Un piloto del coche de ${car.classTag} no cumple el mínimo de ${minHours}h en Assetto Corsa (o su perfil de Steam es privado).`
            )
          }
        }
      }
    }
  }

  // Get current registrations to check for taken numbers
  const registrations = await getRegistrations(leagueId)

  // El dorsal es unico por LIGA, no por categoria dentro de la liga: si el #44 ya
  // lo lleva un Hypercar en esta liga, un GT3 de la misma liga no puede usar
  // tambien el #44 (y viceversa). Ligas distintas (p.ej. "RC" y "RC NextGen")
  // son independientes entre si porque `registrations` ya viene filtrado por
  // leagueId mas arriba (getRegistrations(leagueId)).
  //
  // Dos cosas mas, para que el ambito "por liga" no rompa casos normales:
  //  1. Se excluyen las inscripciones YA EXISTENTES de este mismo equipo: si no,
  //     un equipo que ya tiene el #44 en GT3 se bloquearia a si mismo al volver
  //     a guardar/registrar (las filas viejas no se borran hasta el final de
  //     esta funcion, asi que seguirian contando como "ocupadas" en esta
  //     comprobacion).
  //  2. Los numeros se van marcando segun se resuelven DENTRO de esta misma
  //     llamada (takenNumbers.add), para que si el mismo equipo registra dos
  //     coches de categorias distintas a la vez no acaben con el mismo numero
  //     entre si.
  const takenNumbers = new Set(
    registrations
      .filter((r) => r.teamId !== teamId && r.status !== 'rejected')
      .map((r) => r.assignedNumber)
  )
  function resolveFreeNumber(preferred: number): number {
    if (preferred > 0 && !takenNumbers.has(preferred)) {
      takenNumbers.add(preferred)
      return preferred
    }
    for (let num = 12; num <= 99; num++) {
      if (!takenNumbers.has(num)) {
        takenNumbers.add(num)
        return num
      }
    }
    return preferred > 0 ? preferred : 12
  }

  const rowsToInsert: {
    leagueId: string
    userId: string
    teamId: string
    displayName: string
    status: 'approved' | 'pending'
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

    const regCarNumber = resolveFreeNumber(carToReg.carNumber)

    // getRegistrations() only shows a registration once it finds a TeamCar with a
    // matching category+dorsal bound to this league (or unbound) — it's how stale
    // rows get hidden after a car's number changes elsewhere. A team's cars are
    // normally bound to whichever league they were first registered for, so this
    // team joining a *second* league with no car of its own here yet would create
    // a registration with no matching car, and getRegistrations would silently
    // drop it everywhere (it'd show as "approved" in the DB but invisible in the UI).
    // Make sure this league always has its own bound car to match against.
    const existingLeagueCar = (team?.cars || []).find(
      (c) => c.leagueId === leagueId && sameClassTag(c.category, carToReg.classTag)
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
        status: initialStatus,
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

// Inscripción individual (sin equipo): solo para ligas con registrationMode = 'individual'.
// A diferencia de registerTeamAction no hay TeamCar de por medio — es solo una fila en
// LeagueRegistration con teamId null, que getRegistrations() ya deja pasar sin filtrar.
export async function registerIndividualAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  let slug = String(formData.get('slug') || '')
  const leagueId = String(formData.get('leagueId') || '')
  const inputClassTag = String(formData.get('classTag') || '').trim().toUpperCase()
  const carNumberInput = parseCarNumber(formData.get('carNumber'))

  if (!leagueId) throw new Error('League ID is required.')

  const league = await db.league.findUnique({
    where: { id: leagueId },
    select: { slug: true, classTags: true, requiresPayment: true, registrationMode: true, registrationOpen: true, status: true },
  })
  if (!league) throw new Error('League not found.')
  if (league.registrationMode !== 'individual') {
    throw new Error('This championship only accepts team registrations.')
  }
  if (!league.registrationOpen || league.status !== 'open') {
    throw new Error('Registration is closed for this championship.')
  }
  if (!slug) slug = league.slug || leagueId

  const profile = await db.profile.findUnique({ where: { userId: session.userId } })
  const discord = parseConnections(profile?.connections).discord
  if (!discord) {
    throw new Error('Tienes que indicar tu usuario de Discord en tu perfil antes de inscribirte.')
  }

  const leagueClassTags = league.classTags || []
  let classTag = inputClassTag
  if (!classTag || !leagueClassTags.map((t) => t.toUpperCase()).includes(classTag)) {
    classTag = (leagueClassTags[0] || 'GT3').toUpperCase()
  }

  const steam = await db.steamAccount.findUnique({ where: { userId: session.userId } })
  const displayName = profile?.displayName || steam?.steamDisplayName || `Pilot ${session.userId.slice(0, 4)}`
  const initialStatus: 'approved' | 'pending' = league.requiresPayment ? 'pending' : 'approved'

  const minHours = await getMinHoursForCategory(classTag)
  if (minHours > 0) {
    const hours = steam?.steamId ? await getAssettoCorsaHours(steam.steamId) : null
    if (hours == null || hours < minHours) {
      throw new Error(
        `No cumples el mínimo de ${minHours}h en Assetto Corsa para ${classTag} (o tu perfil de Steam es privado).`
      )
    }
  }

  const registrations = await getRegistrations(leagueId)
  const takenNumbers = new Set(
    registrations
      .filter((r) => r.userId !== session.userId && r.status !== 'rejected')
      .map((r) => r.assignedNumber)
  )
  function resolveFreeNumber(preferred: number): number {
    if (preferred > 0 && !takenNumbers.has(preferred)) return preferred
    for (let num = 12; num <= 99; num++) {
      if (!takenNumbers.has(num)) return num
    }
    return preferred > 0 ? preferred : 12
  }
  const assignedNumber = resolveFreeNumber(carNumberInput)

  await db.$transaction([
    db.leagueRegistration.deleteMany({ where: { leagueId, userId: session.userId, teamId: null, classTag } }),
    db.leagueRegistration.create({
      data: {
        leagueId,
        userId: session.userId,
        teamId: null,
        displayName,
        steamId: steam?.steamId || '',
        status: initialStatus,
        classTag,
        assignedNumber,
      },
    }),
  ])

  invalidateCache(['registrations_' + leagueId, 'registrations_all', 'platform_drivers'])
  revalidatePath('/ligas')
  if (slug) revalidatePath(`/ligas/${slug}`)
}

export async function unregisterIndividualAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  let slug = String(formData.get('slug') || '')
  const leagueId = String(formData.get('leagueId') || '')
  const classTag = String(formData.get('classTag') || '').trim().toUpperCase()

  if (!leagueId || !classTag) throw new Error('Missing data.')

  if (!slug) {
    const league = await db.league.findUnique({ where: { id: leagueId }, select: { slug: true } })
    slug = league?.slug || ''
  }

  await db.leagueRegistration.deleteMany({ where: { leagueId, userId: session.userId, teamId: null, classTag } })

  invalidateCache(['registrations_' + leagueId, 'registrations_all', 'platform_drivers'])
  revalidatePath('/ligas')
  if (slug) revalidatePath(`/ligas/${slug}`)
}
