'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { markLineupChangeNotificationsSeen } from '@/lib/admin-lineup-log'
import { logAudit } from '@/lib/audit-log'
import { guardPlatformAdmin } from './admin-league'
import { TEAM_SANCTION_TAGS, type TeamSanctionTag } from '@/lib/team-sanctions'

export async function markLineupChangeNotificationsSeenAction() {
  const session = await guardPlatformAdmin()
  await markLineupChangeNotificationsSeen(session.userId)
  invalidateCache([`user_notifications_${session.userId}`])
  revalidatePath('/admin')
}

/** Activa o desactiva una sanción sobre un equipo (Race Ban / Season Ban / Descalificado). Un
 * equipo puede tener varias a la vez. Solo visible en el panel de admin. */
export async function toggleTeamSanctionAction(formData: FormData) {
  await guardPlatformAdmin()

  const teamId = String(formData.get('teamId') || '')
  const tag = String(formData.get('tag') || '')
  if (!teamId || !TEAM_SANCTION_TAGS.includes(tag as TeamSanctionTag)) {
    redirect('/admin?tab=teams&error=1')
  }

  const team = await db.team.findUnique({ where: { id: teamId }, select: { sanctionTags: true } })
  if (!team) redirect('/admin?tab=teams&error=1')

  try {
    const current = team.sanctionTags || []
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    await db.team.update({ where: { id: teamId }, data: { sanctionTags: next } })
  } catch (error) {
    console.error('Failed to toggle team sanction:', error)
    redirect('/admin?tab=teams&error=action-failed')
  }

  invalidateCache(['teams_dashboard'])
  revalidatePath('/admin')
  redirect('/admin?tab=teams&updated=1')
}

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
    redirect('/admin?tab=teams&error=action-failed')
  }

  invalidateCache(['teams_dashboard', 'platform_drivers'])
  revalidatePath('/admin')
  revalidatePath('/equipos')
  redirect('/admin?tab=teams&updated=1')
}

export async function restoreTeamAction(formData: FormData) {
  const session = await guardPlatformAdmin()
  const teamId = String(formData.get('teamId') || '')
  if (!teamId) redirect('/admin?error=missing-fields')

  try {
    const team = await db.team.update({ where: { id: teamId }, data: { deletedAt: null } })
    await logAudit({ actor: session, action: 'team.restore', entityType: 'team', entityId: teamId, entityLabel: team.name })
  } catch (error) {
    console.error('Failed to restore team:', error)
  }

  invalidateCache(['teams_dashboard', 'platform_leagues', 'platform_drivers'])
  revalidatePath('/admin')
  revalidatePath('/equipos')
  redirect('/admin?tab=papelera&restored=1')
}

// Actually deletes the team (and, via cascade, everything under it) — only ever reachable
// from the papelera on a team that's already soft-deleted, as a deliberate second step.
export async function permanentlyDeleteTeamAction(formData: FormData) {
  const session = await guardPlatformAdmin()
  const teamId = String(formData.get('teamId') || '')
  if (!teamId) redirect('/admin?error=missing-fields')

  try {
    const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true } })
    await db.$transaction([
      db.leagueRegistration.deleteMany({ where: { teamId } }),
      db.marketListing.deleteMany({ where: { teamId } }),
      db.marketApplication.deleteMany({ where: { teamId } }),
    ])
    // Everything else (cars, members, invites, team registrations, skin
    // assignments, team points) cascades from the team via FK.
    await db.team.delete({ where: { id: teamId } })
    await logAudit({ actor: session, action: 'team.purge', entityType: 'team', entityId: teamId, entityLabel: team?.name })
  } catch (error) {
    console.error('Failed to permanently delete team:', error)
  }

  invalidateCache(['teams_dashboard', 'platform_leagues', 'platform_drivers'])
  revalidatePath('/admin')
  redirect('/admin?tab=papelera&purged=1')
}
