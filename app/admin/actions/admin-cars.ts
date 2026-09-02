'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { guardLeaguePermission } from './admin-league'

export async function addLeagueCar(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  await guardLeaguePermission(leagueId, 'manage')

  const label = String(formData.get('label') || '').trim()
  const model = String(formData.get('model') || '').trim()
  const sortOrder = Number(formData.get('sortOrder') || 0)
  if (!leagueId || !label || !model) redirect(`/admin/ligas/${leagueId}?carError=missing-fields`)

  try {
    await db.leagueCar.create({
      data: { leagueId, label, model, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0, isActive: true },
    })
  } catch (error) {
    console.error('Failed to add league car:', error)
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
  if (!leagueId || !carId) redirect(`/admin/ligas/${leagueId}?carError=missing-fields`)

  try {
    await db.leagueCar.deleteMany({ where: { id: carId, leagueId } })
  } catch (error) {
    console.error('Failed to delete league car:', error)
  }

  revalidatePath(`/admin/ligas/${leagueId}`)
  revalidatePath(`/ligas`)
  redirect(`/admin/ligas/${leagueId}?carDeleted=1`)
}
