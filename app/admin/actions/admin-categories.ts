'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { guardPlatformAdmin } from './admin-league'

function refresh() {
  revalidatePath('/admin')
  revalidatePath('/ligas')
}

export async function createCategoryAction(formData: FormData) {
  await guardPlatformAdmin()
  const name = String(formData.get('name') || '').trim()
  if (!name) return
  const key = name.toUpperCase().slice(0, 32)

  const last = await db.carCategory.findFirst({ orderBy: { sortOrder: 'desc' } })
  await db.carCategory.upsert({
    where: { key },
    update: { name },
    create: { key, name, sortOrder: (last?.sortOrder ?? -1) + 1 },
  })
  refresh()
}

export async function updateCategoryAction(formData: FormData) {
  await guardPlatformAdmin()
  const key = String(formData.get('key') || '').trim()
  const name = String(formData.get('name') || '').trim()
  if (!key || !name) return

  await db.carCategory.update({ where: { key }, data: { name } })
  refresh()
}

export async function toggleCategoryActiveAction(formData: FormData) {
  await guardPlatformAdmin()
  const key = String(formData.get('key') || '').trim()
  if (!key) return

  const current = await db.carCategory.findUnique({ where: { key } })
  if (!current) return
  await db.carCategory.update({ where: { key }, data: { active: !current.active } })
  refresh()
}

export async function deleteCategoryAction(formData: FormData) {
  await guardPlatformAdmin()
  const key = String(formData.get('key') || '').trim()
  if (!key) return

  const inUse = await db.league.count({ where: { classTags: { has: key } } })
  if (inUse > 0) return // algún campeonato la sigue usando — se mantiene

  await db.carCategory.delete({ where: { key } }).catch(() => {})
  refresh()
}
