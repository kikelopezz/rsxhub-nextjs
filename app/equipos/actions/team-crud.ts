'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminAccessContext, getAdminUserIds } from '@/lib/auth'
import { db } from '@/lib/db'
import { getTeamsDashboard } from '@/lib/team-data'
import { invalidateCache } from '@/lib/ttl-cache'
import { cleanupDriverMarketDataOnTeamJoin } from '@/lib/market-cleanup'
import { guardSession, canManageTeam, cleanPilotName, parseSkinProfilesJson } from './team-parsers'
import { syncLeagueRegistrations } from './team-league-sync'
import {
  MAX_LINEUP_CHANGES_PER_DAY,
  carLineupKey,
  countLineupChangesToday,
  getNextLeagueEvent,
  isLineupLockedForRace,
  sameDriverSet,
} from '@/lib/lineup-rules'

/** Turns per-car driver diffs into a readable admin notification, e.g.
 * "SpeedHackTeam ha modificado la alineación. GT3 #13 (ERC Next Gen): DarkAngelRX → Ricardo Nevirkovets" */
async function buildLineupChangeMessage(
  teamName: string,
  teamId: string,
  changes: Array<{ category: string; dorsal: string; leagueId: string | null; added: string[]; removed: string[] }>,
): Promise<string> {
  const userIds = Array.from(new Set(changes.flatMap((c) => [...c.added, ...c.removed])))
  const leagueIds = Array.from(new Set(changes.map((c) => c.leagueId).filter((id): id is string => Boolean(id))))

  const [members, profiles, steamAccounts, leagues] = await Promise.all([
    userIds.length > 0
      ? db.teamMember.findMany({ where: { teamId, userId: { in: userIds } }, select: { userId: true, displayName: true } })
      : Promise.resolve([]),
    userIds.length > 0 ? db.profile.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
    userIds.length > 0 ? db.steamAccount.findMany({ where: { userId: { in: userIds } } }) : Promise.resolve([]),
    leagueIds.length > 0 ? db.league.findMany({ where: { id: { in: leagueIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
  ])

  const memberNameById = new Map(members.map((m) => [m.userId, m.displayName]))
  const profileNameById = new Map(profiles.map((p) => [p.userId, p.displayName]))
  const steamNameById = new Map(steamAccounts.map((s) => [s.userId, s.steamDisplayName]))
  const leagueTitleById = new Map(leagues.map((l) => [l.id, l.title]))

  const nameOf = (userId: string) =>
    memberNameById.get(userId) || profileNameById.get(userId) || steamNameById.get(userId) || `Piloto ${userId.slice(0, 4)}`

  const lines = changes.map((c) => {
    const label = `${c.category} #${c.dorsal}${c.leagueId ? ` (${leagueTitleById.get(c.leagueId) || 'liga'})` : ''}`
    // A clean 1-for-1 swap reads better as "old → new" than as separate +/- lists.
    if (c.added.length === 1 && c.removed.length === 1) {
      return `${label}: ${nameOf(c.removed[0])} → ${nameOf(c.added[0])}`
    }
    const parts: string[] = []
    if (c.added.length > 0) parts.push(`+ ${c.added.map(nameOf).join(', ')}`)
    if (c.removed.length > 0) parts.push(`- ${c.removed.map(nameOf).join(', ')}`)
    return parts.length > 0 ? `${label}: ${parts.join(', ')}` : label
  })

  return `${teamName} ha modificado la alineación. ${lines.join(' | ')}`
}

export async function createTeam(formData: FormData) {
  const session = await guardSession()

  const { teams } = await getTeamsDashboard(session.userId)
  const isAlreadyInTeam = teams.some(
    (team) => team.ownerUserId === session.userId || team.members.some((m) => m.userId === session.userId),
  )
  if (isAlreadyInTeam) {
    redirect('/equipos?error=already-in-a-team')
  }

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim()
  const bannerUrl = String(formData.get('bannerUrl') || '').trim()
  const classTagsRaw = formData.getAll('classTags').flatMap((val) => String(val).split(',')).map((t) => t.trim().toUpperCase()).filter(Boolean)
  const classTags = Array.from(new Set(classTagsRaw))
  const skinProfilesJson = String(formData.get('skinProfilesJson') || '').trim()
  const skinProfiles = parseSkinProfilesJson(skinProfilesJson)

  const accentColor = String(formData.get('accentColor') || '#3b82f6').trim()
  const slogan = String(formData.get('slogan') || '').trim()
  const discordUrl = String(formData.get('discordUrl') || '').trim()
  const youtubeUrl = String(formData.get('youtubeUrl') || '').trim()
  const instagramUrl = String(formData.get('instagramUrl') || '').trim()
  const twitterUrl = String(formData.get('twitterUrl') || '').trim()
  const twitchUrl = String(formData.get('twitchUrl') || '').trim()
  const tiktokUrl = String(formData.get('tiktokUrl') || '').trim()

  if (!name) redirect('/equipos?error=name-required')

  const featuredSkin = skinProfiles[0]?.skinUrl || ''
  const mergedSkinUrls = Array.from(new Set([featuredSkin, ...skinProfiles.map((item) => item.skinUrl)].filter(Boolean))).slice(0, 12)

  const team = await db.team.create({
    data: {
      name,
      description: description || null,
      logoUrl: logoUrl || null,
      bannerUrl: bannerUrl || null,
      classTags,
      ownerUserId: session.userId,
      carSkinUrls: mergedSkinUrls,
      accentColor,
      slogan: slogan || null,
      discordUrl: discordUrl || null,
      youtubeUrl: youtubeUrl || null,
      instagramUrl: instagramUrl || null,
      twitterUrl: twitterUrl || null,
      twitchUrl: twitchUrl || null,
      tiktokUrl: tiktokUrl || null,
      status: 'pending',
      skinAssignments: {
        create: skinProfiles.map((p) => ({ leagueSlug: p.leagueSlug, skinUrl: p.skinUrl, carNumber: p.carNumber || null })),
      },
      members: {
        create: {
          userId: session.userId,
          role: 'owner',
          displayName: session.steamDisplayName || 'Team Leader',
          steamId: session.steamId,
          avatarUrl: session.avatarUrl || null,
        },
      },
    },
  })

  // Create placeholder pilot accounts for named-but-unlinked drivers in the skin profiles.
  for (const profile of skinProfiles) {
    const pilotName = cleanPilotName(profile.carNumber)
    if (!pilotName || pilotName.toLowerCase() === 'vacant') continue

    const dummySteamId = `7656119${Math.floor(Math.random() * 9000000000 + 1000000000)}`
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(pilotName)}`
    const pilotUser = await db.user.create({ data: {} })

    await db.$transaction([
      db.profile.create({ data: { userId: pilotUser.id, displayName: pilotName, mainSim: 'ac', countryCode: 'ES', onboarded: false } }),
      db.steamAccount.create({
        data: {
          userId: pilotUser.id,
          steamId: dummySteamId,
          steamDisplayName: pilotName,
          steamProfileUrl: `https://steamcommunity.com/profiles/${dummySteamId}`,
        },
      }),
      db.teamMember.create({
        data: { teamId: team.id, userId: pilotUser.id, role: 'driver', displayName: pilotName, steamId: dummySteamId, avatarUrl },
      }),
    ])
  }

  await cleanupDriverMarketDataOnTeamJoin(session.userId)
  invalidateCache(['teams_dashboard', 'platform_leagues', 'platform_drivers'])
  revalidatePath('/equipos')
  revalidatePath('/perfil')
  redirect('/equipos?created=1')
}

