'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  canAccessPlatformAdmin,
  canManageLeague,
  canStewardLeague,
  getCurrentUser,
  getLeagueRole,
  getPlatformRole,
} from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { invalidateCache } from '@/lib/ttl-cache'
import type { LeagueRole } from '@/types'

export async function guardPlatformAdmin() {
  const session = await getCurrentUser()
  const role = await getPlatformRole(session?.userId)
  if (!session || !canAccessPlatformAdmin(role)) redirect('/perfil')
  return session
}

function parseClassTags(formData: FormData) {
  const fromButtons = formData
    .getAll('classTags')
    .map((entry) => String(entry || '').trim().toUpperCase())
    .filter(Boolean)
  const fromText = String(formData.get('customClassTags') || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
  return Array.from(new Set([...fromButtons, ...fromText])).slice(0, 8)
}

export async function createLeague(formData: FormData) {
  const session = await guardPlatformAdmin()

  const title = String(formData.get('title') || '')
  const slug = String(formData.get('slug') || '')
  const classTags = parseClassTags(formData)

  const payload = {
    title,
    slug,
    short_description: String(formData.get('shortDescription') || ''),
    full_description: String(formData.get('fullDescription') || ''),
    simulator: String(formData.get('simulator') || 'ac'),
    format: String(formData.get('format') || 'sprint'),
    status: String(formData.get('status') || 'draft'),
    banner_url: String(formData.get('bannerUrl') || ''),
    is_featured: formData.get('featured') === 'on',
    registration_open: formData.get('registrationOpen') === 'on',
    registration_mode: String(formData.get('registrationMode') || 'individual'),
    class_tags: classTags,
    created_at: new Date(),
  }

  let createdViaFirestore = false
  let leagueId = ''

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const docRef = await runWithTimeout(db.collection('leagues').add(payload), 3500)
        leagueId = docRef.id

        await runWithTimeout(db.collection('league_members').doc(`${leagueId}_${session.userId}`).set({
          league_id: leagueId,
          user_id: session.userId,
          role: 'league_owner',
          created_at: new Date(),
        }), 3500)

        createdViaFirestore = true
      } catch (error) {
        console.error('Failed to create league in Firestore (falling back to mock):', error)
      }
    }
  }

  if (!createdViaFirestore) {
    // Fallback Mock Mode cookie creation
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existingCookie = cookieStore.get('mock_leagues')?.value
      
      let currentLeagues = []
      if (existingCookie) {
        currentLeagues = JSON.parse(existingCookie)
      } else {
        const { leagues: defaultLeagues } = await import('@/data/mock')
        currentLeagues = [...defaultLeagues]
      }

      const mockLeagueId = `mock_league_${Date.now()}`
      const newLeague = {
        id: mockLeagueId,
        title,
        slug,
        simulator: payload.simulator,
        format: payload.format,
        classTags: classTags,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        registrationOpen: payload.registration_open,
        bannerUrl: payload.banner_url || null,
        logoUrl: null,
        status: payload.status,
        featured: payload.is_featured,
        registrationMode: payload.registration_mode,
        shortDescription: payload.short_description,
      }

      currentLeagues.push(newLeague)
      cookieStore.set('mock_leagues', JSON.stringify(currentLeagues), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
    } catch (e) {
      console.error('Failed to create mock league in fallback:', e)
    }
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  redirect('/admin?created=1')
}

export async function guardLeaguePermission(leagueId: string, required: 'manage' | 'steward') {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const platformRole = await getPlatformRole(session.userId)
  if (canAccessPlatformAdmin(platformRole)) {
    return { session, platformRole, leagueRole: null as LeagueRole | null }
  }

  const leagueRole = await getLeagueRole(leagueId, session.userId)
  const allowed = required === 'manage' ? canManageLeague(leagueRole) : canStewardLeague(leagueRole)

  if (!allowed) redirect('/admin')

  return { session, platformRole, leagueRole }
}

