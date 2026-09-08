'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getAdminAccessContext, getLeagueRole, canStewardLeague } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { zonedWallTimeToUtc } from '@/lib/utils'

export async function createCalendarNoteAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Unauthorized: No active session found.' }

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin) {
    return { success: false, error: 'Forbidden: Only platform admins can add calendar notes.' }
  }

  const title = String(formData.get('title') || '').trim()
  const dateStr = String(formData.get('date') || '').trim()
  if (!title || !dateStr) return { success: false, error: 'Title and date are required.' }

  try {
    await db.calendarNote.create({ data: { title, date: new Date(`${dateStr}T00:00:00.000Z`) } })
    invalidateCache(['calendar_notes'])
    revalidatePath('/calendario')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to create calendar note:', error)
    return { success: false, error: error.message || 'An unexpected database error occurred.' }
  }
}

export async function deleteCalendarNoteAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) return { success: false, error: 'Unauthorized: No active session found.' }

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin) {
    return { success: false, error: 'Forbidden: Only platform admins can delete calendar notes.' }
  }

  const id = String(formData.get('id') || '').trim()
  if (!id) return { success: false, error: 'Missing note id.' }

  try {
    await db.calendarNote.delete({ where: { id } })
    invalidateCache(['calendar_notes'])
    revalidatePath('/calendario')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete calendar note:', error)
    return { success: false, error: error.message || 'An unexpected database error occurred.' }
  }
}

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
    const maxDriversRaw = formData.get('maxDrivers')
    const maxDrivers = maxDriversRaw ? Number(maxDriversRaw) : null

    const classLimits: Record<string, number> = {}
    for (const [key, val] of formData.entries()) {
      if (key.startsWith('max_cars_') && val) {
        const cat = key.slice('max_cars_'.length)
        const num = Number(val)
        if (Number.isFinite(num) && num > 0) classLimits[cat] = num
      }
    }

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
    const qualyStartsAtTime = String(formData.get('qualyStartsAtTime') || '19:30').trim()
    const qualyEndsAtTime = String(formData.get('qualyEndsAtTime') || '20:00').trim()

    // Always derived from the raw date + time-of-day fields (entered as Spanish wall-clock
    // time) rather than the pre-combined ISO strings the client also sends — those are naive
    // and would get parsed in whatever timezone the Node process happens to run under.
    const payload = {
      leagueId,
      title: title || null,
      circuitName,
      circuitImageUrl: circuitImageUrl || null,
      serverLink: serverLink || null,
      eventType: eventType as any,
      countryCode: countryCode || null,
      color: color || null,
      maxDrivers,
      hasQualy,
      qualyStartsAt: hasQualy ? zonedWallTimeToUtc(qualyDateStr, qualyStartsAtTime) : null,
      qualyEndsAt: hasQualy ? zonedWallTimeToUtc(qualyDateStr, qualyEndsAtTime) : null,
      startsAt: zonedWallTimeToUtc(dateStr, startsAtTime),
      endsAt: zonedWallTimeToUtc(dateStr, endsAtTime),
    }

    const event = eventId
      ? await db.leagueEvent.upsert({
          where: { id: eventId },
          create: { id: eventId, ...payload, status: 'scheduled' },
          update: payload,
        })
      : await db.leagueEvent.create({ data: { ...payload, status: 'scheduled' } })

    await db.leagueClassLimit.deleteMany({ where: { eventId: event.id } })
    const limitEntries = Object.entries(classLimits)
    if (limitEntries.length > 0) {
      await db.leagueClassLimit.createMany({
        data: limitEntries.map(([classTag, maxCars]) => ({ leagueId, eventId: event.id, classTag, maxCars })),
      })
    }

    invalidateCache(['league_events_'])
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

    const event = await db.leagueEvent.findUnique({ where: { id: eventId } })
    if (!event) return { success: false, error: 'Event not found.' }

    const access = await getAdminAccessContext(session.userId)
    const isPlatformAdmin = access.canAccessPlatformAdmin

    let isLeagueAuthorized = false
    if (event.leagueId) {
      const leagueRole = await getLeagueRole(event.leagueId, session.userId)
      isLeagueAuthorized = canStewardLeague(leagueRole)
    }

    if (!isPlatformAdmin && !isLeagueAuthorized) {
      return { success: false, error: 'Forbidden: Only platform admins or league stewards can delete events.' }
    }

    await db.leagueEvent.delete({ where: { id: eventId } })

    invalidateCache(['league_events_'])
    revalidatePath('/calendario')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete calendar event:', error)
    return { success: false, error: error.message || 'An unexpected database error occurred.' }
  }
}
