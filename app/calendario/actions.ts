'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getCurrentUser, getAdminAccessContext, getLeagueRole, canStewardLeague } from '@/lib/auth'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { getLeagueEvents } from '@/lib/platform-data'

export async function saveCalendarEvent(formData: FormData) {
  try {
    const session = await getCurrentUser()
    if (!session) return { success: false, error: 'Unauthorized: No active session found.' }

    const eventId = formData.get('eventId') ? String(formData.get('eventId')) : null
    const leagueId = String(formData.get('leagueId') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const circuitName = String(formData.get('circuitName') || '').trim()
    const dateStr = String(formData.get('date') || '').trim() // e.g. YYYY-MM-DD
    const startsAtTime = String(formData.get('startsAtTime') || '20:00').trim() // e.g. HH:MM
    const endsAtTime = String(formData.get('endsAtTime') || '21:30').trim() // e.g. HH:MM
    const circuitImageUrl = String(formData.get('circuitImageUrl') || '').trim()
    const serverLink = String(formData.get('serverLink') || '').trim()
    const eventType = String(formData.get('eventType') || 'race').trim()
    const countryCode = String(formData.get('countryCode') || '').trim()
    const color = String(formData.get('color') || '#00f2fe').trim()

    if (!leagueId || !circuitName || !dateStr) {
      return { success: false, error: 'League, Circuit and Date are required.' }
    }

    const access = await getAdminAccessContext(session.userId)
    const isPlatformAdmin = access.canAccessPlatformAdmin

    let isLeagueAuthorized = false
    if (leagueId) {
      const leagueRole = await getLeagueRole(leagueId, session.userId)
      isLeagueAuthorized = canStewardLeague(leagueRole)
    }

    if (!isPlatformAdmin && !isLeagueAuthorized) {
      return { success: false, error: 'Forbidden: Only platform admins or league stewards can edit league events.' }
    }

    const hasQualy = formData.get('hasQualy') === 'on' || formData.get('hasQualy') === 'true' || formData.get('hasQualy') === '1'
    const qualyDateStr = String(formData.get('qualyDate') || dateStr).trim()
    const qualyStartsAtTime = String(formData.get('qualyStartsAtTime') || '').trim()
    const qualyEndsAtTime = String(formData.get('qualyEndsAtTime') || '').trim()

    const startsAt = formData.get('startsAt') 
      ? String(formData.get('startsAt')).trim()
      : `${dateStr}T${startsAtTime}:00`
    const endsAt = formData.get('endsAt') 
      ? String(formData.get('endsAt')).trim()
      : `${dateStr}T${endsAtTime}:00`

    const rawQualyStarts = formData.get('qualyStartsAt') ? String(formData.get('qualyStartsAt')).trim() : null
    const rawQualyEnds = formData.get('qualyEndsAt') ? String(formData.get('qualyEndsAt')).trim() : null

    const qualyStartsAt = hasQualy
      ? (rawQualyStarts || `${qualyDateStr}T${qualyStartsAtTime || '19:30'}:00`)
      : null
    const qualyEndsAt = hasQualy
      ? (rawQualyEnds || `${qualyDateStr}T${qualyEndsAtTime || '20:00'}:00`)
      : null

    const extractedDate = dateStr || (startsAt ? startsAt.split('T')[0] : '')

    if (!leagueId || !circuitName || !extractedDate) {
      return { success: false, error: 'League, Circuit name and Date are required.' }
    }

    const payload = {
      league_id: leagueId,
      title: title || null,
      circuit_name: circuitName,
      circuit_image_url: circuitImageUrl || null,
      server_link: serverLink || null,
      event_type: eventType,
      country_code: countryCode || null,
      color: color || null,
      has_qualy: hasQualy,
      qualy_starts_at: qualyStartsAt,
      qualy_ends_at: qualyEndsAt,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'scheduled',
    }

    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        if (eventId) {
          // Verify if document exists or use a robust write method
          const docRef = db.collection('league_events').doc(eventId)
          const docSnap = await docRef.get()
          if (!docSnap.exists) {
            // Fallback to set if not found to handle custom IDs or newly created offline syncs gracefully
            await docRef.set({
              id: eventId,
              ...payload,
            })
          } else {
            await docRef.update(payload)
          }
        } else {
          const docRef = db.collection('league_events').doc()
          await docRef.set({
            id: docRef.id,
            ...payload,
          })
        }
      }
    } else {
      // Mock Mode Fallback
      const cookieStore = await cookies()
      const existingCookie = cookieStore.get('mock_league_events')?.value
      
      // Fetch initial events if cookie is empty, so we preserve pre-existing mock events
      let currentEvents = []
      if (existingCookie) {
        currentEvents = JSON.parse(existingCookie)
      } else {
        // Read the default mock events
        const { leagueEvents: defaultEvents } = await import('@/data/mock')
        currentEvents = [...defaultEvents]
      }

      if (eventId) {
        // Edit existing
        currentEvents = currentEvents.map((ev: any) => {
          if (ev.id === eventId) {
            return {
              ...ev,
              leagueId,
              title: title || null,
              circuitName,
              circuitImageUrl: circuitImageUrl || null,
              serverLink: serverLink || null,
              eventType,
              countryCode: countryCode || null,
              color: color || null,
              hasQualy,
              qualyStartsAt,
              qualyEndsAt,
              startsAt,
              endsAt,
            }
          }
          return ev
        })
      } else {
        // Create new
        const newEvent = {
          id: `mock_event_${Date.now()}`,
          leagueId,
          title: title || null,
          circuitName,
          circuitImageUrl: circuitImageUrl || null,
          serverLink: serverLink || null,
          eventType,
          countryCode: countryCode || null,
          color: color || null,
          hasQualy,
          qualyStartsAt,
          qualyEndsAt,
          startsAt,
          endsAt,
          status: 'scheduled',
        }
        currentEvents.push(newEvent)
      }

      cookieStore.set('mock_league_events', JSON.stringify(currentEvents), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    revalidatePath('/calendario')
    revalidatePath(`/ligas/${leagueId}`)
    return { success: true }
  } catch (error: any) {
    console.error('Failed to save calendar event:', error)
    return { success: false, error: error.message || 'An unexpected database error occurred.' }
  }
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    const session = await getCurrentUser()
    if (!session) return { success: false, error: 'Unauthorized: No active session found.' }

    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        const docRef = db.collection('league_events').doc(eventId)
        const docSnap = await docRef.get()
        if (!docSnap.exists) {
          return { success: false, error: 'Event not found.' }
        }
        
        const data = docSnap.data()
        const leagueId = data?.league_id || ''

        const access = await getAdminAccessContext(session.userId)
        const isPlatformAdmin = access.canAccessPlatformAdmin

        let isLeagueAuthorized = false
        if (leagueId) {
          const leagueRole = await getLeagueRole(leagueId, session.userId)
          isLeagueAuthorized = canStewardLeague(leagueRole)
        }

        if (!isPlatformAdmin && !isLeagueAuthorized) {
          return { success: false, error: 'Forbidden: Only platform admins or league stewards can delete events.' }
        }

        await docRef.delete()
      }
    } else {
      // Mock Mode Fallback
      const cookieStore = await cookies()
      const existingCookie = cookieStore.get('mock_league_events')?.value
      let currentEvents = []
      if (existingCookie) {
        currentEvents = JSON.parse(existingCookie)
      } else {
        const { leagueEvents: defaultEvents } = await import('@/data/mock')
        currentEvents = [...defaultEvents]
      }

      currentEvents = currentEvents.filter((ev: any) => ev.id !== eventId)

      cookieStore.set('mock_league_events', JSON.stringify(currentEvents), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    revalidatePath('/calendario')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete calendar event:', error)
    return { success: false, error: error.message || 'An unexpected database error occurred.' }
  }
}