export async function updateLeague(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  await guardLeaguePermission(leagueId, 'manage')

  if (!hasFirebase) redirect('/admin?mode=mock')
  const db = getFirestoreDb()
  if (!db) redirect('/admin?mode=mock')

  const payload = {
    title: String(formData.get('title') || ''),
    slug: String(formData.get('slug') || ''),
    short_description: String(formData.get('shortDescription') || ''),
    full_description: String(formData.get('fullDescription') || ''),
    simulator: String(formData.get('simulator') || 'ac'),
    format: String(formData.get('format') || 'sprint'),
    status: String(formData.get('status') || 'draft'),
    banner_url: String(formData.get('bannerUrl') || ''),
    is_featured: formData.get('featured') === 'on',
    registration_open: formData.get('registrationOpen') === 'on',
    registration_mode: String(formData.get('registrationMode') || 'individual'),
    class_tags: parseClassTags(formData),
  }

  try {
    await db.collection('leagues').doc(leagueId).update(payload)
  } catch (error) {
    console.error('Failed to update league in Firestore:', error)
    redirect(`/admin/ligas/${leagueId}?leagueError=update-failed`)
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(`/admin/ligas/${leagueId}?leagueUpdated=1`)
}

export async function quickUpdateLeagueStatusAction(formData: FormData) {
  const session = await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')
  const status = String(formData.get('status') || 'draft')

  if (!leagueId) redirect('/admin?error=missing-fields')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        await db.collection('leagues').doc(leagueId).update({ status })
      } catch (error) {
        console.error('Failed to update status in Firestore:', error)
      }
    }
  } else {
    // Mock Mode
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_leagues')?.value
      let current = existing ? JSON.parse(existing) : []
      current = current.map((l: any) => l.id === leagueId ? { ...l, status } : l)
      cookieStore.set('mock_leagues', JSON.stringify(current), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    } catch {}
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect('/admin?tab=leagues&updated=1')
}

export async function quickToggleLeagueRegistrationAction(formData: FormData) {
  const session = await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')

  if (!leagueId) redirect('/admin?error=missing-fields')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const docRef = db.collection('leagues').doc(leagueId)
        const doc = await docRef.get()
        if (doc.exists) {
          const current = Boolean(doc.data()?.registration_open)
          await docRef.update({ registration_open: !current })
        }
      } catch (error) {
        console.error('Failed to toggle registration in Firestore:', error)
      }
    }
  } else {
    // Mock Mode
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_leagues')?.value
      let current = existing ? JSON.parse(existing) : []
      current = current.map((l: any) => l.id === leagueId ? { ...l, registrationOpen: !l.registrationOpen } : l)
      cookieStore.set('mock_leagues', JSON.stringify(current), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    } catch {}
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect('/admin?tab=leagues&updated=1')
}

export async function quickToggleLeagueFeaturedAction(formData: FormData) {
  const session = await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')

  if (!leagueId) redirect('/admin?error=missing-fields')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const docRef = db.collection('leagues').doc(leagueId)
        const doc = await docRef.get()
        if (doc.exists) {
          const current = Boolean(doc.data()?.is_featured)
          await docRef.update({ is_featured: !current })
        }
      } catch (error) {
        console.error('Failed to toggle featured in Firestore:', error)
      }
    }
  } else {
    // Mock Mode
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_leagues')?.value
      let current = existing ? JSON.parse(existing) : []
      current = current.map((l: any) => l.id === leagueId ? { ...l, featured: !l.featured } : l)
      cookieStore.set('mock_leagues', JSON.stringify(current), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    } catch {}
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect('/admin?tab=leagues&updated=1')
}

export async function deleteLeagueAction(formData: FormData) {
  const session = await guardPlatformAdmin()
  const leagueId = String(formData.get('leagueId') || '')

  if (!leagueId) redirect('/admin?error=missing-fields')

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const batch = db.batch()

        // 1. Delete league members
        const membersSnap = await db.collection('league_members').where('league_id', '==', leagueId).get()
        membersSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 2. Delete league events
        const eventsSnap = await db.collection('league_events').where('league_id', '==', leagueId).get()
        eventsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 3. Delete registrations
        const registrationsSnap = await db.collection('league_registrations').where('league_id', '==', leagueId).get()
        registrationsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 4. Delete team registrations if any exist
        const teamRegsSnap = await db.collection('league_team_registrations').where('league_id', '==', leagueId).get()
        teamRegsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 5. Delete results
        const resultsSnap = await db.collection('league_results').where('league_id', '==', leagueId).get()
        resultsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 6. Delete result imports
        const importsSnap = await db.collection('league_result_imports').where('league_id', '==', leagueId).get()
        importsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 7. Delete cars
        const carsSnap = await db.collection('league_cars').where('league_id', '==', leagueId).get()
        carsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 8. Delete league itself
        batch.delete(db.collection('leagues').doc(leagueId))

        await batch.commit()
      } catch (error) {
        console.error('Failed to delete league in Firestore:', error)
      }
    }
  }

  // ALWAYS filter and update the mock_leagues cookie so that the league is removed even if we combine with mock fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existing = cookieStore.get('mock_leagues')?.value
    
    let current = []
    if (existing) {
      current = JSON.parse(existing)
    } else {
      const { leagues: defaultLeagues } = await import('@/data/mock')
      current = [...defaultLeagues]
    }

    current = current.filter((l: any) => l.id !== leagueId)
    cookieStore.set('mock_leagues', JSON.stringify(current), { path: '/', maxAge: 60 * 60 * 24 * 30 })
  } catch (e) {
    console.error('Failed to update mock_leagues cookie on admin deletion:', e)
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/admin')
  revalidatePath('/ligas')
  redirect('/admin?tab=leagues&updated=1')
}