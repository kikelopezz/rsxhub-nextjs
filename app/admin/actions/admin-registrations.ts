'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardLeaguePermission } from './admin-league'

export async function updateRegistrationStatus(formData: FormData) {
  const registrationId = String(formData.get('registrationId') || '')
  const status = String(formData.get('status') || 'pending')
  const leagueId = String(formData.get('leagueId') || '')

  await guardLeaguePermission(leagueId, 'steward')
  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')

  try {
    await db.collection('league_registrations').doc(registrationId).update({ status })
  } catch (error) {
    // If registrationId is not a doc ID, query and update
    try {
      const snap = await db.collection('league_registrations').where('league_id', '==', leagueId).get()
      const doc = snap.docs.find((d: any) => d.id === registrationId || d.data().user_id === registrationId)
      if (doc) {
        await doc.ref.update({ status })
      }
    } catch (inner) {
      console.error(inner)
    }
  }

  invalidateCache(['registrations_', 'event_confirmations_'])
  revalidatePath('/admin')
  redirect(`/admin/ligas/${leagueId}?updated=1`)
}

export async function updateTeamRegistrationStatus(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTagRaw = String(formData.get('classTag') || '')
  const classTag = classTagRaw === '__NULL__' ? null : classTagRaw
  const carNumberRaw = String(formData.get('carNumber') || '')
  const status = String(formData.get('status') || 'pending')

  await guardLeaguePermission(leagueId, 'steward')
  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')
  if (!leagueId || !teamId || !carNumberRaw) redirect(`/admin/ligas/${leagueId}?updated=0`)

  const carNumber = Number(carNumberRaw)
  if (!Number.isInteger(carNumber)) redirect(`/admin/ligas/${leagueId}?updated=0`)

  try {
    let snapshot = await db
      .collection('league_registrations')
      .where('league_id', '==', leagueId)
      .where('team_id', '==', teamId)
      .where('assigned_number', '==', carNumber)
      .get()

    let docs = snapshot.docs
    if (classTag) {
      docs = docs.filter((d: any) => d.data().class_tag === classTag)
    } else {
      docs = docs.filter((d: any) => !d.data().class_tag)
    }

    const batch = db.batch()
    docs.forEach((doc: any) => batch.update(doc.ref, { status }))
    await batch.commit()

    let teamSnapshot = await db
      .collection('league_team_registrations')
      .where('league_id', '==', leagueId)
      .where('team_id', '==', teamId)
      .where('car_number', '==', carNumber)
      .get()

    let teamDocs = teamSnapshot.docs
    if (classTag) {
      teamDocs = teamDocs.filter((d: any) => d.data().class_tag === classTag)
    } else {
      teamDocs = teamDocs.filter((d: any) => !d.data().class_tag)
    }

    const teamBatch = db.batch()
    teamDocs.forEach((doc: any) => teamBatch.update(doc.ref, { status }))
    await teamBatch.commit()
  } catch (error) {
    console.error('Failed to update team registration status in Firestore:', error)
  }

  invalidateCache(['registrations_', 'event_confirmations_'])
  revalidatePath('/admin')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(`/admin/ligas/${leagueId}?updated=1`)
}