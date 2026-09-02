'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardPlatformAdmin } from './admin-league'

export async function resetDatabaseAction() {
  await guardPlatformAdmin()

  try {
    // Leagues/teams/users cascade to nearly everything else via FK; the
    // handful of tables with no cascade relation to those three roots are
    // cleared explicitly. admin_grants, user_notifications, and
    // driver_number_preferences are deliberately left alone, matching the
    // original Firestore reset's collection list.
    await db.$transaction([
      db.league.deleteMany(),
      db.team.deleteMany(),
      db.user.deleteMany(),
      db.circuit.deleteMany(),
      db.marketListing.deleteMany(),
      db.marketApplication.deleteMany(),
    ])
  } catch (error) {
    console.error('Failed to reset database:', error)
  }

  invalidateCache()

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath('/equipos')
  revalidatePath('/calendario')
  revalidatePath('/market')
  revalidatePath('/perfil')

  redirect('/?reset=success')
}
