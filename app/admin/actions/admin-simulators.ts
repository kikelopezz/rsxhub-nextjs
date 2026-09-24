'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { guardPlatformAdmin } from './admin-league'

function slugKey(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 32)
}

function refresh() {
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath('/market')
  revalidatePath('/calendario')
}

export async function createSimulatorAction(formData: FormData) {
  await guardPlatformAdmin()
  const name = String(formData.get('name') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim()
  const key = slugKey(name)
  if (!name || !key) return

  const last = await db.simulatorConfig.findFirst({ orderBy: { sortOrder: 'desc' } })
  await db.simulatorConfig.upsert({
    where: { key },
    update: { name, ...(logoUrl && { logoUrl }) },
    create: { key, name, logoUrl: logoUrl || null, sortOrder: (last?.sortOrder ?? -1) + 1 },
  })
  refresh()
}

export async function updateSimulatorAction(formData: FormData) {
  await guardPlatformAdmin()
  const key = String(formData.get('key') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim()
  if (!key) return

  await db.simulatorConfig.update({
    where: { key },
    data: { ...(name && { name }), logoUrl: logoUrl || null },
  })
  refresh()
}

export async function deleteSimulatorAction(formData: FormData) {
  await guardPlatformAdmin()
  const key = String(formData.get('key') || '').trim()
  if (!key) return

  const inUse = await db.league.count({ where: { simulator: key } })
  if (inUse > 0) return // still used by a championship — keep it

  await db.simulatorConfig.delete({ where: { key } }).catch(() => {})
  refresh()
}
