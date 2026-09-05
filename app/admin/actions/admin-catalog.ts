'use server'

import { revalidatePath } from 'next/cache'
import { deleteFromR2, getR2KeyFromUrl } from '@/lib/r2'
import { guardPlatformAdmin } from './admin-league'
import { getCurrentUser } from '@/lib/auth'
import { listCatalogFiles, type CatalogFile } from '@/lib/admin-catalog'

export async function deleteCatalogFileAction(formData: FormData) {
  await guardPlatformAdmin()

  const url = String(formData.get('url') || '')
  const key = getR2KeyFromUrl(url)
  if (key) {
    await deleteFromR2(key)
  }

  revalidatePath('/admin')
}

// Any signed-in user can browse/download the car mod catalog from the vehicle selector —
// unlike deleteCatalogFileAction, this isn't a platform-admin-only action.
export async function listCarCatalogFilesAction(): Promise<CatalogFile[]> {
  const session = await getCurrentUser()
  if (!session) return []
  return listCatalogFiles('coches')
}
