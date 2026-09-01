import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { getTeamsDashboard } from '@/lib/team-data'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import type { SessionUser } from '@/types'
import MarketPageContent from './market-content'

function serializeDate(val: any): string {
  if (!val) return new Date().toISOString()
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString()
    } catch (e) {
      return new Date().toISOString()
    }
  }
  if (typeof val === 'string') {
    // Check if it is a valid date
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return d.toISOString()
    }
    return new Date().toISOString()
  }
  if (typeof val === 'object') {
    if (typeof val._seconds === 'number') {
      return new Date(val._seconds * 1000).toISOString()
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000).toISOString()
    }
  }
  return new Date().toISOString()
}

async function fetchListings(): Promise<any[]> {
  let listings: any[] = []

  // 1. Fetch Listings
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const teamsSnap = await runWithTimeout(db.collection('teams').get(), 3000)
        const teamsColors = new Map<string, string>()
        teamsSnap.docs.forEach((doc: any) => {
          const t = doc.data()
          teamsColors.set(doc.id, t.primary_color || null)
        })

        const snap = await runWithTimeout(db.collection('market_listings').get(), 3000)
        const rawListings = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
        const posterUserIds = Array.from(new Set(rawListings.map((r: any) => r.user_id).filter(Boolean)))

        let profileCountryMap = new Map<string, string>()
        if (posterUserIds.length > 0) {
          try {
            const pChunks = []
            for (let i = 0; i < posterUserIds.length; i += 10) pChunks.push(posterUserIds.slice(i, i + 10))
            const pSnaps = await Promise.all(pChunks.map((chunk) => db.collection('profiles').where('user_id', 'in', chunk).get()))
            pSnaps.forEach((s) => {
              s.docs.forEach((d: any) => {
                const p = d.data()
                if (p.user_id && p.country_code) profileCountryMap.set(p.user_id, p.country_code)
              })
            })
          } catch {}
        }

        const existingTeamIds = new Set(teamsSnap.docs.map((d: any) => d.id))

        // Filter out listings of deleted teams and delete orphaned listing docs from Firestore
        const validRawListings = rawListings.filter((data: any) => {
          if (data.type === 'team_seeking_driver' && data.team_id) {
            const exists = existingTeamIds.has(data.team_id)
            if (!exists && data.id) {
              // Delete orphaned listing doc asynchronously
              db.collection('market_listings').doc(data.id).delete().catch(() => null)
            }
            return exists
          }
          return true
        })

        listings = validRawListings.map((data: any) => {
          const createdAtVal = serializeDate(data.created_at)
          return {
            id: data.id,
            type: data.type || 'team_seeking_driver',
            user_id: data.user_id || '',
            user_name: data.user_name || 'Driver',
            user_avatar: data.user_avatar || null,
            country_code: data.country_code || data.countryCode || profileCountryMap.get(data.user_id) || 'ES',
            team_id: data.team_id || null,
            team_name: data.team_name || null,
            team_logo: data.team_logo || null,
            team_color: data.team_id ? teamsColors.get(data.team_id) || null : null,
            title: data.title || '',
            description: data.description || '',
            main_sim: data.main_sim || 'ac',
            class_tag: data.class_tag || 'ALL',
            contact_info: data.contact_info || '',
            created_at: createdAtVal,
          }
        })
        // Sort descending by date in memory (avoids requiring a Firestore composite index)
        listings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return listings
      } catch (error) {
        console.error('Failed to get market listings from Firestore (falling back to mock mode):', error)
      }
    }
  }

  // Fallback to mock listings if firebase not used
  if (!hasFirebase) {
    // Mock Mode Fallback
    try {
      const cookieStore = await cookies()
      const mockListingsVal = cookieStore.get('mock_market_listings')?.value
      const mockTeamsVal = cookieStore.get('mock_teams')?.value
      const teamsColors = new Map<string, string>()

      if (mockTeamsVal) {
        const mockTeams = JSON.parse(mockTeamsVal)
        if (Array.isArray(mockTeams)) {
          mockTeams.forEach((t: any) => {
            teamsColors.set(t.id, t.primaryColor || null)
          })
        }
      }

      // Default fallback color for seed team t1 (Apex Racing Team) in mock mode is light blue (#1274de)
      if (!teamsColors.has('t1')) {
        teamsColors.set('t1', '#1274de')
      }

      if (mockListingsVal) {
        const rawMockListings = JSON.parse(mockListingsVal)
        const mockTeamIds = new Set(teamsColors.keys())

        listings = rawMockListings
          .filter((item: any) => {
            if (item.type === 'team_seeking_driver' && item.team_id) {
              return mockTeamIds.has(item.team_id)
            }
            return true
          })
          .map((item: any) => ({
            ...item,
            team_color: item.team_id ? teamsColors.get(item.team_id) || null : null,
          }))
        // Sort descending by date
        listings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      } else {
        // Default seed listings so it's not empty at first sight in mock mode
        listings = [
          {
            id: 'mock_seed_1',
            type: 'team_seeking_driver',
            user_id: '76561198000000001',
            user_name: 'David Croft',
            user_avatar: null,
            team_id: 't1',
            team_name: 'Apex Racing Team',
            team_logo: null,
            team_color: teamsColors.get('t1') || null,
            title: 'Endurance Driver Wanted - LMU WEC Season',
            description: 'Looking for a reliable LMP2 driver to join our team for the upcoming 6-hour endurance league. Ideal candidate has solid pace and is available on weekends.',
            main_sim: 'lmu',
            class_tag: 'LMP2',
            contact_info: 'Discord: @apex_david',
            created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
          },
          {
            id: 'mock_seed_2',
            type: 'driver_seeking_team',
            user_id: '76561198000000002',
            user_name: 'Lewis Hamilton',
            user_avatar: null,
            team_id: null,
            team_name: null,
            team_logo: null,
            team_color: null,
            title: 'Pro GT3 driver looking for active team',
            description: 'Looking for a competitive team running in Assetto Corsa GT3 Sprint leagues. Available weekday evenings. Sub-1:47s pace at Monza.',
            main_sim: 'ac',
            class_tag: 'GT3',
            contact_info: 'Discord: @lewis_h',
            created_at: new Date(Date.now() - 3600000 * 6).toISOString(), // 6 hours ago
          }
        ]
      }
    } catch (e) {
      console.error(e)
    }
  }

  return listings
}

