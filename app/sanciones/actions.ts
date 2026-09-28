'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getAdminAccessContext, getCurrentUser } from '@/lib/auth'
import { SANCTION_TYPES } from '@/lib/sanctions'

async function requireLeagueSteward(leagueId: string) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')
  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin && !access.managedLeagueIds.includes(leagueId)) {
    redirect('/sanciones')
  }
  return session
}

export async function createSanctionAction(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  if (!leagueId) redirect('/sanciones')
  const session = await requireLeagueSteward(leagueId)

  const eventId = String(formData.get('eventId') || '').trim() || null
  const teamId = String(formData.get('teamId') || '').trim() || null
  const driverName = String(formData.get('driverName') || '').trim() || null
  let teamNameSnapshot = String(formData.get('teamNameSnapshot') || '').trim() || null
  const sanctionType = String(formData.get('sanctionType') || '')
  const reason = String(formData.get('reason') || '').trim()

  if (!SANCTION_TYPES.includes(sanctionType as (typeof SANCTION_TYPES)[number]) || !reason) {
    redirect(`/sanciones?leagueId=${leagueId}&error=1`)
  }
  if (!driverName && !teamNameSnapshot && !teamId) {
    redirect(`/sanciones?leagueId=${leagueId}&error=missing-target`)
  }

  // Si se eligió un equipo del desplegable pero no se escribió nombre a mano, se guarda el
  // nombre real del equipo ahora mismo (así el historial sigue siendo legible aunque el equipo
  // cambie de nombre más adelante).
  if (teamId && !teamNameSnapshot) {
    const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true } })
    teamNameSnapshot = team?.name || null
  }

  try {
    await db.sanctionRecord.create({
      data: {
        leagueId,
        eventId,
        teamId,
        driverName,
        teamNameSnapshot,
        sanctionType: sanctionType as any,
        reason,
        createdByUserId: session.userId,
        createdByName: session.steamDisplayName,
      },
    })
  } catch (error) {
    console.error('Failed to create sanction record:', error)
    redirect(`/sanciones?leagueId=${leagueId}&error=save-failed`)
  }

  revalidatePath('/sanciones')
  redirect(`/sanciones?leagueId=${leagueId}&created=1`)
}

export async function deleteSanctionAction(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const id = String(formData.get('id') || '')
  if (!leagueId || !id) redirect('/sanciones')
  await requireLeagueSteward(leagueId)

  try {
    await db.sanctionRecord.deleteMany({ where: { id, leagueId } })
  } catch (error) {
    console.error('Failed to delete sanction record:', error)
  }

  revalidatePath('/sanciones')
  redirect(`/sanciones?leagueId=${leagueId}`)
}
