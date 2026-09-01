'use server'

/**
 * League registration sync helpers extracted from team-crud.ts.
 *
 * These functions handle auto-syncing league_registrations when a team's
 * vehicle list is saved, for both Firestore and Mock (cookie) modes.
 * They are pure utility functions — no redirects, no revalidations.
 */

import { parseClassTags } from '@/lib/firestore-utils'

// ─── Firestore Mode ───────────────────────────────────────────────────────────

/**
 * Auto-syncs league registrations in Firestore when a team's cars are saved.
 * Deletes old registrations and creates new ones based on assigned drivers.
 * Silently skips if no matching leagues are found.
 */
export async function syncLeagueRegistrationsFirestore(
  db: any,
  teamId: string,
  teamCars: any[],
  existingTeam: any,
): Promise<void> {
  const { runWithTimeout } = await import('@/lib/firebase')

  const regSnap = await db.collection('league_registrations').where('team_id', '==', teamId).get()
  const regLeagueIds = regSnap.docs.map((doc: any) => doc.data()?.league_id).filter(Boolean)

  const carLeagueIds = teamCars.map((car: any) => car.leagueId || car.league_id).filter(Boolean)
  const teamLeagueId = existingTeam?.league_id || existingTeam?.leagueId

  const targetLeagueIds = Array.from(
    new Set([...regLeagueIds, ...carLeagueIds, teamLeagueId].filter(Boolean)),
  ) as string[]

  for (const leagueId of targetLeagueIds) {
    let leagueDoc = await db.collection('leagues').doc(leagueId).get()
    if (!leagueDoc.exists) {
      const slugSnap = await db.collection('leagues').where('slug', '==', leagueId).get()
      if (!slugSnap.empty) {
        leagueDoc = slugSnap.docs[0]
      }
    }

    if (!leagueDoc.exists) continue

    const realLeagueId = leagueDoc.id
    const leagueData = leagueDoc.data()
    const leagueClassTags = parseClassTags(leagueData?.class_tags || leagueData?.classTags) || []

    const matchingCars = teamCars.filter((car: any) => {
      if (!car.category) return false
      const c1 = car.category.toUpperCase()
      const carLeagueId = car.leagueId || car.league_id
      const isExplicitLeague = Boolean(
        carLeagueId && (carLeagueId === realLeagueId || carLeagueId === leagueData?.slug),
      )
      if (carLeagueId && !isExplicitLeague) return false
      return (
        isExplicitLeague ||
        leagueClassTags.length === 0 ||
        leagueClassTags.some((tag: any) => {
          const c2 = tag.toUpperCase()
          return c1 === c2 || (c1.startsWith('LMP') && c2.startsWith('LMP'))
        })
      )
    })

    if (matchingCars.length === 0) continue

    const otherRegsSnap = await db
      .collection('league_registrations')
      .where('league_id', '==', realLeagueId)
      .get()
    const otherRegs = otherRegsSnap.docs
      .map((d: any) => d.data())
      .filter((r: any) => r.team_id !== teamId)

    const registrationsInThisLeague: any[] = []

    for (const car of matchingCars) {
      const carClassTag = String(car.category || '').toUpperCase()
      const carDorsal = String(car.dorsal || '').trim()

      let regCarNumber = carDorsal
      if (!regCarNumber) {
        for (let num = 12; num <= 99; num++) {
          const numStr = String(num)
          const taken = otherRegs.some(
            (r: any) =>
              r.class_tag === carClassTag &&
              String(r.assigned_number ?? '').trim() === numStr &&
              r.status !== 'rejected',
          )
          if (!taken) {
            regCarNumber = numStr
            break
          }
        }
      } else {
        const isTaken = otherRegs.some(
          (r: any) =>
            r.class_tag === carClassTag &&
            String(r.assigned_number ?? '').trim() === regCarNumber &&
            r.status !== 'rejected',
        )
        if (isTaken) {
          for (let num = 12; num <= 99; num++) {
            const numStr = String(num)
            const taken = otherRegs.some(
              (r: any) =>
                r.class_tag === carClassTag &&
                String(r.assigned_number ?? '').trim() === numStr &&
                r.status !== 'rejected',
            )
            if (!taken) {
              regCarNumber = numStr
              break
            }
          }
        }
      }

      let carDrivers: string[] = []
      const byLeague = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
      if (byLeague[realLeagueId] && Array.isArray(byLeague[realLeagueId]) && byLeague[realLeagueId].length > 0) {
        carDrivers = byLeague[realLeagueId].filter(Boolean).map(String)
      } else if (leagueData?.slug && byLeague[leagueData.slug] && Array.isArray(byLeague[leagueData.slug]) && byLeague[leagueData.slug].length > 0) {
        carDrivers = byLeague[leagueData.slug].filter(Boolean).map(String)
      } else if (Array.isArray(car.driverUserIds) && car.driverUserIds.length > 0) {
        carDrivers = car.driverUserIds.filter(Boolean).map(String)
      } else if (Array.isArray(car.driver_user_ids) && car.driver_user_ids.length > 0) {
        carDrivers = car.driver_user_ids.filter(Boolean).map(String)
      }

      if (carDrivers.length === 0) {
        try {
          const confSnap = await db
            .collection('league_event_confirmations')
            .where('team_id', '==', teamId)
            .where('class_tag', '==', carClassTag)
            .get()
          const batch = db.batch()
          confSnap.docs.forEach((cDoc: any) => {
            const d = cDoc.data()
            if (
              String(d.car_number ?? '').trim() === String(regCarNumber ?? '').trim() ||
              String(d.car_number ?? '').trim() === String(carDorsal ?? '').trim()
            ) {
              batch.delete(cDoc.ref)
            }
          })
          await batch.commit()
        } catch (e) {
          console.error('Failed deleting event confirmations for car with 0 drivers:', e)
        }
      } else {
        for (const userId of carDrivers) {
          let displayName = `Pilot ${userId.slice(0, 4)}`
          const existingMember = (existingTeam?.members || []).find(
            (m: any) => m.userId === userId || m.user_id === userId,
          )
          if (existingMember?.name || existingMember?.displayName || existingMember?.display_name) {
            displayName = existingMember.name || existingMember.displayName || existingMember.display_name
          }
          registrationsInThisLeague.push({
            league_id: realLeagueId,
            user_id: userId,
            team_id: teamId,
            display_name: displayName,
            status: 'approved',
            class_tag: carClassTag,
            assigned_number: regCarNumber,
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    const existingRegsSnap = await db
      .collection('league_registrations')
      .where('league_id', '==', realLeagueId)
      .where('team_id', '==', teamId)
      .get()
    const batch = db.batch()
    existingRegsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))
    for (const newReg of registrationsInThisLeague) {
      const docId = `${realLeagueId}_${newReg.class_tag}_${newReg.user_id}_${newReg.assigned_number}`
      const docRef = db.collection('league_registrations').doc(docId)
      batch.set(docRef, newReg, { merge: true })
    }
    await batch.commit()
  }
}

// ─── Mock (Cookie) Mode ───────────────────────────────────────────────────────

/**
 * Auto-syncs league registrations in Mock/cookie mode when a team's cars are saved.
 */
export async function syncLeagueRegistrationsMock(
  cookieStore: any,
  session: any,
  teamId: string,
  teamCars: any[],
): Promise<void> {
  const mockRegsCookie = cookieStore.get('mock_registrations')?.value
  let listRegs: any[] = []
  if (mockRegsCookie) {
    listRegs = JSON.parse(mockRegsCookie)
  } else {
    const { mockRegistrations: defaultRegs } = await import('@/data/mock')
    listRegs = [...defaultRegs]
  }

  const mockLeaguesCookie = cookieStore.get('mock_leagues')?.value
  let listLeagues: any[] = []
  if (mockLeaguesCookie) {
    listLeagues = JSON.parse(mockLeaguesCookie)
  } else {
    const { leagues: defaultLeagues } = await import('@/data/mock')
    listLeagues = [...defaultLeagues]
  }

  const registeredLeagues = Array.from(
    new Set([
      ...listRegs.filter((r: any) => r.teamId === teamId).map((r: any) => r.leagueId).filter(Boolean),
      ...teamCars.map((c: any) => c.leagueId || c.league_id).filter(Boolean),
      ...listLeagues.map((l: any) => l.id),
    ]),
  ) as string[]

  if (registeredLeagues.length === 0) return

  for (const leagueId of registeredLeagues) {
    const league = listLeagues.find((l: any) => l.id === leagueId)
    if (!league) continue

    const leagueClassTags = league.classTags || []
    const matchingCars = teamCars.filter((car: any) => {
      if (!car.category) return false
      const c1 = car.category.toUpperCase()
      const carLeagueId = car.leagueId || car.league_id
      const isExplicitLeague = Boolean(carLeagueId && (carLeagueId === league.id || carLeagueId === league.slug))
      if (carLeagueId && !isExplicitLeague) return false
      return (
        isExplicitLeague ||
        leagueClassTags.length === 0 ||
        leagueClassTags.some((tag: any) => {
          const c2 = tag.toUpperCase()
          return c1 === c2 || (c1.startsWith('LMP') && c2.startsWith('LMP'))
        })
      )
    })

    const otherRegs = listRegs.filter((r: any) => r.leagueId === leagueId && r.teamId !== teamId)
    const newRegistrationsForLeague: any[] = []

    for (const car of matchingCars) {
      const carClassTag = String(car.category || '').toUpperCase()
      const carDorsal = String(car.dorsal || '').trim()

      let regCarNumber = carDorsal
      if (!regCarNumber) {
        for (let num = 12; num <= 99; num++) {
          const numStr = String(num)
          const taken = otherRegs.some(
            (r: any) =>
              r.classTag === carClassTag &&
              String(r.assignedNumber ?? '').trim() === numStr &&
              r.status !== 'rejected',
          )
          if (!taken) {
            regCarNumber = numStr
            break
          }
        }
      } else {
        const isTaken = otherRegs.some(
          (r: any) =>
            r.classTag === carClassTag &&
            String(r.assignedNumber ?? '').trim() === regCarNumber &&
            r.status !== 'rejected',
        )
        if (isTaken) {
          for (let num = 12; num <= 99; num++) {
            const numStr = String(num)
            const taken = otherRegs.some(
              (r: any) =>
                r.classTag === carClassTag &&
                String(r.assignedNumber ?? '').trim() === numStr &&
                r.status !== 'rejected',
            )
            if (!taken) {
              regCarNumber = numStr
              break
            }
          }
        }
      }

      let carDrivers: string[] = []
      const byLeagueMock = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
      if (byLeagueMock[leagueId] && Array.isArray(byLeagueMock[leagueId]) && byLeagueMock[leagueId].length > 0) {
        carDrivers = byLeagueMock[leagueId].filter(Boolean).map(String)
      } else if (Array.isArray(car.driverUserIds) && car.driverUserIds.length > 0) {
        carDrivers = car.driverUserIds.filter(Boolean).map(String)
      }

      if (carDrivers.length > 0) {
        for (const userId of carDrivers) {
          newRegistrationsForLeague.push({
            id: `mock_reg_${Date.now()}_${carClassTag}_${userId}_${regCarNumber}`,
            leagueId,
            userId,
            teamId,
            displayName:
              userId === session.userId
                ? session.steamDisplayName || 'Team Leader'
                : `Driver ${userId.slice(0, 4)}`,
            steamId: `steam_${userId}`,
            classTag: carClassTag,
            assignedNumber: regCarNumber,
            createdAt: new Date().toISOString(),
            status: 'approved',
          })
        }
      } else {
        try {
          const mockConfCookie = cookieStore.get('mock_event_confirmations')?.value
          if (mockConfCookie) {
            let mockConfs = JSON.parse(mockConfCookie)
            mockConfs = mockConfs.filter(
              (c: any) =>
                !(
                  c.teamId === teamId &&
                  String(c.classTag || '').toUpperCase() === carClassTag &&
                  (String(c.carNumber || '').trim() === regCarNumber ||
                    String(c.carNumber || '').trim() === carDorsal)
                ),
            )
            cookieStore.set('mock_event_confirmations', JSON.stringify(mockConfs), {
              path: '/',
              maxAge: 60 * 60 * 24 * 30,
            })
          }
        } catch { }
      }
    }

    listRegs = listRegs.filter((r: any) => !(r.leagueId === leagueId && r.teamId === teamId))
    listRegs.push(...newRegistrationsForLeague)
  }

  cookieStore.set('mock_registrations', JSON.stringify(listRegs), {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}
