'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { guardLeaguePermission } from './admin-league'

export async function addLeagueCar(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  await guardLeaguePermission(leagueId, 'manage')
  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')

  const label = String(formData.get('label') || '').trim()
  const model = String(formData.get('model') || '').trim()
  const sortOrder = Number(formData.get('sortOrder') || 0)
  if (!leagueId || !label || !model) redirect(`/admin/ligas/${leagueId}?carError=missing-fields`)

  try {
    await db.collection('league_cars').add({
      league_id: leagueId,
      label,
      model,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: true,
      created_at: new Date(),
    })
  } catch (error) {
    console.error('Failed to add league car to Firestore:', error)
    redirect(`/admin/ligas/${leagueId}?carError=create-failed`)
  }

  revalidatePath(`/admin/ligas/${leagueId}`)
  revalidatePath(`/ligas`)
  redirect(`/admin/ligas/${leagueId}?car=1`)
}

export async function removeLeagueCar(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const carId = String(formData.get('carId') || '')
  await guardLeaguePermission(leagueId, 'manage')
  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')
  if (!leagueId || !carId) redirect(`/admin/ligas/${leagueId}?carError=missing-fields`)

  try {
    const doc = await db.collection('league_cars').doc(carId).get()
    if (doc.exists && doc.data()?.league_id === leagueId) {
      await doc.ref.delete()
    }
  } catch (error) {
    console.error('Failed to delete league car in Firestore:', error)
  }

  revalidatePath(`/admin/ligas/${leagueId}`)
  revalidatePath(`/ligas`)
  redirect(`/admin/ligas/${leagueId}?carDeleted=1`)
}