async function fetchUserTeamStatus(session: SessionUser | null): Promise<{ myTeams: any[]; belongsToTeam: boolean }> {
  let myTeams: any[] = []
  let belongsToTeam = false

  if (session) {
    try {
      const dashboard = await getTeamsDashboard(session.userId)
      if (dashboard && Array.isArray(dashboard.teams)) {
        myTeams = dashboard.teams
          .filter((team: any) => dashboard.myTeamIds.includes(team.id))
          .map((team: any) => ({
            id: team.id,
            name: team.name,
            logoUrl: team.logo_url || null,
          }))

        belongsToTeam = dashboard.teams.some((team: any) =>
          team.ownerUserId === session.userId ||
          (Array.isArray(team.members) && team.members.some((m: any) => m.userId === session.userId))
        )
      }

      if (hasFirebase && !belongsToTeam) {
        const db = getFirestoreDb()
        if (db) {
          const [memSnap, ownSnap] = await Promise.all([
            runWithTimeout(db.collection('team_members').where('user_id', '==', session.userId).get(), 2000),
            runWithTimeout(db.collection('teams').where('owner_user_id', '==', session.userId).get(), 2000),
          ])
          if (!memSnap.empty || !ownSnap.empty) belongsToTeam = true
        }
      }
    } catch (error) {
      console.error('Failed to load user teams for marketplace:', error)
    }
  }

  return { myTeams, belongsToTeam }
}

