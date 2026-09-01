'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
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

  const docId = `${eventId}_${teamId}_${classTag}_${carNumber}`

  // 0. Verify car has assigned drivers, and collect this car's driver ids
  let driverUserIds: string[] = []
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      const teamDoc = await db.collection('teams').doc(teamId).get()
      if (teamDoc.exists) {
        const teamData = teamDoc.data()
        const car = (teamData?.cars || []).find((c: any) => {
          const sameClass = String(c.category || '').toUpperCase() === classTag
          const sameDorsal = String(c.dorsal ?? '').trim() === String(carNumber).trim() || Number(c.dorsal) === Number(carNumber)
          return sameClass && sameDorsal
        })
        if (car) {
          const byLeague = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
          const leagueDrivers = (byLeague[leagueId] || byLeague[slug] || []).filter(Boolean)
          const carDrivers = Array.isArray(car.driverUserIds)
            ? car.driverUserIds.filter(Boolean)
            : Array.isArray(car.driver_user_ids)
            ? car.driver_user_ids.filter(Boolean)
            : []
          driverUserIds = Array.from(new Set(leagueDrivers.length > 0 ? leagueDrivers : carDrivers))
          if (driverUserIds.length === 0) {
            throw new Error('No se puede confirmar asistencia: El vehículo no tiene pilotos asignados.')
          }
        }
      }
    }
  }

  // 1. Get the league's category (car) limit
  let categoryLimit = 30
  try {
    const league = await getLeagueBySlug(slug)
    if (league) {
      if (league.classLimits && league.classLimits[classTag] !== undefined) {
        categoryLimit = league.classLimits[classTag]
      }
    }
  } catch (e) {
    console.error('Failed to get league classLimits:', e)
  }

  // 2. Count current confirmed cars in this category, and enforce the event's driver cap
  let currentConfirmed = 0

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      const [categorySnap, eventDoc] = await Promise.all([
        db
          .collection('league_event_confirmations')
          .where('event_id', '==', eventId)
          .where('class_tag', '==', classTag)
          .where('status', '==', 'confirmed')
          .get(),
        db.collection('league_events').doc(eventId).get(),
      ])

      currentConfirmed = categorySnap.size

      const eventData = eventDoc.exists ? eventDoc.data() : null
      const rawMaxDrivers = eventData?.max_drivers ?? eventData?.maxDrivers
      const eventMaxDrivers = rawMaxDrivers != null ? Number(rawMaxDrivers) : null

      const eventClassLimits = eventData?.class_limits || eventData?.classLimits
      if (eventClassLimits && eventClassLimits[classTag] !== undefined) {
        categoryLimit = Number(eventClassLimits[classTag])
      }

      if (eventMaxDrivers != null && driverUserIds.length > 0) {
        const allConfirmedSnap = await db
          .collection('league_event_confirmations')
          .where('event_id', '==', eventId)
          .where('status', '==', 'confirmed')
          .get()

        const distinctDrivers = new Set<string>()
        allConfirmedSnap.docs.forEach((d: any) => {
          if (d.id === docId) return
          const ids: string[] = d.data().driver_user_ids || []
          ids.forEach((id) => distinctDrivers.add(id))
        })
        driverUserIds.forEach((id) => distinctDrivers.add(id))

        if (distinctDrivers.size > eventMaxDrivers) {
          throw new Error(`¡Límite de pilotos alcanzado para esta carrera (${eventMaxDrivers} máximo)!`)
        }
      }
    }
  } else {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_event_confirmations')?.value
      const list = existing ? JSON.parse(existing) : []
      currentConfirmed = list.filter(
        (c: any) => c.eventId === eventId && c.classTag === classTag && c.status === 'confirmed'
      ).length

      const eventsCookie = cookieStore.get('mock_league_events')?.value
      const events = eventsCookie ? JSON.parse(eventsCookie) : []
      const event = events.find((e: any) => e.id === eventId)
      const eventMaxDrivers = event?.maxDrivers != null ? Number(event.maxDrivers) : null

      const eventClassLimits = event?.classLimits
      if (eventClassLimits && eventClassLimits[classTag] !== undefined) {
        categoryLimit = Number(eventClassLimits[classTag])
      }

      if (eventMaxDrivers != null && driverUserIds.length > 0) {
        const distinctDrivers = new Set<string>()
        list
          .filter((c: any) => c.eventId === eventId && c.status === 'confirmed' && c.id !== docId)
          .forEach((c: any) => (c.driverUserIds || []).forEach((id: string) => distinctDrivers.add(id)))
        driverUserIds.forEach((id) => distinctDrivers.add(id))

        if (distinctDrivers.size > eventMaxDrivers) {
          throw new Error(`¡Límite de pilotos alcanzado para esta carrera (${eventMaxDrivers} máximo)!`)
        }
      }
    } catch (e) {
      console.error('Error counting mock confirmations:', e)
    }
  }

  if (currentConfirmed >= categoryLimit) {
    throw new Error(`¡La parrilla para la categoría ${classTag} está llena (${categoryLimit} coches máximo)!`)
  }

  // 3. Save the confirmation
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      await db.collection('league_event_confirmations').doc(docId).set({
        id: docId,
        event_id: eventId,
        league_id: leagueId,
        team_id: teamId,
        class_tag: classTag,
        car_number: carNumber,
        car_model: carModel,
        driver_user_ids: driverUserIds,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }, { merge: true })
    }
  } else {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_event_confirmations')?.value
      let list = existing ? JSON.parse(existing) : []

      // Remove existing for this exact car if any
      list = list.filter((c: any) => !(c.id === docId))

      list.push({
        id: docId,
        eventId,
        leagueId,
        teamId,
        classTag,
        carNumber,
        carModel,
        driverUserIds,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      })

      cookieStore.set('mock_event_confirmations', JSON.stringify(list), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    } catch (e) {
      console.error('Failed to save mock confirmation:', e)
    }
  }

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

  const docId = `${eventId}_${teamId}_${classTag}_${carNumber}`

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      await db.collection('league_event_confirmations').doc(docId).delete()
    }
  } else {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_event_confirmations')?.value
      let list = existing ? JSON.parse(existing) : []

      list = list.filter((c: any) => !(c.id === docId))

      cookieStore.set('mock_event_confirmations', JSON.stringify(list), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    } catch (e) {
      console.error('Failed to cancel mock confirmation:', e)
    }
  }

  revalidatePath(`/ligas/${slug}`)
}

