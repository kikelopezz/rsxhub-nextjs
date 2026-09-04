'use server'

import { revalidatePath } from 'next/cache'
import { deleteFromR2, getR2KeyFromUrl } from '@/lib/r2'
import { guardPlatformAdmin } from './admin-league'

export async function deleteCatalogFileAction(formData: FormData) {
  await guardPlatformAdmin()

  const url = String(formData.get('url') || '')
  const key = getR2KeyFromUrl(url)
  if (key) {
    await deleteFromR2(key)
  }

  revalidatePath('/admin')
}
