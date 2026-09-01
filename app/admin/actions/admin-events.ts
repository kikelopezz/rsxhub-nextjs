'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { guardLeaguePermission } from './admin-league'

function addMinutesToIso(startsAt: string, durationMinutes: number) {
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return end.toISOString()
}

export async function createEvent(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const { session } = await guardLeaguePermission(leagueId, 'manage')
  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')

  const title = String(formData.get('title') || '').trim()
  const startsAt = String(formData.get('startsAt') || '').trim()
  const durationMinutes = Number(formData.get('durationMinutes') || 0)
  const endsAt = addMinutesToIso(startsAt, Number.isFinite(durationMinutes) ? durationMinutes : 0)
  if (!title || !startsAt || !endsAt || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    redirect(`/admin/ligas/${leagueId}?eventError=missing-fields`)
  }

  const selectedCircuitId = String(formData.get('circuitId') || '')
  const customCircuitName = String(formData.get('customCircuitName') || '').trim()
  const customCircuitImageUrl = String(formData.get('customCircuitImageUrl') || '').trim()
  let circuitId: string | null = null
  let circuitName = ''

  try {
    if (selectedCircuitId === 'custom') {
      if (!customCircuitName || !customCircuitImageUrl) {
        redirect(`/admin/ligas/${leagueId}?eventError=custom-circuit-required`)
      }

      const slug = customCircuitName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      circuitId = `custom_${slug}`
      await db.collection('circuits').doc(circuitId).set({
        name: customCircuitName,
        slug,
        image_url: customCircuitImageUrl,
        is_system: false,
        created_by: session.userId,
        created_at: new Date(),
      }, { merge: true })

      circuitName = customCircuitName
    } else if (selectedCircuitId) {
      const circuitDoc = await db.collection('circuits').doc(selectedCircuitId).get()
      if (!circuitDoc.exists) {
        redirect(`/admin/ligas/${leagueId}?eventError=circuit-not-found`)
      }

      circuitId = circuitDoc.id
      circuitName = circuitDoc.data()?.name || ''
    } else {
      circuitName = String(formData.get('circuitName') || '').trim()
    }

    if (!circuitName) {
      redirect(`/admin/ligas/${leagueId}?eventError=circuit-required`)
    }

    await db.collection('league_events').add({
      league_id: leagueId,
      title,
      circuit_id: circuitId,
      circuit_name: circuitName,
      starts_at: startsAt,
      ends_at: endsAt,
      status: String(formData.get('status') || 'scheduled'),
      created_at: new Date(),
    })
  } catch (error) {
    console.error('Failed to create event in Firestore:', error)
    redirect(`/admin/ligas/${leagueId}?eventError=create-failed`)
  }

  revalidatePath('/admin')
  revalidatePath('/calendario')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(`/admin/ligas/${leagueId}?event=1`)
}

export async function updateEvent(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const eventId = String(formData.get('eventId') || '')
  await guardLeaguePermission(leagueId, 'manage')

  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')

  const title = String(formData.get('title') || '').trim()
  const circuitName = String(formData.get('circuitName') || '').trim()
  const startsAt = String(formData.get('startsAt') || '').trim()
  const durationMinutes = Number(formData.get('durationMinutes') || 0)
  const endsAt = addMinutesToIso(startsAt, Number.isFinite(durationMinutes) ? durationMinutes : 0)
  const status = String(formData.get('status') || 'scheduled').trim()

  if (!eventId || !title || !circuitName || !startsAt || !endsAt || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    redirect(`/admin/ligas/${leagueId}?eventError=update-missing-fields`)
  }

  try {
    await db.collection('league_events').doc(eventId).update({
      title,
      circuit_name: circuitName,
      starts_at: startsAt,
      ends_at: endsAt,
      status,
      circuit_id: null,
    })
  } catch (error) {
    console.error('Failed to update event in Firestore:', error)
    redirect(`/admin/ligas/${leagueId}?eventError=update-failed`)
  }

  revalidatePath('/calendario')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(`/admin/ligas/${leagueId}?eventUpdated=1`)
}