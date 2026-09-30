'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { hasR2, uploadBufferToR2 } from '@/lib/r2'
import { logAudit } from '@/lib/audit-log'
import { guardPlatformAdmin } from './admin-league'

export async function resetDatabaseAction() {
  const session = await guardPlatformAdmin()

  // This is irreversible, so refuse to run at all unless a pre-wipe backup of exactly what's
  // about to be destroyed can be made first. The key is unguessable and never returned to the
  // browser or linked anywhere — recovering it means going to the R2 bucket directly (which
  // already requires the account-level API credentials, same trust level as this action itself).
  if (!hasR2) {
    console.error('[BORRAR TODO] R2 is not configured — refusing to wipe without a backup.')
    redirect('/admin?error=backup-required')
  }

  let backupKey: string
  try {
    const [leagues, teams, users, circuits, marketListings, marketApplications] = await Promise.all([
      db.league.findMany(),
      db.team.findMany(),
      db.user.findMany(),
      db.circuit.findMany(),
      db.marketListing.findMany(),
      db.marketApplication.findMany(),
    ])
    // A snapshot of the top-level rows being deleted, for manual spot-recovery — not a full
    // relational export (child tables cascading from these aren't included). Real disaster
    // recovery should still go through the daily infra-level Postgres backup.
    const dump = { exportedAt: new Date().toISOString(), leagues, teams, users, circuits, marketListings, marketApplications }
    backupKey = `backups/platform-reset-${Date.now()}-${crypto.randomUUID()}.json`
    await uploadBufferToR2(backupKey, Buffer.from(JSON.stringify(dump)), 'application/json')
  } catch (error) {
    console.error('[BORRAR TODO] Failed to create the pre-wipe backup, aborting (nothing was deleted):', error)
    redirect('/admin?error=backup-failed')
  }

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
    // Don't fall through to the success redirect: nothing was deleted.
    redirect('/admin?error=action-failed')
  }

  // audit_logs has no FK to any of the tables just wiped, so this survives the reset it's
  // recording — logged after a successful wipe, not before, so a failed/aborted attempt
  // (backup-failed or action-failed above) never gets logged as if it had happened.
  await logAudit({ actor: session, action: 'platform.reset_all', entityType: 'platform', metadata: { backupKey } })

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
