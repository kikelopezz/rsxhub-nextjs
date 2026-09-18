import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { getCurrentUser, getPlatformRole } from '@/lib/auth'

/**
 * Acceso a la seccion de Tickets del admin: los super admins siempre, y el resto solo si
 * un super admin los ha anadido a la lista (por Steam ID). Ser admin de plataforma NO basta.
 */
export async function getTicketGrantedSteamIds(): Promise<string[]> {
  return fetchWithTTLCache('ticket_access_steam_ids', async () => {
    try {
      const grants = await db.ticketAccessGrant.findMany({ select: { steamId: true } })
      return grants.map((g) => g.steamId)
    } catch (error) {
      console.error('Failed to fetch ticket access grants:', error)
      return []
    }
  }, 20)
}

export const getTicketAccess = cache(async () => {
  const session = await getCurrentUser()
  if (!session) return { session: null, canAccess: false, isSuperAdmin: false }

  const role = await getPlatformRole(session.userId)
  const isSuperAdmin = role === 'super_admin'
  const canAccess = isSuperAdmin || (await getTicketGrantedSteamIds()).includes(session.steamId)
  return { session, canAccess, isSuperAdmin }
})

export async function guardTicketAccess() {
  const access = await getTicketAccess()
  if (!access.session || !access.canAccess) redirect('/perfil')
  return { session: access.session, isSuperAdmin: access.isSuperAdmin }
}

export async function guardTicketSuperAdmin() {
  const access = await guardTicketAccess()
  if (!access.isSuperAdmin) redirect('/admin/tickets')
  return access.session
}
