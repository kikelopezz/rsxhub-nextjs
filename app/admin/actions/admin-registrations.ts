'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardLeaguePermission } from './admin-league'

export async function updateRegistrationStatus(formData: FormData) {
  const registrationId = String(formData.get('registrationId') || '')
  const status = String(formData.get('status') || 'pending')
  const leagueId = String(formData.get('leagueId') || '')

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
  redirect(`/admin/ligas/${leagueId}?updated=1`)
}

export async function updateTeamRegistrationStatus(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTagRaw = String(formData.get('classTag') || '')
  const classTag = classTagRaw === '__NULL__' ? null : classTagRaw
  const carNumberRaw = String(formData.get('carNumber') || '')
  const status = String(formData.get('status') || 'pending')

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
  redirect(`/admin/ligas/${leagueId}?updated=1`)
}
