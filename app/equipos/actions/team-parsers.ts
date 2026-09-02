import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export function parseSkinUrls(value: FormDataEntryValue | null) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

export function parseSkinAssignments(value: FormDataEntryValue | null) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [leagueSlugRaw, carNumberRaw, ...skinParts] = line.split('|')
      const leagueSlug = String(leagueSlugRaw || '').trim().toLowerCase()
      const carNumber = Number(String(carNumberRaw || '').trim())
      const skinUrl = skinParts.join('|').trim()
      if (!leagueSlug || !Number.isInteger(carNumber) || carNumber < 0 || carNumber > 999 || !skinUrl) return null
      return { leagueSlug, carNumber, skinUrl }
    })
    .filter((item): item is { leagueSlug: string; carNumber: number; skinUrl: string } => Boolean(item))
    .slice(0, 64)
}

export function parseSkinProfilesJson(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized = parsed
      .map((item) => {
        const row = item as { skinUrl?: unknown; leagueSlug?: unknown; carNumber?: unknown; label?: unknown }
        const skinUrl = String(row.skinUrl || '').trim()
        const leagueSlug = String(row.leagueSlug || '').trim().toLowerCase()
        const carNumber = String(row.carNumber || row.label || '').trim()
        if (!skinUrl) return null
        return { leagueSlug, skinUrl, carNumber }
      })
      .filter((item): item is { leagueSlug: string; skinUrl: string; carNumber: string } => Boolean(item))
      .slice(0, 64)
    return normalized
  } catch {
    return []
  }
}

export async function guardSession() {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')
  return session
}

export async function canManageTeam(teamId: string, userId: string) {
  try {
    const { getAdminAccessContext } = await import('@/lib/auth')
    const access = await getAdminAccessContext(userId)
    if (access.canAccessPlatformAdmin) return true
  } catch {}

  try {
    const team = await db.team.findUnique({ where: { id: teamId }, include: { members: true } })
    if (!team) return false
    if (team.ownerUserId === userId) return true
    const member = team.members.find((m) => m.userId === userId)
    return member?.role === 'owner' || member?.role === 'manager'
  } catch (err) {
    console.error('Error checking canManageTeam:', err)
    return false
  }
}

export function cleanPilotName(carNumber: string): string {
  const parts = carNumber.split('-');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return carNumber.trim();
}

export function parseCarNumber(dorsal: any): number {
  if (dorsal == null) return 0;
  const str = String(dorsal).replace(/[^0-9]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num
}