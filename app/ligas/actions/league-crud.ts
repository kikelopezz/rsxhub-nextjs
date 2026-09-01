'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser, getAdminAccessContext, getLeagueRole, canManageLeague } from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { invalidateCache } from '@/lib/ttl-cache'

export async function createLeagueAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin) throw new Error('Forbidden')

  const title = String(formData.get('title') || '').trim()
  const simulator = String(formData.get('simulator') || 'ac').trim()
  const format = String(formData.get('format') || 'sprint').trim()
  const classTagsRaw = String(formData.get('classTags') || 'GT3').trim()
  const startsAt = String(formData.get('startsAt') || '').trim()
  const endsAt = String(formData.get('endsAt') || '').trim()
  const registrationOpen = formData.has('registrationOpen') ? formData.get('registrationOpen') === 'true' : true
  const bannerUrl = String(formData.get('bannerUrl') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim()
  const accentColor = String(formData.get('accentColor') || '').trim()
  const slogan = String(formData.get('slogan') || '').trim()
  const discordUrl = String(formData.get('discordUrl') || '').trim()
  const youtubeUrl = String(formData.get('youtubeUrl') || '').trim()
  const rulebookUrl = String(formData.get('rulebookUrl') || '').trim()

  if (!title || !startsAt || !endsAt) {
    throw new Error('Title, Start Date, and End Date are required.')
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

  const payload = {
    title,
    slug,
    simulator,
    format,
    class_tags: classTagsRaw.split(',').map((tag) => tag.trim().toUpperCase()).filter(Boolean),
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    registration_open: registrationOpen,
    banner_url: bannerUrl || null,
    logo_url: logoUrl || null,
    accent_color: accentColor || null,
    slogan: slogan || null,
    discord_url: discordUrl || null,
    youtube_url: youtubeUrl || null,
    rulebook_url: rulebookUrl || null,
    status: 'open',
    is_featured: false,
    registration_mode: 'individual',
  }

  let createdViaFirestore = false

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const docRef = db.collection('leagues').doc()
        await runWithTimeout(docRef.set({
          id: docRef.id,
          ...payload,
        }), 3500)
        createdViaFirestore = true
      } catch (error) {
        console.error('Failed to create league in Firestore (falling back to mock cookies):', error)
      }
    }
  }

  if (!createdViaFirestore) {
    // Mock Mode Fallback
    try {
      const cookieStore = await cookies()
      const existingCookie = cookieStore.get('mock_leagues')?.value
      
      let currentLeagues = []
      if (existingCookie) {
        currentLeagues = JSON.parse(existingCookie)
      } else {
        const { leagues: defaultLeagues } = await import('@/data/mock')
        currentLeagues = [...defaultLeagues]
      }

      const newLeague = {
        id: `mock_league_${Date.now()}`,
        title,
        slug,
        simulator,
        format,
        classTags: payload.class_tags,
        startsAt: payload.starts_at,
        endsAt: payload.ends_at,
        registrationOpen,
        bannerUrl: payload.banner_url,
        logoUrl: payload.logo_url,
        accentColor: payload.accent_color,
        slogan: payload.slogan,
        discordUrl: payload.discord_url,
        youtubeUrl: payload.youtube_url,
        rulebookUrl: payload.rulebook_url,
        status: 'open',
        featured: false,
        registrationMode: 'individual',
      }

      currentLeagues.push(newLeague)
      cookieStore.set('mock_leagues', JSON.stringify(currentLeagues), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    } catch (e) {
      console.error('Failed to create mock league:', e)
    }
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/ligas')
  revalidatePath('/admin')
}

export async function updateLeagueDetailsAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const leagueId = String(formData.get('leagueId') || '').trim()
  if (!leagueId) {
    throw new Error('League ID is required.')
  }

  const access = await getAdminAccessContext(session.userId)
  const isPlatformAdmin = access.canAccessPlatformAdmin

  const leagueRole = await getLeagueRole(leagueId, session.userId)
  const isLeagueManager = canManageLeague(leagueRole)

  if (!isPlatformAdmin && !isLeagueManager) {
    throw new Error('Forbidden: Only platform admins or league managers can customize league settings.')
  }

  const title = String(formData.get('title') || '').trim()
  const slug = String(formData.get('slug') || '').trim()
  const simulator = String(formData.get('simulator') || 'ac').trim()
  const format = String(formData.get('format') || 'sprint').trim()
  const status = String(formData.get('status') || 'open').trim()
  const registrationMode = String(formData.get('registrationMode') || 'team').trim()
  const classTagsRaw = String(formData.get('classTags') || '').trim()
  const startsAt = String(formData.get('startsAt') || '').trim()
  const endsAt = String(formData.get('endsAt') || '').trim()
  const registrationOpen = status === 'open'
  const bannerUrl = String(formData.get('bannerUrl') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim()
  const accentColor = String(formData.get('accentColor') || '').trim()
  const slogan = String(formData.get('slogan') || '').trim()
  const discordUrl = String(formData.get('discordUrl') || '').trim()
  const youtubeUrl = String(formData.get('youtubeUrl') || '').trim()
  const rulebookUrl = String(formData.get('rulebookUrl') || '').trim()

  if (!leagueId || !startsAt || !endsAt) {
    throw new Error('League ID, Start Date, and End Date are required.')
  }

  const classTags = classTagsRaw
    ? classTagsRaw.split(',').map((tag) => tag.trim().toUpperCase()).filter(Boolean)
    : undefined

  const payload: any = {
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    registration_open: registrationOpen,
    banner_url: bannerUrl || null,
    logo_url: logoUrl || null,
    accent_color: accentColor || null,
    slogan: slogan || null,
    discord_url: discordUrl || null,
    youtube_url: youtubeUrl || null,
    rulebook_url: rulebookUrl || null,
  }

  if (title) payload.title = title
  if (slug) payload.slug = slug
  if (simulator) payload.simulator = simulator
  if (format) payload.format = format
  if (status) payload.status = status
  if (registrationMode) payload.registration_mode = registrationMode
  if (classTags) payload.class_tags = classTags

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      await db.collection('leagues').doc(leagueId).update(payload)
    }
  } else {
    // Mock Mode Fallback
    try {
      const cookieStore = await cookies()
      const existingCookie = cookieStore.get('mock_leagues')?.value
      
      let currentLeagues = []
      if (existingCookie) {
        currentLeagues = JSON.parse(existingCookie)
      } else {
        const { leagues: defaultLeagues } = await import('@/data/mock')
        currentLeagues = [...defaultLeagues]
      }

      currentLeagues = currentLeagues.map((lg: any) => {
        if (lg.id === leagueId) {
          return {
            ...lg,
            title: title || lg.title,
            slug: slug || lg.slug,
            simulator: simulator || lg.simulator,
            format: format || lg.format,
            status: status || lg.status,
            registrationMode: registrationMode || lg.registrationMode,
            classTags: classTags || lg.classTags,
            startsAt: payload.starts_at,
            endsAt: payload.ends_at,
            registrationOpen,
            bannerUrl: payload.banner_url,
            logoUrl: payload.logo_url,
            accentColor: payload.accent_color,
            slogan: payload.slogan,
            discordUrl: payload.discord_url,
            youtubeUrl: payload.youtube_url,
            rulebookUrl: payload.rulebook_url,
          }
        }
        return lg
      })

      cookieStore.set('mock_leagues', JSON.stringify(currentLeagues), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    } catch (e) {
      console.error('Failed to update mock league:', e)
    }
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/ligas')
  revalidatePath('/admin')
  if (slug) {
    revalidatePath(`/ligas/${slug}`)
  }
}

export async function deleteLeagueAction(leagueId: string, slug?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin) throw new Error('Forbidden')

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

        // 6. Delete cars
        const carsSnap = await db.collection('league_cars').where('league_id', '==', leagueId).get()
        carsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

        // 7. Delete league itself
        batch.delete(db.collection('leagues').doc(leagueId))

        await batch.commit()
      } catch (error) {
        console.error('Failed to delete Firestore references:', error)
      }
    }
  }

  // ALWAYS filter and update the mock_leagues cookie so that the league is removed even if we combine with mock fallback
  try {
    const cookieStore = await cookies()
    const existingCookie = cookieStore.get('mock_leagues')?.value
    
    let currentLeagues = []
    if (existingCookie) {
      currentLeagues = JSON.parse(existingCookie)
    } else {
      const { leagues: defaultLeagues } = await import('@/data/mock')
      currentLeagues = [...defaultLeagues]
    }

    currentLeagues = currentLeagues.filter((lg: any) => lg.id !== leagueId)
    cookieStore.set('mock_leagues', JSON.stringify(currentLeagues), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  } catch (e) {
    console.error('Failed to update mock_leagues cookie on deletion:', e)
  }

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/ligas')
  revalidatePath('/admin')
  if (slug) {
    revalidatePath(`/ligas/${slug}`)
    redirect('/ligas')
  }
}

