'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardPlatformAdmin } from './admin-league'

export async function updateTeamStatusAction(formData: FormData) {
  await guardPlatformAdmin()

  const teamId = String(formData.get('teamId') || '')
  const status = String(formData.get('status') || 'pending')
  if (!teamId || !['pending', 'approved', 'rejected'].includes(status)) {
    redirect('/admin?tab=teams&error=1')
  }

  try {
    await db.team.update({ where: { id: teamId }, data: { status: status as any } })
  } catch (error) {
    console.error('Failed to update team status:', error)
  }

  invalidateCache(['teams_dashboard', 'platform_drivers'])
  revalidatePath('/admin')
  revalidatePath('/equipos')
  redirect('/admin?tab=teams&updated=1')
}
