'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, getAdminAccessContext, canStewardLeague } from '@/lib/auth'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import { getTeamsDashboard } from '@/lib/team-data'

export async function getEventResultsAction(leagueId: string, eventId: string, sessionType: 'qualifying' | 'race' = 'race') {
  return fetchWithTTLCache(`event_results_${eventId}_${sessionType}`, async () => {
    if (hasFirebase) {
      const db = getFirestoreDb()
      if (db) {
        try {
          const snap = await db.collection('league_results')
            .where('event_id', '==', eventId)
            .get()

          if (!snap.empty) {
            const rawDocs = snap.docs
              .map((d: any) => ({ id: d.id, ...d.data() }))
              .filter((d: any) => {
                const sType = d.session_type || d.sessionType || 'race'
                return sType === sessionType
              })

            if (rawDocs.length > 0) {
              const userIds = Array.from(new Set(rawDocs.map((r: any) => r.user_id).filter(Boolean)))

              const [{ teams }, profilesSnap, steamSnap] = await Promise.all([
                getTeamsDashboard(),
                userIds.length > 0 ? db.collection('profiles').where('user_id', 'in', userIds.slice(0, 10)).get() : null,
                userIds.length > 0 ? db.collection('steam_accounts').where('user_id', 'in', userIds.slice(0, 10)).get() : null,
              ])

            const profilesMap = new Map<string, string>(
              profilesSnap ? profilesSnap.docs.map((d: any) => [d.data().user_id, d.data().display_name]) : []
            )
            const steamMap = new Map<string, { steamId: string; name: string }>(
              steamSnap ? steamSnap.docs.map((d: any) => [d.data().user_id, { steamId: d.data().steam_id, name: d.data().steam_display_name }]) : []
            )

            const teamsList = teams || []

            return rawDocs.map((row: any) => {
              const uid = row.user_id || ''
              const profName = profilesMap.get(uid)
              const stm = steamMap.get(uid)
              const dName = profName || stm?.name || row.driver_name || row.displayName || (uid ? `Driver ${uid.slice(0, 4)}` : 'Driver')
              const sId = stm?.steamId || row.steam_id || row.steamId || ''

              let tName = row.team_name || row.teamName || 'Independent'
              if (!row.team_name) {
                const matchedTeam = teamsList.find((t: any) =>
                  t.members?.some((m: any) => m.userId === uid || m.user_id === uid)
                )
                if (matchedTeam) tName = matchedTeam.name
              }

              return {
                id: row.id,
                sessionType: row.session_type || row.sessionType || 'race',
                position: Number(row.position || 0),
                driverName: dName,
                teamName: tName,
                steamId: sId,
                classTag: String(row.class_tag || row.classTag || row.category || 'GT3').toUpperCase(),
                dorsal: row.dorsal ? String(row.dorsal) : (row.car_number ? String(row.car_number) : null),
                points: row.points != null ? Number(row.points) : 0,
                lapTime: row.lap_time || row.lapTime || null,
                raceTime: row.race_time || row.raceTime || null,
              }
            }).sort((a: any, b: any) => a.position - b.position)
          }
        }
      } catch (err) {
        console.error('Failed to load event results from Firestore:', err)
      }
    }
  }

  return []
  }, 60)
}

export async function updateTeamPointsAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  const isSteward = canStewardLeague(access.platformRole)
  if (!access.canAccessPlatformAdmin && !isSteward) {
    throw new Error('Unauthorized: Only Admins and Stewards can modify team points.')
  }

  const leagueId = String(formData.get('leagueId') || '').trim()
  const classTag = String(formData.get('classTag') || 'GT3').trim().toUpperCase()
  const teamId = String(formData.get('teamId') || '').trim()
  const points = Math.max(0, parseInt(String(formData.get('points') || '0'), 10) || 0)
  const slug = String(formData.get('slug') || '')

  if (!leagueId || !teamId) throw new Error('Missing parameters')

  const docId = `${leagueId}_${classTag}_${teamId}`

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        await runWithTimeout(
          db.collection('league_team_points').doc(docId).set({
            league_id: leagueId,
            class_tag: classTag,
            team_id: teamId,
            points: points,
            updated_at: new Date(),
            updated_by: session.userId,
          }, { merge: true }),
          3000
        )
      } catch (err) {
        console.error('Failed to update team points in Firestore:', err)
      }
    }
  }

  // Mock / Cookie Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const cookieKey = `mock_team_points_${leagueId}`
    const existingStr = cookieStore.get(cookieKey)?.value
    const pointsMap = existingStr ? JSON.parse(existingStr) : {}
    pointsMap[`${classTag}_${teamId}`] = points
    cookieStore.set(cookieKey, JSON.stringify(pointsMap), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  } catch (e) {
    console.error('Failed to update mock team points cookie:', e)
  }

  if (slug) {
    revalidatePath(`/ligas/${slug}`)
  }
}

