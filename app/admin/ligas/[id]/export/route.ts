import { NextResponse } from 'next/server'
import { canAccessPlatformAdmin, canManageLeague, getCurrentUser, getLeagueRole, getPlatformRole } from '@/lib/auth'
import { getLeagues, getRegistrations } from '@/lib/platform-data'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'

const DEFAULT_MODEL = 'RSX_Porsche_992_GT3R'

function safeToken(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

function skinFromValue(value: string | null | undefined) {
  if (!value) return ''
  const cleaned = String(value).trim()
  if (!cleaned) return ''
  const base = cleaned.split('/').pop() || cleaned
  return base.replace(/\.[a-z0-9]+$/i, '')
}

function uniqueCarSlot(desired: number | null, used: Set<number>) {
  if (typeof desired === 'number' && desired >= 0 && desired <= 999 && !used.has(desired)) {
    used.add(desired)
    return desired
  }
  for (let slot = 0; slot <= 999; slot += 1) {
    if (!used.has(slot)) {
      used.add(slot)
      return slot
    }
  }
  return 0
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = await context.params
  const session = await getCurrentUser()
  if (!session) return NextResponse.redirect(new URL('/perfil', request.url))

  const [platformRole, leagueRole] = await Promise.all([getPlatformRole(session.userId), getLeagueRole(leagueId, session.userId)])
  if (!(canAccessPlatformAdmin(platformRole) || canManageLeague(leagueRole))) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  const leagues = await getLeagues()
  const league = leagues.find((item) => item.id === leagueId)
  if (!league) return new NextResponse('League not found', { status: 404 })

  const registrations = (await getRegistrations(leagueId)).filter((item) => item.status === 'approved')
  const db = getFirestoreDb()

  const teamIds = Array.from(new Set(registrations.map((item) => item.teamId).filter(Boolean))) as string[]
  const teamInfoById = new Map<string, { name: string; skin: string }>()
  const carModelByKey = new Map<string, string>()

  if (hasFirebase && db) {
    if (teamIds.length > 0) {
      const chunks = []
      for (let i = 0; i < teamIds.length; i += 10) {
        chunks.push(teamIds.slice(i, i + 10))
      }
      const snaps = await Promise.all(chunks.map(chunk => db.collection('teams').where('__name__', 'in', chunk).get()))
      const teams = snaps.flatMap((snap: any) => snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })))

      for (const team of teams) {
        const skinCandidate = Array.isArray(team.car_skin_urls) && team.car_skin_urls.length > 0 ? skinFromValue(team.car_skin_urls[0]) : ''
        teamInfoById.set(team.id, { name: team.name || '', skin: skinCandidate })
      }
    }

    const teamCarRowsSnapshot = await db
      .collection('league_team_registrations')
      .where('league_id', '==', leagueId)
      .get()

    const teamCarRows = teamCarRowsSnapshot.docs.map((doc: any) => doc.data())
    for (const row of teamCarRows) {
      const key = `${row.team_id}::${row.class_tag || 'noclass'}::${typeof row.car_number === 'number' ? row.car_number : 'no-number'}`
      if (row.car_model) carModelByKey.set(key, row.car_model)
    }
  }

  const usedSlots = new Set<number>()
  const lines: string[] = []

  if (league.registrationMode === 'team') {
    const groupedCars = Array.from(
      registrations.reduce((acc, registration) => {
        const key = registration.teamId
          ? `${registration.teamId}::${registration.classTag || 'noclass'}::${typeof registration.assignedNumber === 'number' ? registration.assignedNumber : 'no-number'}`
          : `solo-${registration.userId}`
        const current = acc.get(key) || []
        current.push(registration)
        acc.set(key, current)
        return acc
      }, new Map<string, typeof registrations>()),
    )

    for (const [, members] of groupedCars) {
      const first = members[0]
      const groupKey = first.teamId
        ? `${first.teamId}::${first.classTag || 'noclass'}::${typeof first.assignedNumber === 'number' ? first.assignedNumber : 'no-number'}`
        : `solo-${first.userId}`
      const slot = uniqueCarSlot(typeof first.assignedNumber === 'number' ? first.assignedNumber : null, usedSlots)
      const team = first.teamId ? teamInfoById.get(first.teamId) : null
      const teamName = team?.name || first.displayName || 'TEAM'
      const driverName = `${safeToken(teamName)} ${slot}`.trim()
      const guids = Array.from(new Set(members.map((item) => item.steamId).filter(Boolean))).join(';')
      const skin = team?.skin || `${safeToken(teamName)}_${slot}`
      const model = carModelByKey.get(groupKey) || DEFAULT_MODEL

      lines.push(`[CAR_${slot}]`)
      lines.push(`MODEL=${model}`)
      lines.push(`SKIN=${skin}`)
      lines.push(`DRIVERNAME=${driverName}`)
      lines.push('TEAM=')
      lines.push(`GUID=${guids}`)
      lines.push('SPECTATOR_MODE=0')
      lines.push('BALLAST=0')
      lines.push('RESTRICTOR=0')
      lines.push('RACE_NUMBER=0')
      lines.push(`PITBOX=${slot}`)
      lines.push('FIXED_SETUP=')
      lines.push('')
    }
  } else {
    for (const registration of registrations) {
      const slot = uniqueCarSlot(typeof registration.assignedNumber === 'number' ? registration.assignedNumber : null, usedSlots)
      const driverName = safeToken(registration.displayName || registration.steamId || `DRIVER_${slot}`)
      lines.push(`[CAR_${slot}]`)
      lines.push(`MODEL=${DEFAULT_MODEL}`)
      lines.push(`SKIN=${driverName}_${slot}`)
      lines.push(`DRIVERNAME=${driverName}`)
      lines.push('TEAM=')
      lines.push(`GUID=${registration.steamId}`)
      lines.push('SPECTATOR_MODE=0')
      lines.push('BALLAST=0')
      lines.push('RESTRICTOR=0')
      lines.push('RACE_NUMBER=0')
      lines.push(`PITBOX=${slot}`)
      lines.push('FIXED_SETUP=')
      lines.push('')
    }
  }

  const body = lines.length > 0 ? lines.join('\n') : '; No approved registrations found.\n'
  const filename = `${league.slug || 'league'}-entry-list.ini`
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
