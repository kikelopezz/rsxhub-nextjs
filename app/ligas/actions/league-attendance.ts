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

  // 0. Verify car has assigned drivers
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
          if (leagueDrivers.length === 0 && carDrivers.length === 0) {
            throw new Error('No se puede confirmar asistencia: El vehículo no tiene pilotos asignados.')
          }
        }
      }
    }
  }

  // 1. Get the league's category limit
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

  // 2. Count current confirmed cars in this category for this event
  let currentConfirmed = 0
  const docId = `${eventId}_${teamId}_${classTag}_${carNumber}`

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      const existingSnaps = await db
        .collection('league_event_confirmations')
        .where('event_id', '==', eventId)
        .where('class_tag', '==', classTag)
        .where('status', '==', 'confirmed')
        .get()
      
      currentConfirmed = existingSnaps.size
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

