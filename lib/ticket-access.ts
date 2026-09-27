import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'

/**
 * Quién puede entrar en /soporte: los admins de la plataforma, y cualquier steamId al que un
 * super admin le haya dado acceso explícito (tabla `ticket_access_grants`) sin necesidad de ser
 * admin de todo lo demás.
 */
export async function getTicketAccess() {
  const session = await getCurrentUser()
  if (!session) return { canAccess: false, isAdmin: false }

  const access = await getAdminAccessContext(session.userId)
  if (access.canAccessPlatformAdmin) return { canAccess: true, isAdmin: true }

  const grant = await db.ticketAccessGrant.findUnique({ where: { steamId: session.steamId } })
  return { canAccess: Boolean(grant), isAdmin: false }
}

/** Para páginas y server actions: manda a /perfil si no hay sesión, a / si no tiene acceso. */
export async function guardTicketAccess() {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')
  const access = await getTicketAccess()
  if (!access.canAccess) redirect('/')
  return { session, isAdmin: access.isAdmin }
}
