'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardLeaguePermission } from './admin-league'
import { notifyCarPaymentApproved } from '@/lib/notifications-data'

export async function updateRegistrationStatus(formData: FormData) {
  const registrationId = String(formData.get('registrationId') || '')
  const status = String(formData.get('status') || 'pending')
  const leagueId = String(formData.get('leagueId') || '')
  // Lets callers outside the per-league admin page (e.g. the cross-league Pagos queue)
  // stay where they were instead of always bouncing to /admin/ligas/[id].
  const returnTo = String(formData.get('returnTo') || '') || `/admin/ligas/${leagueId}?updated=1`

  await guardLeaguePermission(leagueId, 'steward')

  try {
    await db.leagueRegistration.update({ where: { id: registrationId }, data: { status: status as any } })
  } catch {
    // registrationId wasn't a row id — fall back to matching by userId within the league.
    await db.leagueRegistration.updateMany({
      where: { leagueId, userId: registrationId },
      data: { status: status as any },
    }).catch((inner) => console.error(inner))
  }

  invalidateCache(['registrations_', 'event_confirmations_'])
  revalidatePath('/admin')
  redirect(returnTo)
}

export async function updateTeamRegistrationStatus(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTagRaw = String(formData.get('classTag') || '')
  const classTag = classTagRaw === '__NULL__' ? null : classTagRaw
  const carNumberRaw = String(formData.get('carNumber') || '')
  const status = String(formData.get('status') || 'pending')
  const returnTo = String(formData.get('returnTo') || '') || `/admin/ligas/${leagueId}?updated=1`

  await guardLeaguePermission(leagueId, 'steward')
  if (!leagueId || !teamId || !carNumberRaw) redirect(`/admin/ligas/${leagueId}?updated=0`)

  const carNumber = Number(carNumberRaw)
  if (!Number.isInteger(carNumber)) redirect(`/admin/ligas/${leagueId}?updated=0`)

  try {
    await db.leagueRegistration.updateMany({
      where: { leagueId, teamId, assignedNumber: carNumber, classTag },
      data: { status: status as any },
    })

    await db.leagueTeamRegistration.updateMany({
      where: { leagueId, teamId, carNumber, classTag },
      data: { status: status as any },
    })
  } catch (error) {
    console.error('Failed to update team registration status:', error)
  }

  invalidateCache(['registrations_', 'event_confirmations_'])
  revalidatePath('/admin')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(returnTo)
}

// Pagos-tab only: confirma/rechaza el pago de UN coche concreto (clase+dorsal) de un equipo en
// una liga — antes aprobaba el equipo entero de golpe (updateTeamPaymentStatus, retirada). Si se
// aprueba, avisa al dueño del equipo con una notificación.
export async function updateCarPaymentStatus(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTagRaw = String(formData.get('classTag') || '')
  const classTag = classTagRaw === '__NULL__' ? null : classTagRaw
  const carNumberRaw = String(formData.get('carNumber') ?? '')
  const status = String(formData.get('status') || 'pending')
  const returnTo = String(formData.get('returnTo') || '') || `/admin/ligas/${leagueId}?updated=1`

  await guardLeaguePermission(leagueId, 'steward')
  if (!leagueId || !teamId || carNumberRaw === '') redirect(`/admin/ligas/${leagueId}?updated=0`)

  const carNumber = Number(carNumberRaw)
  if (!Number.isFinite(carNumber)) redirect(`/admin/ligas/${leagueId}?updated=0`)

  try {
    await db.leagueRegistration.updateMany({
      where: { leagueId, teamId, classTag, assignedNumber: carNumber },
      data: { status: status as any },
    })

    if (status === 'approved') {
      const [team, league] = await Promise.all([
        db.team.findUnique({ where: { id: teamId }, select: { ownerUserId: true } }),
        db.league.findUnique({ where: { id: leagueId }, select: { title: true, slug: true } }),
      ])
      if (team?.ownerUserId && league) {
        await notifyCarPaymentApproved({
          userId: team.ownerUserId,
          leagueTitle: league.title,
          leagueSlug: league.slug,
          classTag,
          carNumber,
        })
      }
    }
  } catch (error) {
    console.error('Failed to update car payment status:', error)
  }

  invalidateCache(['registrations_', 'event_confirmations_'])
  revalidatePath('/admin')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(returnTo)
}