async function fetchMarketAppsAndInvites(session: SessionUser | null): Promise<{ applications: any[]; invites: any[] }> {
  let applications: any[] = []
  let invites: any[] = []

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const [appsSnap, invitesSnap] = await Promise.all([
          runWithTimeout(db.collection('market_applications').get(), 3000),
          runWithTimeout(db.collection('team_invites').where('status', '==', 'pending').get(), 3000),
        ])

        const sessUserClean = session ? String(session.userId || '').replace(/^steam_/, '') : ''
        const sessSteamClean = session ? String(session.steamId || '').replace(/^steam_/, '') : ''
        applications = appsSnap.docs.map((doc: any) => {
          const d = doc.data()
          return {
            id: doc.id,
            listingId: d.listing_id || '',
            teamId: d.team_id || '',
            userId: d.user_id || '',
            userName: d.user_name || 'Driver',
            userAvatar: d.user_avatar || null,
            contactInfo: d.contact_info || '',
            status: d.status || 'pending',
            message: d.message || '',
            createdAt: serializeDate(d.created_at),
          }
        }).filter((app: any) => {
          // Only return applications relevant to current user
          if (!sessUserClean) return false
          const appUserClean = String(app.userId || '').replace(/^steam_/, '')
          return appUserClean === sessUserClean || appUserClean === sessSteamClean
        })

        const teamIds = Array.from(new Set(invitesSnap.docs.map((doc: any) => doc.data().team_id).filter(Boolean)))

        const teamDocsMap = new Map<string, { name: string; logoUrl: string | null }>()
        if (teamIds.length > 0) {
          const teamSnaps = await Promise.all(teamIds.map((tid: any) => runWithTimeout(db.collection('teams').doc(tid).get(), 3000)))
          teamSnaps.forEach((s: any) => {
            if (s.exists) {
              const data = s.data()
              teamDocsMap.set(s.id, {
                name: data.name || 'Team',
                logoUrl: data.logo_url || null
              })
            }
          })
        }

        invites = invitesSnap.docs.map((doc: any) => {
          const d = doc.data()
          const teamInfo = d.team_id ? teamDocsMap.get(d.team_id) : null
          return {
            id: doc.id,
            listingId: d.listing_id || '',
            teamId: d.team_id || '',
            teamName: teamInfo?.name || 'Team',
            teamLogo: teamInfo?.logoUrl || null,
            invitedUserId: d.invited_user_id || '',
            invitedByUserId: d.invited_by_user_id || '',
            status: d.status || 'pending',
            createdAt: serializeDate(d.created_at),
          }
        })
      } catch (err) {
        console.error('Failed to fetch market apps/invites from Firestore:', err)
      }
    }
  }

  if (!hasFirebase) {
    // Mock Mode
    try {
      const cookieStore = await cookies()
      const appsVal = cookieStore.get('mock_market_applications')?.value
      applications = appsVal ? JSON.parse(appsVal) : []

      const invitesVal = cookieStore.get('mock_market_invites')?.value
      invites = invitesVal ? JSON.parse(invitesVal) : []
    } catch (err) {
      console.error('Failed to parse mock market apps/invites:', err)
    }
  }

  return { applications, invites }
}

export default async function MarketPage() {
  const session = await getCurrentUser()

  // These three phases are independent Firestore reads — run them concurrently
  // instead of one after another to cut the page's total load latency.
  const [listings, { myTeams, belongsToTeam }, { applications, invites }] = await Promise.all([
    fetchListings(),
    fetchUserTeamStatus(session),
    fetchMarketAppsAndInvites(session),
  ])

  const currentUser = session
    ? {
        userId: session.userId,
        steamDisplayName: session.steamDisplayName,
        avatarUrl: session.avatarUrl ?? null,
      }
    : null

  return (
    <div className="space-y-4">
      <MarketPageContent
        listings={listings}
        currentUser={currentUser}
        myTeams={myTeams}
        applications={applications}
        invites={invites}
        belongsToTeam={belongsToTeam}
      />
    </div>
  )
}
