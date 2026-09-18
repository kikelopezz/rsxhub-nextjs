import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { canAccessPlatformAdmin, getCurrentUser, getPlatformRole } from '@/lib/auth'

/**
 * Acceso a la seccion Soporte (tickets de Discord): los admins de la plataforma siempre, y el
 * resto solo si un admin les ha dado permiso desde el panel de admin (lista por Steam ID).
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
  if (!session) return { session: null, canAccess: false }

  const role = await getPlatformRole(session.userId)
  const canAccess = canAccessPlatformAdmin(role) || (await getTicketGrantedSteamIds()).includes(session.steamId)
  return { session, canAccess }
})

export async function guardTicketAccess() {
  const access = await getTicketAccess()
  if (!access.session || !access.canAccess) redirect('/perfil')
  return { session: access.session }
}
