'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { createNotification, notifyTeamInvitation } from '@/lib/notifications-data'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardSession, canManageTeam } from './team-parsers'
import { TEAM_ROLE_TAGS } from '@/app/equipos/[id]/team-utils'

export async function invitePilot(formData: FormData) {
  const session = await guardSession()
  const redirectTo = safeRedirectPath(formData.get('redirectTo'))
  const teamId = String(formData.get('teamId') || '')
  const invitedUserIdFromForm = String(formData.get('invitedUserId') || '').trim()
  const steamIdFromForm = String(formData.get('steamId') || '').trim()
  const message = String(formData.get('message') || '').trim()
  if (!teamId || (!invitedUserIdFromForm && !steamIdFromForm)) redirect(`${redirectTo}?error=invite-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  let invitedUserId: string | null = invitedUserIdFromForm || null
  let steamId = steamIdFromForm

  if (invitedUserId && !steamId) {
    const account = await db.steamAccount.findUnique({ where: { userId: invitedUserId } })
    if (account) steamId = account.steamId
  } else if (!invitedUserId && steamId) {
    const account = await db.steamAccount.findFirst({ where: { steamId } })
    if (account) invitedUserId = account.userId
  }

  if (!steamId) redirect(`${redirectTo}?error=invite-failed`)

  if (invitedUserId) {
    const existingMember = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: invitedUserId } } })
    if (existingMember) redirect(`${redirectTo}?error=already-member`)
  }

  await db.teamInvite.create({
    data: { teamId, invitedByUserId: session.userId, invitedUserId, invitedSteamId: steamId, message: message || null },
  })

  if (invitedUserId) {
    try {
      const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true } })
      const teamName = team?.name || 'Equipo'
      await notifyTeamInvitation({
        invitedUserId,
        teamName,
        message: message || `${teamName} has sent you an invitation to join their team.`,
      })
    } catch (errNotif) {
      console.error('Failed to send team invite notification:', errNotif)
    }
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?invite=1`)
}

export async function removeTeamMember(formData: FormData) {
  const session = await guardSession()
  const redirectTo = safeRedirectPath(formData.get('redirectTo'))
  const teamId = String(formData.get('teamId') || '')
  const memberUserId = String(formData.get('memberUserId') || '')
  if (!teamId || !memberUserId) redirect(`${redirectTo}?error=member-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  const team = await db.team.findUnique({ where: { id: teamId } })
  if (!team) redirect(`${redirectTo}?error=remove-failed`)
  if (team.ownerUserId === memberUserId) redirect(`${redirectTo}?error=owner-protected`)

  const member = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: memberUserId } } })
  const removedDriverName = member?.displayName || 'Driver'

  await db.$transaction([
    db.teamMember.deleteMany({ where: { teamId, userId: memberUserId } }),
    db.leagueRegistration.deleteMany({ where: { teamId, userId: memberUserId } }),
    db.teamCarDriver.deleteMany({ where: { userId: memberUserId, car: { teamId } } }),
    db.marketApplication.deleteMany({ where: { teamId, userId: memberUserId } }),
  ])

  if (team.ownerUserId) {
    await createNotification({
      userId: team.ownerUserId,
      title: 'Driver Departure & Vehicle Update',
      message: `Driver ${removedDriverName} has left team ${team.name}.`,
      link: `/equipos/${teamId}`,
    })
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  revalidatePath('/ligas')
  redirect(`${redirectTo}?memberRemoved=1`)
}

export async function updateTeamMemberRole(formData: FormData) {
  const session = await guardSession()
  const redirectTo = safeRedirectPath(formData.get('redirectTo'))
  const teamId = String(formData.get('teamId') || '')
  const memberUserId = String(formData.get('memberUserId') || '')
  const role = String(formData.get('role') || '').trim().toLowerCase()
  if (!teamId || !memberUserId) redirect(`${redirectTo}?error=member-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  if (role !== 'driver' && role !== 'manager') {
    redirect(`${redirectTo}?error=invalid-role`)
  }

  const team = await db.team.findUnique({ where: { id: teamId } })
  if (!team) redirect(`${redirectTo}?error=role-update-failed`)
  if (team.ownerUserId === memberUserId) redirect(`${redirectTo}?error=owner-protected`)

  try {
    await db.teamMember.update({ where: { teamId_userId: { teamId, userId: memberUserId } }, data: { role: role as any } })
  } catch (error) {
    console.error('Failed to update member role:', error)
    redirect(`${redirectTo}?error=role-update-failed`)
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?roleUpdated=1`)
}

export async function updateTeamMemberTags(formData: FormData) {
  const session = await guardSession()
  const redirectTo = safeRedirectPath(formData.get('redirectTo'))
  const teamId = String(formData.get('teamId') || '')
  const memberUserId = String(formData.get('memberUserId') || '')
  if (!teamId || !memberUserId) redirect(`${redirectTo}?error=member-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  // A member can hold any combination of these badges at once (e.g. engineer + HYPERCAR +
  // GT3) — unlike `role`, this isn't a permission gate, so no single-value restriction here.
  const roleTags = formData.getAll('roleTags').map(String).filter((tag) => (TEAM_ROLE_TAGS as readonly string[]).includes(tag))

  try {
    await db.teamMember.update({ where: { teamId_userId: { teamId, userId: memberUserId } }, data: { roleTags } })
  } catch (error) {
    console.error('Failed to update member role tags:', error)
    redirect(`${redirectTo}?error=role-update-failed`)
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?roleUpdated=1`)
}
