import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'

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
  // Always check platform admin bypass
  try {
    const { getAdminAccessContext } = await import('@/lib/auth')
    const access = await getAdminAccessContext(userId)
    if (access.canAccessPlatformAdmin) return true
  } catch {}

  let foundInFirestore = false
  let allowedInFirestore = false

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const teamDoc = await runWithTimeout(db.collection('teams').doc(teamId).get(), 3000)
        if (teamDoc.exists) {
          foundInFirestore = true
          const team = teamDoc.data()
          if (team?.owner_user_id === userId) {
            allowedInFirestore = true
          } else {
            const memberDoc = await runWithTimeout(db.collection('team_members').doc(`${teamId}_${userId}`).get(), 3000)
            if (memberDoc.exists) {
              const member = memberDoc.data()
              if (member?.role === 'owner' || member?.role === 'manager') {
                allowedInFirestore = true
              }
            }
          }
        }
      } catch (err) {
        console.error('Error checking canManageTeam in Firestore:', err)
      }
    }
  }

  if (foundInFirestore) {
    return allowedInFirestore
  }

  // Fallback: check Mock Mode in cookies
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existing = cookieStore.get('mock_teams')?.value
    if (existing) {
      const current = JSON.parse(existing)
      const mockTeam = current.find((t: any) => t.id === teamId)
      if (mockTeam) {
        if (mockTeam.ownerUserId === userId) return true
        if (Array.isArray(mockTeam.members)) {
          const m = mockTeam.members.find((member: any) => member.userId === userId)
          if (m && (m.role === 'owner' || m.role === 'manager')) return true
        }
      }
    }
  } catch (e) {
    console.error('Error checking canManageTeam in mock cookies:', e)
  }

  return false
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