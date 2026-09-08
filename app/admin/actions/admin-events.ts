'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { zonedWallTimeToUtc } from '@/lib/utils'
import { guardLeaguePermission } from './admin-league'

// `startsAt` comes from an `<input type="datetime-local">` as a naive `YYYY-MM-DDTHH:mm`
// string — always Spanish wall-clock time as typed by the admin — so it's converted via
// the league timezone rather than `new Date()`, which would parse it in whatever timezone
// the Node process happens to run under (UTC on Vercel).
function parseSessionStart(startsAt: string): Date {
  const [dateStr, timeStr] = startsAt.split('T')
  return zonedWallTimeToUtc(dateStr, timeStr)
}

function parseClassLimits(formData: FormData) {
  const classLimits: Record<string, number> = {}
  for (const [key, val] of formData.entries()) {
    if (key.startsWith('max_cars_') && val) {
      const cat = key.slice('max_cars_'.length)
      const num = Number(val)
      if (Number.isFinite(num) && num > 0) classLimits[cat] = num
    }
  }
  return classLimits
}

export async function createEvent(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const { session } = await guardLeaguePermission(leagueId, 'manage')

  const title = String(formData.get('title') || '').trim()
  const startsAtRaw = String(formData.get('startsAt') || '').trim()
  const durationMinutes = Number(formData.get('durationMinutes') || 0)
  if (!title || !startsAtRaw || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    redirect(`/admin/ligas/${leagueId}?eventError=missing-fields`)
  }
  const startsAtDate = parseSessionStart(startsAtRaw)
  if (Number.isNaN(startsAtDate.getTime())) {
    redirect(`/admin/ligas/${leagueId}?eventError=missing-fields`)
  }
  const endsAtDate = new Date(startsAtDate.getTime() + durationMinutes * 60 * 1000)

  const selectedCircuitId = String(formData.get('circuitId') || '')
  const customCircuitName = String(formData.get('customCircuitName') || '').trim()
  const customCircuitImageUrl = String(formData.get('customCircuitImageUrl') || '').trim()
  let circuitId: string | null = null
  let circuitName = ''

  try {
    if (selectedCircuitId === 'custom') {
      if (!customCircuitName || !customCircuitImageUrl) {
        redirect(`/admin/ligas/${leagueId}?eventError=custom-circuit-required`)
      }

      const slug = customCircuitName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      const circuit = await db.circuit.upsert({
        where: { slug },
        create: { name: customCircuitName, slug, imageUrl: customCircuitImageUrl, isSystem: false, createdBy: session.userId },
        update: { name: customCircuitName, imageUrl: customCircuitImageUrl },
      })
      circuitId = circuit.id
      circuitName = customCircuitName
    } else if (selectedCircuitId) {
      const circuit = await db.circuit.findUnique({ where: { id: selectedCircuitId } })
      if (!circuit) {
        redirect(`/admin/ligas/${leagueId}?eventError=circuit-not-found`)
      }
      circuitId = circuit.id
      circuitName = circuit.name
    } else {
      circuitName = String(formData.get('circuitName') || '').trim()
    }

    if (!circuitName) {
      redirect(`/admin/ligas/${leagueId}?eventError=circuit-required`)
    }

    const maxDriversRaw = formData.get('maxDrivers')
    const maxDrivers = maxDriversRaw ? Number(maxDriversRaw) : null
    const classLimits = parseClassLimits(formData)

    const event = await db.leagueEvent.create({
      data: {
        leagueId,
        title,
        circuitId,
        circuitName,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        maxDrivers,
        status: (String(formData.get('status') || 'scheduled')) as any,
      },
    })

    const limitEntries = Object.entries(classLimits)
    if (limitEntries.length > 0) {
      await db.leagueClassLimit.createMany({
        data: limitEntries.map(([classTag, maxCars]) => ({ leagueId, eventId: event.id, classTag, maxCars })),
      })
    }
  } catch (error) {
    console.error('Failed to create event:', error)
    redirect(`/admin/ligas/${leagueId}?eventError=create-failed`)
  }

  invalidateCache(['league_events_', 'circuits'])
  revalidatePath('/admin')
  revalidatePath('/calendario')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(`/admin/ligas/${leagueId}?event=1`)
}

export async function updateEvent(formData: FormData) {
  const leagueId = String(formData.get('leagueId') || '')
  const eventId = String(formData.get('eventId') || '')
  await guardLeaguePermission(leagueId, 'manage')

  const title = String(formData.get('title') || '').trim()
  const circuitName = String(formData.get('circuitName') || '').trim()
  const startsAtRaw = String(formData.get('startsAt') || '').trim()
  const durationMinutes = Number(formData.get('durationMinutes') || 0)
  const status = String(formData.get('status') || 'scheduled').trim()

  if (!eventId || !title || !circuitName || !startsAtRaw || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    redirect(`/admin/ligas/${leagueId}?eventError=update-missing-fields`)
  }
  const startsAtDate = parseSessionStart(startsAtRaw)
  if (Number.isNaN(startsAtDate.getTime())) {
    redirect(`/admin/ligas/${leagueId}?eventError=update-missing-fields`)
  }
  const endsAtDate = new Date(startsAtDate.getTime() + durationMinutes * 60 * 1000)

  const maxDriversRaw = formData.get('maxDrivers')
  const maxDrivers = maxDriversRaw ? Number(maxDriversRaw) : null
  const classLimits = parseClassLimits(formData)

  try {
    await db.leagueEvent.update({
      where: { id: eventId },
      data: {
        title,
        circuitName,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        maxDrivers,
        status: status as any,
      },
    })

    await db.leagueClassLimit.deleteMany({ where: { eventId } })
    const limitEntries = Object.entries(classLimits)
    if (limitEntries.length > 0) {
      await db.leagueClassLimit.createMany({
        data: limitEntries.map(([classTag, maxCars]) => ({ leagueId, eventId, classTag, maxCars })),
      })
    }
  } catch (error) {
    console.error('Failed to update event:', error)
    redirect(`/admin/ligas/${leagueId}?eventError=update-failed`)
  }

  invalidateCache(['league_events_'])
  revalidatePath('/calendario')
  revalidatePath(`/admin/ligas/${leagueId}`)
  redirect(`/admin/ligas/${leagueId}?eventUpdated=1`)
}
