import { cache } from 'react'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { formatFirestoreValue, parseTextArray } from '@/lib/firestore-utils'
import { fetchWithTTLCache } from '@/lib/ttl-cache'
import type { Team, TeamInvite, TeamMember } from '@/types'

type TeamDashboard = Team & {
  leagueTitle?: string
  competitionClassTags?: string[]
  members: TeamMember[]
  invites: TeamInvite[]
  occupiedSlots: number
}

// formatFirestoreValue and parseTextArray are imported from lib/firestore-utils.ts

function parseSkinAssignments(raw: unknown): Array<{ leagueSlug: string; skinUrl: string; carNumber?: string | null; featured?: boolean }> {
  if (!raw) return []
  let source: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      source = JSON.parse(trimmed)
    } catch {
      return []
    }
  }
  if (!Array.isArray(source)) return []
  return source
    .map((item) => {
      const row = item as { leagueSlug?: unknown; carNumber?: unknown; label?: unknown; skinUrl?: unknown; featured?: unknown }
      const leagueSlug = String(row.leagueSlug || '').trim().toLowerCase()
      const skinUrl = String(row.skinUrl || '').trim()
      const carNumber = String(row.carNumber || row.label || '').trim()
      const featured = Boolean(row.featured)
      if (!skinUrl) return null
      return { leagueSlug, carNumber: carNumber || null, skinUrl, featured }
    })
    .filter((item): item is Exclude<typeof item, null> => item !== null)
}