export async function updateTeam(formData: FormData) {
  const session = await guardSession()

  const redirectTo = String(formData.get('redirectTo') || '/equipos')
  const teamId = String(formData.get('teamId') || '')
  if (!teamId) redirect(`${redirectTo}?error=team-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  const existingTeam = await db.team.findUnique({ where: { id: teamId }, include: { cars: { include: { drivers: true } } } })
  if (!existingTeam) redirect(`${redirectTo}?error=team-required`)

  const name = formData.has('name') ? String(formData.get('name') || '').trim() : existingTeam.name
  const description = formData.has('description') ? String(formData.get('description') || '').trim() : existingTeam.description || ''
  const logoUrl = formData.has('logoUrl') ? String(formData.get('logoUrl') || '').trim() : existingTeam.logoUrl || ''
  const bannerUrl = formData.has('bannerUrl') ? String(formData.get('bannerUrl') || '').trim() : existingTeam.bannerUrl || ''

  let classTags = existingTeam.classTags
  if (formData.has('classTags')) {
    const classTagsRaw = formData.getAll('classTags').flatMap((val) => String(val).split(',')).map((t) => t.trim().toUpperCase()).filter(Boolean)
    classTags = Array.from(new Set(classTagsRaw))
  }

  type ParsedCar = {
    id?: string
    category: string
    dorsal: string
    modelName: string
    modelFolder: string
    skinUrl: string
    skinName: string
    driverUserIds: string[]
    driverUserIdsByLeague: Record<string, string[]>
    reserveDriverUserIds: string[]
    reserveDriverUserIdsByLeague: Record<string, string[]>
    leagueId: string | null
  }

  const teamCarsJson = String(formData.get('teamCarsJson') || '').trim()
  let teamCars: ParsedCar[] | null = null
  if (formData.has('teamCarsJson')) {
    try {
      const rawCars = JSON.parse(teamCarsJson)
      if (Array.isArray(rawCars)) {
        teamCars = rawCars
          .map((car: any): ParsedCar => {
            let skinUrl = String(car.skinUrl || car.skin_url || '').trim()
            if (skinUrl.startsWith('data:') && skinUrl.length > 200000) skinUrl = ''
            return {
              id: car.id,
              category: String(car.category || 'GT3').toUpperCase(),
              dorsal: String(car.dorsal || '').replace(/[^0-9]/g, '').slice(0, 3),
              modelName: String(car.modelName || car.model_name || car.model || '').trim(),
              modelFolder: String(car.modelFolder || car.model_folder || car.ac_folder || '').trim(),
              skinUrl,
              skinName: car.skinName || car.skin_name || '',
              driverUserIds: (car.driverUserIds || car.driver_user_ids || []).map((d: any) => String(d || '').trim()).filter(Boolean),
              driverUserIdsByLeague: car.driverUserIdsByLeague || car.driver_user_ids_by_league || {},
              reserveDriverUserIds: (car.reserveDriverUserIds || car.reserve_driver_user_ids || []).map((d: any) => String(d || '').trim()).filter(Boolean),
              reserveDriverUserIdsByLeague: car.reserveDriverUserIdsByLeague || car.reserve_driver_user_ids_by_league || {},
              leagueId: car.leagueId || car.league_id || null,
            }
          })
          .filter((car) => Boolean(car.id || car.dorsal || car.category))

        const dorsalsSeen = new Set<string>()
        for (const car of teamCars) {
          const d = car.dorsal.trim()
          if (!d) continue
          const key = `${car.category}_${car.leagueId || 'general'}_${d}`
          if (dorsalsSeen.has(key)) redirect(`${redirectTo}?error=dorsal-duplicate`)
          dorsalsSeen.add(key)
        }
      }
    } catch (e: any) {
      if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e
    }
  }

  // Lineup-change rules: detect which cars actually changed drivers (vs. an
  // unrelated team-details save), then enforce the Friday race-week lock and
  // the 3-changes-per-day limit before writing anything.
  const changedCarKeys: string[] = []
  const carChangeDetails: Array<{ category: string; dorsal: string; leagueId: string | null; added: string[]; removed: string[] }> = []
  if (teamCars) {
    const oldDriversByKey = new Map<string, string[]>()
    for (const oldCar of existingTeam.cars) {
      const key = `${oldCar.category}_${oldCar.leagueId || 'general'}_${oldCar.dorsal}`
      oldDriversByKey.set(key, oldCar.drivers.map((d) => d.userId))
    }

    const nextEventByLeague = new Map<string, Awaited<ReturnType<typeof getNextLeagueEvent>>>()
    const now = new Date()

    for (const car of teamCars) {
      const dorsal = car.dorsal.trim()
      if (!dorsal) continue
      const key = `${car.category}_${car.leagueId || 'general'}_${dorsal}`
      const oldDrivers = oldDriversByKey.get(key)
      if (!oldDrivers) continue // brand new car slot — not a "change" to an existing lineup

      const newDrivers = Array.from(
        new Set(
          [
            ...car.driverUserIds,
            ...Object.values(car.driverUserIdsByLeague).flat(),
            ...car.reserveDriverUserIds,
            ...Object.values(car.reserveDriverUserIdsByLeague).flat(),
          ].filter(Boolean),
        ),
      )
      if (sameDriverSet(oldDrivers, newDrivers)) continue

      if (car.leagueId) {
        if (!nextEventByLeague.has(car.leagueId)) {
          nextEventByLeague.set(car.leagueId, await getNextLeagueEvent(car.leagueId, now))
        }
        const nextEvent = nextEventByLeague.get(car.leagueId)
        if (nextEvent && isLineupLockedForRace(nextEvent, now)) {
          redirect(`${redirectTo}?error=lineup-locked-qualy-day`)
        }
      }

      const carKey = carLineupKey(teamId, car.category, car.leagueId, dorsal)
      const changesToday = await countLineupChangesToday(carKey, now)
      if (changesToday >= MAX_LINEUP_CHANGES_PER_DAY) {
        redirect(`${redirectTo}?error=lineup-rate-limited`)
      }
      changedCarKeys.push(carKey)
      carChangeDetails.push({
        category: car.category,
        dorsal,
        leagueId: car.leagueId,
        added: newDrivers.filter((id) => !oldDrivers.includes(id)),
        removed: oldDrivers.filter((id) => !newDrivers.includes(id)),
      })
    }
  }

  const accentColor = formData.has('accentColor') ? String(formData.get('accentColor') || '').trim() : existingTeam.accentColor || '#3b82f6'
  const slogan = formData.has('slogan') ? String(formData.get('slogan') || '').trim() : existingTeam.slogan
  const discordUrl = formData.has('discordUrl') ? String(formData.get('discordUrl') || '').trim() : existingTeam.discordUrl
  const youtubeUrl = formData.has('youtubeUrl') ? String(formData.get('youtubeUrl') || '').trim() : existingTeam.youtubeUrl
  const instagramUrl = formData.has('instagramUrl') ? String(formData.get('instagramUrl') || '').trim() : existingTeam.instagramUrl
  const twitterUrl = formData.has('twitterUrl') ? String(formData.get('twitterUrl') || '').trim() : existingTeam.twitterUrl
  const twitchUrl = formData.has('twitchUrl') ? String(formData.get('twitchUrl') || '').trim() : existingTeam.twitchUrl
  const tiktokUrl = formData.has('tiktokUrl') ? String(formData.get('tiktokUrl') || '').trim() : existingTeam.tiktokUrl

  let syncedLeagueSlugs: string[] = []

  try {
    await db.team.update({
      where: { id: teamId },
      data: {
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        bannerUrl: bannerUrl || null,
        classTags,
        accentColor,
        slogan: slogan || null,
        discordUrl: discordUrl || null,
        youtubeUrl: youtubeUrl || null,
        instagramUrl: instagramUrl || null,
        twitterUrl: twitterUrl || null,
        twitchUrl: twitchUrl || null,
        tiktokUrl: tiktokUrl || null,
      },
    })

    if (teamCars) {
      await db.teamCar.deleteMany({ where: { teamId } })
      for (const car of teamCars) {
        await db.teamCar.create({
          data: {
            teamId,
            category: car.category,
            dorsal: car.dorsal,
            modelName: car.modelName,
            modelFolder: car.modelFolder,
            skinUrl: car.skinUrl,
            skinName: car.skinName,
            leagueId: car.leagueId,
            drivers: {
              create: [
                ...car.driverUserIds.map((userId) => ({ userId, leagueId: null, isReserve: false })),
                ...Object.entries(car.driverUserIdsByLeague).flatMap(([leagueId, userIds]) =>
                  (userIds || []).filter(Boolean).map((userId) => ({ userId, leagueId, isReserve: false })),
                ),
                ...car.reserveDriverUserIds.map((userId) => ({ userId, leagueId: null, isReserve: true })),
                ...Object.entries(car.reserveDriverUserIdsByLeague).flatMap(([leagueId, userIds]) =>
                  (userIds || []).filter(Boolean).map((userId) => ({ userId, leagueId, isReserve: true })),
                ),
              ],
            },
          },
        })
      }
    }

    syncedLeagueSlugs = await syncLeagueRegistrations(teamId).catch((err) => {
      console.error('Failed auto-syncing league registrations on team update:', err)
      return []
    })

    if (changedCarKeys.length > 0) {
      await db.lineupChangeLog.createMany({
        data: changedCarKeys.map((carKey) => ({ carId: carKey, teamId, changedById: session.userId })),
      })

      const adminUserIds = await getAdminUserIds()
      if (adminUserIds.length > 0) {
        const message = await buildLineupChangeMessage(name, teamId, carChangeDetails)
        await db.userNotification.createMany({
          data: adminUserIds.map((userId) => ({
            userId,
            title: 'Cambio de alineación',
            message,
            link: `/equipos/${teamId}`,
          })),
        })
      }
    }
  } catch (error) {
    console.error('Failed to update team:', error)
  }

  invalidateCache(['teams_dashboard', 'platform_leagues', 'platform_drivers'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  revalidatePath('/perfil')
  revalidatePath('/ligas')
  for (const slug of syncedLeagueSlugs) {
    revalidatePath(`/ligas/${slug}`)
  }
  redirect(`${redirectTo}?updated=1`)
}

export async function deleteTeamAction(teamId: string) {
  const session = await guardSession()

  const team = await db.team.findUnique({ where: { id: teamId } })
  if (!team) redirect('/equipos?error=delete-failed')

  const access = await getAdminAccessContext(session.userId)
  const isAllowed = team.ownerUserId === session.userId || access.canAccessPlatformAdmin
  if (!isAllowed) redirect('/equipos?error=forbidden')

  try {
    await db.$transaction([
      db.leagueRegistration.deleteMany({ where: { teamId } }),
      db.marketListing.deleteMany({ where: { teamId } }),
      db.marketApplication.deleteMany({ where: { teamId } }),
    ])
    // Everything else (cars, members, invites, team registrations, skin
    // assignments, team points) cascades from the team via FK.
    await db.team.delete({ where: { id: teamId } })
  } catch (error) {
    console.error('Failed to delete team:', error)
    redirect('/equipos?error=delete-failed')
  }

  invalidateCache(['teams_dashboard', 'platform_leagues', 'platform_drivers'])
  revalidatePath('/equipos')
  revalidatePath('/perfil')
  redirect('/equipos?deleted=1')
}
