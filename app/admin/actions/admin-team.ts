'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardPlatformAdmin } from './admin-league'

export async function updateTeamStatusAction(formData: FormData) {
  await guardPlatformAdmin()

  const teamId = String(formData.get('teamId') || '')
  const status = String(formData.get('status') || 'pending')
  if (!teamId || !['pending', 'approved', 'rejected'].includes(status)) {
    redirect('/admin?tab=teams&error=1')
  }

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        await db.collection('teams').doc(teamId).update({ status })
      } catch (error) {
        console.error('Failed to update team status in Firestore:', error)
      }
    }
  } else {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_teams')?.value
      if (existing) {
        const current = JSON.parse(existing)
        const updated = current.map((t: any) => (t.id === teamId ? { ...t, status } : t))
        cookieStore.set('mock_teams', JSON.stringify(updated), { path: '/', maxAge: 60 * 60 * 24 * 30 })
      }
    } catch (error) {
      console.error('Failed to update mock team status:', error)
    }
  }

  invalidateCache(['teams_dashboard', 'platform_drivers'])
  revalidatePath('/admin')
  revalidatePath('/equipos')
  redirect('/admin?tab=teams&updated=1')
}