async function loadMockTeamsDashboard(currentUserId?: string) {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existingCookie = cookieStore.get('mock_teams')?.value
    let currentTeams: any[] = []
    if (existingCookie) {
      currentTeams = JSON.parse(existingCookie)
    }
    
    const teams: TeamDashboard[] = currentTeams.map((t: any) => {
      const ownerId = t.ownerUserId || currentUserId || 'mock_user'
      let ownerDisplayName = 'Team Leader'
      let ownerAvatarUrl: string | null = null
      let ownerSteamId = ownerId.replace('steam_', '')

      // Try to load owner profile info
      const profileCookieName = `mock_profile_${ownerId}`
      const mockProfileStr = cookieStore.get(profileCookieName)?.value || (ownerId === currentUserId ? cookieStore.get('mock_profile')?.value : undefined)
      if (mockProfileStr) {
        try {
          const parsed = JSON.parse(mockProfileStr)
          ownerDisplayName = parsed.display_name || parsed.displayName || ownerDisplayName
          ownerAvatarUrl = parsed.avatar_url || parsed.avatarUrl || null
          if (parsed.steam_id) ownerSteamId = parsed.steam_id
        } catch {}
      }

      if (ownerDisplayName === 'Team Leader') {
        const sessionCookie = cookieStore.get('steam_session')?.value
        if (sessionCookie) {
          try {
            const session = JSON.parse(sessionCookie)
            const sessionUserId = session.userId || `steam_${session.steamId}`
            if (ownerId === sessionUserId) {
              ownerDisplayName = session.steamDisplayName || ownerDisplayName
              ownerAvatarUrl = session.avatarUrl || null
              ownerSteamId = session.steamId || ownerSteamId
            }
          } catch {}
        }
      }

      const defaultMembers = [
        {
          id: `member_${t.id}_owner`,
          teamId: t.id,
          userId: ownerId,
          role: 'owner' as const,
          createdAt: new Date().toISOString(),
          displayName: ownerDisplayName,
          avatarUrl: ownerAvatarUrl,
          steamId: ownerSteamId,
        }
      ]

      const initialMembers = t.members || defaultMembers

      // Resolve profiles and avatars for all members in the list
      const resolvedMembers = initialMembers.map((member: any) => {
        let displayName = member.displayName || 'Driver'
        let avatarUrl = member.avatarUrl || null
        let steamId = member.steamId || member.userId?.replace('steam_', '') || ''

        const mProfileStr = cookieStore.get(`mock_profile_${member.userId}`)?.value || (member.userId === currentUserId ? cookieStore.get('mock_profile')?.value : undefined)
        if (mProfileStr) {
          try {
            const parsed = JSON.parse(mProfileStr)
            displayName = parsed.display_name || parsed.displayName || displayName
            avatarUrl = parsed.avatar_url || parsed.avatarUrl || null
            if (parsed.steam_id) steamId = parsed.steam_id
          } catch {}
        }

        const sessionCookie = cookieStore.get('steam_session')?.value
        let sessionSteamId = ''
        if (sessionCookie) {
          try {
            const session = JSON.parse(sessionCookie)
            if (session.steamId && /^\d{15,18}$/.test(session.steamId)) {
              sessionSteamId = session.steamId
            }
            const sessionUserId = session.userId || `steam_${session.steamId}`
            if (member.userId === sessionUserId || member.userId === currentUserId || member.userId === session.steamId || member.role === 'owner') {
              if (displayName === 'Driver' || displayName === 'Team Leader') {
                displayName = session.steamDisplayName || displayName
              }
              if (!avatarUrl) avatarUrl = session.avatarUrl || null
              if (session.steamId) steamId = session.steamId
            }
          } catch {}
        }

        const appsVal = cookieStore.get('mock_market_applications')?.value
        if (appsVal) {
          try {
            const apps = JSON.parse(appsVal)
            const userApp = apps.find((a: any) => a.userId === member.userId)
            if (userApp) {
              if (displayName === 'Driver' || displayName === 'Team Leader') {
                displayName = userApp.userName || displayName
              }
              if (!avatarUrl) avatarUrl = userApp.userAvatar || null
            }
          } catch {}
        }

        if (!avatarUrl) {
          avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`
        }

        if (!steamId || steamId === 'mock_steam' || !/^\d{15,18}$/.test(steamId)) {
          const isMunCato = String(displayName || member.userId || '').toLowerCase().includes('muncato')
          if (isMunCato) {
            steamId = '76561198341588341'
          } else if (sessionSteamId) {
            steamId = sessionSteamId
          } else {
            const sum = Array.from(String(member.userId || displayName)).reduce((acc, char) => acc + char.charCodeAt(0), 0)
            steamId = `7656119${1000000000 + (sum * 1234567) % 9000000000}`
          }
        }

        return {
          ...member,
          displayName,
          avatarUrl,
          steamId,
        }
      })

      return {
        id: t.id,
        leagueId: t.leagueId || null,
        name: t.name || '',
        description: t.description || null,
        classTags: t.classTags || [],
        primaryColor: t.primaryColor || '#1274de',
        secondaryColor: t.secondaryColor || '#0a0f18',
        accentColor: t.accentColor || t.accent_color || '#00f0ff',
        slogan: t.slogan || null,
        discordUrl: t.discordUrl || null,
        youtubeUrl: t.youtubeUrl || null,
        logoUrl: cookieStore.get(`mock_team_logo_${t.id}`)?.value || t.logoUrl || null,
        bannerUrl: cookieStore.get(`mock_team_banner_${t.id}`)?.value || t.bannerUrl || null,
        carSkinUrls: t.carSkinUrls || [],
        skinAssignments: t.skinAssignments || [],
        cars: (t.cars || []).map((car: any) => ({
          ...car,
          id: car.id || `car_${Math.random().toString(36).substr(2, 9)}`,
          category: String(car.category || 'GT3').toUpperCase(),
          dorsal: String(car.dorsal || '').trim(),
          skinUrl: car.skinUrl || car.skin_url || '',
          driverUserIds: Array.isArray(car.driverUserIds)
            ? car.driverUserIds.filter(Boolean)
            : Array.isArray(car.driver_user_ids)
            ? car.driver_user_ids.filter(Boolean)
            : [],
          driverUserIdsByLeague: car.driverUserIdsByLeague || car.driver_user_ids_by_league || {},
          leagueId: car.leagueId || car.league_id || null,
        })),
        ownerUserId: ownerId,
        maxSlots: t.maxSlots || 4,
        createdAt: t.createdAt || new Date().toISOString(),
        members: resolvedMembers,
        invites: t.invites || [],
        occupiedSlots: resolvedMembers.length,
        competitionClassTags: t.classTags || [],
        // Existing teams created before this field existed are treated as already approved.
        status: t.status || 'approved',
      }
    })

    const myTeamIds = currentUserId
      ? teams
          .filter((t) => t.ownerUserId === currentUserId || (Array.isArray(t.members) && t.members.some((m: any) => m.userId === currentUserId && (m.role === 'owner' || m.role === 'manager'))))
          .map((t) => t.id)
      : []

    return {
      teams,
      myTeamIds,
      mode: 'mock' as const,
    }
  } catch (e) {
    console.error('Failed to load mock teams:', e)
    return {
      teams: [] as TeamDashboard[],
      myTeamIds: [] as string[],
      mode: 'mock' as const,
    }
  }
}

export const getTeamsDashboard = cache(async (currentUserId?: string) => {
  const cacheKey = currentUserId ? `teams_dashboard_${currentUserId}` : 'teams_dashboard_anon'
  return fetchWithTTLCache(cacheKey, async () => {
    if (!hasFirebase) {
      return loadMockTeamsDashboard(currentUserId)
    }

    const db = getFirestoreDb()
    if (!db) {
      return loadMockTeamsDashboard(currentUserId)
    }

  try {
    const snapshot = await runWithTimeout(db.collection('teams').get(), 3000)
    if (snapshot.empty) {
      return {
        teams: [] as TeamDashboard[],
        myTeamIds: [] as string[],
        mode: 'ok' as const,
      }
    }

    const teams: TeamDashboard[] = snapshot.docs.map((doc: any) => {
      const row = doc.data()
      return {
        id: doc.id,
        leagueId: row.league_id || null,
        name: row.name || '',
        description: row.description || null,
        classTags: parseTextArray(row.class_tags).map((item: any) => item.toUpperCase()),
        primaryColor: row.primary_color || null,
        secondaryColor: row.secondary_color || null,
        accentColor: row.accent_color || row.accentColor || '#00f0ff',
        slogan: row.slogan || null,
        discordUrl: row.discord_url || null,
        youtubeUrl: row.youtube_url || null,
        instagramUrl: row.instagram_url || null,
        twitterUrl: row.twitter_url || null,
        twitchUrl: row.twitch_url || null,
        tiktokUrl: row.tiktok_url || null,
        logoUrl: row.logo_url || row.logoUrl || null,
        bannerUrl: row.banner_url || row.bannerUrl || null,
        carSkinUrls: parseTextArray(row.car_skin_urls),
        skinAssignments: parseSkinAssignments(row.skin_assignments),
        cars: (Array.isArray(row.cars) ? row.cars : []).map((car: any) => ({
          ...car,
          id: car.id || `car_${Math.random().toString(36).substr(2, 9)}`,
          category: String(car.category || 'GT3').toUpperCase(),
          dorsal: String(car.dorsal || '').trim(),
          skinUrl: car.skinUrl || car.skin_url || '',
          skinName: car.skinName || car.skin_name || '',
          driverUserIds: Array.isArray(car.driverUserIds)
            ? car.driverUserIds.filter(Boolean)
            : Array.isArray(car.driver_user_ids)
            ? car.driver_user_ids.filter(Boolean)
            : [],
          driverUserIdsByLeague: car.driverUserIdsByLeague || car.driver_user_ids_by_league || {},
          leagueId: car.leagueId || car.league_id || null,
        })),
        ownerUserId: row.owner_user_id || null,
        maxSlots: row.max_slots ? Number(row.max_slots) : null,
        createdAt: formatFirestoreValue(row.created_at) || '',
        members: [],
        invites: [],
        occupiedSlots: 0,
        // Existing teams created before this field existed are treated as already approved.
        status: row.status || 'approved',
      }
    })

    const teamIds = teams.map((team: any) => team.id)
    const leagueIds = Array.from(new Set(teams.map((team: any) => team.leagueId).filter(Boolean))) as string[]

    let membersSnapshotDocs: any[] = []
    let invitesSnapshotDocs: any[] = []
    let regsSnapshotDocs: any[] = []

    if (teamIds.length > 0) {
      try {
        const chunks = []
        for (let i = 0; i < teamIds.length; i += 30) {
          chunks.push(teamIds.slice(i, i + 30))
        }

        const mPromises = chunks.map((chunk) => db.collection('team_members').where('team_id', 'in', chunk).get())
        const iPromises = chunks.map((chunk) => db.collection('team_invites').where('team_id', 'in', chunk).get())
        const rPromises = chunks.map((chunk) => db.collection('league_registrations').where('team_id', 'in', chunk).get())

        const [mSnaps, iSnaps, rSnaps] = await Promise.all([
          Promise.all(mPromises),
          Promise.all(iPromises),
          Promise.all(rPromises)
        ])

        membersSnapshotDocs = mSnaps.flatMap((snap: any) => snap.docs)
        invitesSnapshotDocs = iSnaps.flatMap((snap: any) => snap.docs)
        regsSnapshotDocs = rSnaps.flatMap((snap: any) => snap.docs)
      } catch (err) {
        console.error('Failed to fetch team details, continuing with defaults:', err)
      }
    }

    let leagueSnapshot = { docs: [] } as any
    try {
      if (leagueIds.length > 0) {
        leagueSnapshot = await db.collection('leagues').where('__name__', 'in', leagueIds.slice(0, 30)).get()
      }
    } catch (err) {
      console.error('Failed to fetch league names for teams, continuing:', err)
    }

    const leagueById = new Map<string, string>(
      leagueSnapshot.docs.map((doc: any) => {
        const data = doc.data()
        return [doc.id, data.title || '']
      })
    )

    for (const team of teams) {
      if (team.leagueId) team.leagueTitle = leagueById.get(team.leagueId)
      team.competitionClassTags = []
    }

    const classTagsByTeamId = new Map<string, Set<string>>()
    for (const doc of regsSnapshotDocs) {
      const row = doc.data()
      const teamId = String(row.team_id || '')
      if (!teamId || !teamIds.includes(teamId)) continue
      const classTag = String(row.class_tag || '').trim().toUpperCase()
      if (!classTag) continue
      const current = classTagsByTeamId.get(teamId) || new Set<string>()
      current.add(classTag)
      classTagsByTeamId.set(teamId, current)
    }

    for (const team of teams) {
      team.competitionClassTags = Array.from(classTagsByTeamId.get(team.id) || [])
    }

    // Filter members for active teams
    const membersRows = membersSnapshotDocs
      .map((doc: any) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: data.team_id || '',
          user_id: data.user_id || '',
          role: (data.role || 'driver') as TeamMember['role'],
          display_name: data.display_name || null,
          steam_id: data.steam_id || null,
          avatar_url: data.avatar_url || null,
          created_at: formatFirestoreValue(data.created_at) || '',
        }
      })
      .filter((row: any) => teamIds.includes(row.team_id))

    const userIds = Array.from(new Set(membersRows.map((row: any) => row.user_id)))

    let profilesSnapshot = { docs: [] } as any
    let steamSnapshot = { docs: [] } as any

    if (userIds.length > 0) {
      try {
        // Chunk userIds in groups of 10 for Firestore 'in' queries if needed, but since it is local dashboard, we can query in chunks or just fetch
        // For simplicity, we chunk by 10
        const chunks = []
        for (let i = 0; i < userIds.length; i += 10) {
          chunks.push(userIds.slice(i, i + 10))
        }
        const profilePromises = chunks.map((chunk: any) => db.collection('profiles').where('user_id', 'in', chunk).get().catch(() => ({ docs: [] })))
        const steamPromises1 = chunks.map((chunk: any) => db.collection('steam_accounts').where('user_id', 'in', chunk).get().catch(() => ({ docs: [] })))
        const steamPromises2 = chunks.map((chunk: any) => db.collection('steam_accounts').where('__name__', 'in', chunk).get().catch(() => ({ docs: [] })))

        const pSnaps = await Promise.all(profilePromises)
        const sSnaps1 = await Promise.all(steamPromises1)
        const sSnaps2 = await Promise.all(steamPromises2)

        profilesSnapshot = { docs: pSnaps.flatMap((snap: any) => snap.docs || []) }
        steamSnapshot = { docs: [...sSnaps1.flatMap((snap: any) => snap.docs || []), ...sSnaps2.flatMap((snap: any) => snap.docs || [])] }
      } catch (err) {
        console.error('Failed to fetch profile and steam details, continuing:', err)
      }
    }

    const profileByUserId = new Map<string, { displayName: string; avatarUrl: string | null }>(
      profilesSnapshot.docs.map((doc: any) => {
        const data = doc.data()
        return [
          data.user_id || doc.id,
          { displayName: data.display_name || data.displayName || '', avatarUrl: data.avatar_url || data.avatarUrl || null }
        ]
      })
    )

    const steamByUserId = new Map<string, { steamId: string; steamDisplayName: string; steamAvatarUrl: string | null }>()
    steamSnapshot.docs.forEach((doc: any) => {
      const data = doc.data()
      const uid = data.user_id || doc.id
      const sId = data.steam_id || data.steamId || (uid.startsWith('steam_') ? uid.replace('steam_', '') : (doc.id.startsWith('steam_') ? doc.id.replace('steam_', '') : ''))
      const val = {
        steamId: sId,
        steamDisplayName: data.steam_display_name || data.steamDisplayName || '',
        steamAvatarUrl: data.steam_avatar_url || data.steamAvatarUrl || null,
      }
      if (uid) steamByUserId.set(uid, val)
      if (doc.id) steamByUserId.set(doc.id, val)
    })

    let cookieStore: any = null
    try {
      const { cookies } = await import('next/headers')
      cookieStore = await cookies()
    } catch {}

    const teamById = new Map<string, TeamDashboard>(teams.map((team: any) => [team.id, team]))
    for (const row of membersRows) {
      const team = teamById.get(row.team_id)
      if (!team) continue
      
      const profile = profileByUserId.get(row.user_id)
      const steam = steamByUserId.get(row.user_id)
      
      let displayName = row.display_name || profile?.displayName || steam?.steamDisplayName || undefined
      let avatarUrl = row.avatar_url || profile?.avatarUrl || steam?.steamAvatarUrl || null
      let steamId = row.steam_id || steam?.steamId || undefined

      let sessionSteamId = ''
      // Resilient cookie lookups for newly registered or mock users
      if (cookieStore) {
        const mockProfileStr = cookieStore.get(`mock_profile_${row.user_id}`)?.value || (row.user_id === currentUserId ? cookieStore.get('mock_profile')?.value : undefined)
        if (mockProfileStr) {
          try {
            const parsed = JSON.parse(mockProfileStr)
            if (!displayName) displayName = parsed.display_name || parsed.displayName
            if (!avatarUrl) avatarUrl = parsed.avatar_url || parsed.avatarUrl
            if (!steamId) steamId = parsed.steam_id
          } catch {}
        }

        const sessionCookie = cookieStore.get('steam_session')?.value
        if (sessionCookie) {
          try {
            const session = JSON.parse(sessionCookie)
            if (session.steamId && /^\d{15,18}$/.test(session.steamId)) {
              sessionSteamId = session.steamId
            }
            const sessionUserId = session.userId || `steam_${session.steamId}`
            if (
              row.user_id === sessionUserId ||
              row.user_id === session.userId ||
              row.user_id === session.steamId ||
              row.user_id === currentUserId ||
              row.role === 'owner'
            ) {
              if (!displayName || displayName === 'Driver' || displayName === 'Team Leader') {
                displayName = session.steamDisplayName || displayName
              }
              if (!avatarUrl) avatarUrl = session.avatarUrl || null
              if (session.steamId) steamId = session.steamId
            }
          } catch {}
        }

        const appsVal = cookieStore.get('mock_market_applications')?.value
        if (appsVal) {
          try {
            const apps = JSON.parse(appsVal)
            const userApp = apps.find((a: any) => a.userId === row.user_id)
            if (userApp) {
              if (!displayName || displayName === 'Driver' || displayName === 'Team Leader') {
                displayName = userApp.userName || displayName
              }
              if (!avatarUrl) avatarUrl = userApp.userAvatar || null
            }
          } catch {}
        }
      }

      if (!displayName) {
        displayName = row.role === 'owner' ? 'Team Leader' : 'Driver'
      }

      if (!avatarUrl) {
        avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`
      }

      if (!steamId || !/^\d{15,18}$/.test(steamId)) {
        const isMunCato = String(displayName || row.user_id || '').toLowerCase().includes('muncato')
        if (isMunCato) {
          steamId = '76561198341588341'
        } else if (sessionSteamId && (row.user_id === currentUserId || row.role === 'owner' || row.user_id.includes(sessionSteamId))) {
          steamId = sessionSteamId
        } else {
          const cleaned = String(row.user_id || '').replace('steam_', '')
          if (/^\d{15,18}$/.test(cleaned)) {
            steamId = cleaned
          } else {
            const sum = Array.from(row.user_id as string).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
            steamId = `7656119${(1000000000 + (sum * 1234567) % 9000000000)}`
          }
        }
      }

      team.members.push({
        id: row.id,
        teamId: row.team_id,
        userId: row.user_id,
        role: row.role,
        createdAt: row.created_at,
        displayName,
        avatarUrl,
        steamId,
        steamDisplayName: displayName,
      })
    }

    const invitesRows = invitesSnapshotDocs
      .map((doc: any) => {
        const data = doc.data()
        return {
          id: doc.id,
          team_id: data.team_id || '',
          invited_by_user_id: data.invited_by_user_id || '',
          invited_user_id: data.invited_user_id || null,
          invited_steam_id: data.invited_steam_id || '',
          message: data.message || null,
          status: (data.status || 'pending') as TeamInvite['status'],
          created_at: formatFirestoreValue(data.created_at) || '',
        }
      })
      .filter((row: any) => teamIds.includes(row.team_id))

    // Sort invites descending
    invitesRows.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))

    for (const row of invitesRows) {
      const team = teamById.get(row.team_id)
      if (!team) continue
      team.invites.push({
        id: row.id,
        teamId: row.team_id,
        invitedByUserId: row.invited_by_user_id,
        invitedUserId: row.invited_user_id,
        invitedSteamId: row.invited_steam_id,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
      })
    }

    for (const team of teams) {
      team.occupiedSlots = team.members.filter((member: any) => member.role === 'driver' || member.role === 'manager' || member.role === 'owner').length
    }

    const myTeamIds = currentUserId
      ? teams
          .filter((team: any) => team.ownerUserId === currentUserId || team.members.some((member: any) => member.userId === currentUserId && (member.role === 'owner' || member.role === 'manager')))
          .map((team: any) => team.id)
      : []

    return {
      teams,
      myTeamIds,
      mode: 'ok' as const,
    }
  } catch (error) {
    console.error('Failed to get teams dashboard from Firestore:', error)
    return {
      teams: [] as TeamDashboard[],
      myTeamIds: [] as string[],
      mode: 'ok' as const,
    }
  }
  }, 60).then((res) => {
    if (!res || !res.teams) return res
    const myTeamIds = currentUserId
      ? res.teams
          .filter((team: any) => team.ownerUserId === currentUserId || (Array.isArray(team.members) && team.members.some((member: any) => member.userId === currentUserId && (member.role === 'owner' || member.role === 'manager'))))
          .map((team: any) => team.id)
      : []
    return {
      ...res,
      myTeamIds,
    }
  })
})
