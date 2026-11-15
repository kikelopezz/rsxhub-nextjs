'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { guardPlatformAdmin } from './admin-league'

export async function createCustomVehicleModelAction(formData: FormData) {
  await guardPlatformAdmin()
  const name = String(formData.get('name') || '').trim()
  const acFolder = String(formData.get('acFolder') || '').trim()
  const category = String(formData.get('category') || '').trim().toUpperCase()
  const manufacturer = String(formData.get('manufacturer') || '').trim()
  const imageUrl = String(formData.get('imageUrl') || '').trim()
  if (!name || !acFolder || !category) return

  await db.customVehicleModel.create({
    data: { name, acFolder, category, manufacturer: manufacturer || null, imageUrl: imageUrl || null },
  })

  revalidatePath('/admin')
  revalidatePath('/equipos')
}

export async function deleteCustomVehicleModelAction(formData: FormData) {
  await guardPlatformAdmin()
  const id = String(formData.get('id') || '').trim()
  if (!id) return

  await db.customVehicleModel.delete({ where: { id } }).catch(() => {})

  revalidatePath('/admin')
  revalidatePath('/equipos')
}
