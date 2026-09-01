'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'
import { getRegistrations, getLeagueBySlug } from '@/lib/platform-data'
import { parseClassTags } from '@/lib/firestore-utils'
import { invalidateCache } from '@/lib/ttl-cache'

function parseCarNumber(dorsal: any): number {
  if (dorsal == null) return 0
  const str = String(dorsal).replace(/[^0-9]/g, '')
  const num = parseInt(str, 10)
  return isNaN(num) ? 0 : num
}

export async function registerTeamAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  let slug = String(formData.get('slug') || '')
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const inputClassTag = String(formData.get('classTag') || '').trim().toUpperCase()
  const carModel = String(formData.get('carModel') || '')
  const carNumberInput = parseCarNumber(formData.get('carNumber'))
  const driverUserIds = formData.getAll('driverUserIds').map(String)

  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required.')
  }

  // Fetch the league and its classTags by leagueId or slug
  let leagueClassTags: string[] = []
  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db && leagueId) {
      try {
        const leagueDoc = await db.collection('leagues').doc(leagueId).get()
        if (leagueDoc.exists) {
          const lData = leagueDoc.data()
          leagueClassTags = parseClassTags(lData?.class_tags || lData?.classTags) || []
          if (!slug) slug = lData?.slug || leagueId
        }
      } catch (err) {
        console.error('Failed to fetch league by ID in registerTeamAction:', err)
      }
    }
  }

  if (leagueClassTags.length === 0 && slug) {
    try {
      const league = await getLeagueBySlug(slug)
      leagueClassTags = league?.classTags || []
    } catch (err) {
      console.error('Failed to resolve league details by slug:', err)
    }
  }

  // Load team cars/members to perform automatic complete team registration (GT3, LMP2, etc.)
  let teamCars: any[] = []
  let teamMembers: any[] = []

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const teamDoc = await db.collection('teams').doc(teamId).get()
        if (teamDoc.exists) {
          const teamData = teamDoc.data()
          teamCars = teamData?.cars || []
        }
        const membersSnap = await db.collection('team_members').where('team_id', '==', teamId).get()
        teamMembers = membersSnap.docs.map((doc: any) => ({
          userId: doc.data()?.user_id || '',
          role: doc.data()?.role || '',
        }))
      } catch (e) {
        console.error('Failed to load team data in Firestore action:', e)
      }
    }
  } else {
    try {
      const cookieStore = await cookies()
      const existingTeams = cookieStore.get('mock_teams')?.value
      if (existingTeams) {
        const teams = JSON.parse(existingTeams)
        const foundTeam = teams.find((t: any) => t.id === teamId)
        if (foundTeam) {
          teamCars = foundTeam.cars || []
          teamMembers = foundTeam.members || []
        }
      }
    } catch (e) {
      console.error('Failed to load team data from cookies:', e)
    }
  }

  // Find all cars in the team's workshop that match the league's classTags
  const matchingCars = teamCars.filter((car: any) => {
    if (!car.category) return false
    const c1 = car.category.toUpperCase()
    const carLeagueId = car.leagueId || car.league_id
    if (carLeagueId && carLeagueId !== leagueId) return false
    return leagueClassTags.some((tag: any) => {
      const c2 = tag.toUpperCase()
      return c1 === c2 || (c1.startsWith('LMP') && c2.startsWith('LMP'))
    })
  })

  type CarToRegister = {
    classTag: string
    carModel: string
    carNumber: number
    driverUserIds: string[]
  }

  const carsToRegister: CarToRegister[] = []

  if (matchingCars.length > 0) {
    for (const car of matchingCars) {
      const carClassTag = String(car.category || '').toUpperCase()
      const carNum = parseCarNumber(car.dorsal)
      const carMod = String(car.model || '')
      
      let carDrivers = Array.isArray(car.driverUserIds)
        ? car.driverUserIds.filter(Boolean).map(String)
        : Array.isArray(car.driver_user_ids)
        ? car.driver_user_ids.filter(Boolean).map(String)
        : []

      const byLeague = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
      if (byLeague[leagueId] && Array.isArray(byLeague[leagueId]) && byLeague[leagueId].length > 0) {
        carDrivers = byLeague[leagueId].filter(Boolean).map(String)
      }
      
      if (carDrivers.length === 0) {
        carDrivers = driverUserIds.length > 0 ? driverUserIds : [session.userId]
      }

      carsToRegister.push({
        classTag: carClassTag,
        carModel: carMod,
        carNumber: carNum,
        driverUserIds: carDrivers,
      })
    }
  } else {
    // Fallback: register the single selected class from the form
    let fallbackClassTag = inputClassTag
    if (!fallbackClassTag || fallbackClassTag === 'GENERAL' || !leagueClassTags.map(t => t.toUpperCase()).includes(fallbackClassTag)) {
      fallbackClassTag = (leagueClassTags[0] || 'GT3').toUpperCase()
    }

    carsToRegister.push({
      classTag: fallbackClassTag,
      carModel: carModel,
      carNumber: carNumberInput,
      driverUserIds: driverUserIds.length > 0 ? driverUserIds : [session.userId],
    })
  }

  // Get current registrations to check for taken numbers
  const registrations = await getRegistrations(leagueId)

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      // 1. Clean up previous registrations for this team in this league to prevent orphans
      try {
        const oldRegsSnap = await db
          .collection('league_registrations')
          .where('league_id', '==', leagueId)
          .where('team_id', '==', teamId)
          .get()
        const deleteBatch = db.batch()
        oldRegsSnap.docs.forEach((d: any) => deleteBatch.delete(d.ref))
        await deleteBatch.commit()
      } catch (err) {
        console.error('Failed to clean up old registrations in Firestore:', err)
      }

      // 2. Insert new registrations
      const batch = db.batch()
      
      for (const carToReg of carsToRegister) {
        // Resolve display names for each user in driverUserIds
        const driverInfos = await Promise.all(
          carToReg.driverUserIds.map(async (userId) => {
            let displayName = `Pilot ${userId.slice(0, 4)}`
            try {
              const profileDoc = await db.collection('profiles').doc(userId).get()
              if (profileDoc.exists) {
                displayName = profileDoc.data()?.display_name || displayName
              } else {
                const steamDoc = await db.collection('steam_accounts').doc(userId).get()
                if (steamDoc.exists) {
                  displayName = steamDoc.data()?.steam_display_name || displayName
                }
              }
            } catch (e) {
              console.error('Failed to resolve display name for driver registration:', e)
            }
            return { userId, displayName }
          })
        )

        // Make sure carNumber is valid and not taken in this specific category
        let regCarNumber = carToReg.carNumber
        if (regCarNumber <= 0) {
          // Generate a free number
          for (let num = 12; num <= 99; num++) {
            const taken = registrations.some(
              (r) => r.classTag === carToReg.classTag && r.assignedNumber === num && r.status !== 'rejected'
            )
            if (!taken) {
              regCarNumber = num
              break
            }
          }
        } else {
          const isTaken = registrations.some(
            (r) => r.classTag === carToReg.classTag && r.assignedNumber === regCarNumber && r.status !== 'rejected'
          )
          if (isTaken) {
            // Find a free fallback number instead of crashing the batch
            for (let num = 12; num <= 99; num++) {
              const taken = registrations.some(
                (r) => r.classTag === carToReg.classTag && r.assignedNumber === num && r.status !== 'rejected'
              )
              if (!taken) {
                regCarNumber = num
                break
              }
            }
          }
        }

        // Create a league_registration for each driver in this category
        for (const info of driverInfos) {
          // Ensure docId is unique per car number to support multiple cars of same class
          const docId = `${leagueId}_${carToReg.classTag}_${info.userId}_${regCarNumber}`
          const docRef = db.collection('league_registrations').doc(docId)
          batch.set(docRef, {
            league_id: leagueId,
            user_id: info.userId,
            team_id: teamId,
            display_name: info.displayName,
            status: 'pending',
            class_tag: carToReg.classTag,
            assigned_number: regCarNumber,
            created_at: new Date().toISOString(),
          }, { merge: true })
        }
      }
      
      await batch.commit()
    }
  } else {
    // Mock Mode
    try {
      const cookieStore = await cookies()
      const existing = cookieStore.get('mock_registrations')?.value
      
      let list = []
      if (existing) {
        list = JSON.parse(existing)
      } else {
        const { mockRegistrations: defaultRegs } = await import('@/data/mock')
        list = [...defaultRegs]
      }

      // 1. Remove ALL existing registrations for this team in this league ONCE before registering new ones
      list = list.filter((r: any) => !(r.leagueId === leagueId && r.teamId === teamId))

      for (const carToReg of carsToRegister) {
        // Resolve car number
        let regCarNumber = carToReg.carNumber
        if (regCarNumber <= 0) {
          for (let num = 12; num <= 99; num++) {
            const taken = registrations.some(
              (r) => r.classTag === carToReg.classTag && r.assignedNumber === num && r.status !== 'rejected'
            )
            if (!taken) {
              regCarNumber = num
              break
            }
          }
        } else {
          const isTaken = registrations.some(
            (r) => r.classTag === carToReg.classTag && r.assignedNumber === regCarNumber && r.status !== 'rejected'
          )
          if (isTaken) {
            for (let num = 12; num <= 99; num++) {
              const taken = registrations.some(
                (r) => r.classTag === carToReg.classTag && r.assignedNumber === num && r.status !== 'rejected'
              )
              if (!taken) {
                regCarNumber = num
                break
              }
            }
          }
        }

        // Create registrations for selected drivers for this category
        const newRegs = carToReg.driverUserIds.map((userId) => ({
          id: `mock_reg_${Date.now()}_${carToReg.classTag}_${userId}_${regCarNumber}`,
          leagueId,
          userId,
          teamId,
          displayName: userId === session.userId ? (session.steamDisplayName || 'Team Leader') : `Driver ${userId.slice(0, 4)}`,
          steamId: `steam_${userId}`,
          classTag: carToReg.classTag,
          assignedNumber: regCarNumber,
          createdAt: new Date().toISOString(),
          status: 'pending',
        }))

        // Just push them to the list (we already filtered once at the start!)
        list.push(...newRegs)
      }

      cookieStore.set('mock_registrations', JSON.stringify(list), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    } catch (e) {
      console.error('Failed to save mock registrations:', e)
    }
  }

  invalidateCache(['teams_dashboard', 'platform_leagues', 'leagues', 'registrations_', 'event_confirmations_'])
  revalidatePath('/ligas')
  if (slug) revalidatePath(`/ligas/${slug}`)
  revalidatePath('/equipos')
}

export async function unregisterTeamAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  let slug = String(formData.get('slug') || '')
  const leagueId = String(formData.get('leagueId') || '')
  const teamId = String(formData.get('teamId') || '')
  const classTag = String(formData.get('classTag') || '')

  if (!leagueId || !teamId) {
    throw new Error('League ID and Team ID are required.')
  }

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      if (!slug) {
        try {
          const lDoc = await db.collection('leagues').doc(leagueId).get()
          if (lDoc.exists) slug = lDoc.data()?.slug || ''
        } catch {}
      }

      const snapshot = await db
        .collection('league_registrations')
        .where('league_id', '==', leagueId)
        .where('team_id', '==', teamId)
        .get()

      const batch = db.batch()
      snapshot.docs.forEach((doc: any) => {
        const c = String(doc.data()?.class_tag || doc.data()?.classTag || '').toUpperCase()
        if (!classTag || c === classTag.toUpperCase()) {
          batch.delete(doc.ref)
        }
      })
      await batch.commit()
    }
  }

  // Mock Mode Fallback
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const existing = cookieStore.get('mock_registrations')?.value
    
    let list = []
    if (existing) {
      list = JSON.parse(existing)
    } else {
      const { mockRegistrations: defaultRegs } = await import('@/data/mock')
      list = [...defaultRegs]
    }

    list = list.filter(
      (r: any) =>
        !(
          (r.leagueId === leagueId || r.league_id === leagueId) &&
          (r.teamId === teamId || r.team_id === teamId) &&
          (!classTag || String(r.classTag || r.class_tag || '').toUpperCase() === classTag.toUpperCase())
        )
    )

    cookieStore.set('mock_registrations', JSON.stringify(list), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  } catch (e) {
    console.error('Failed to delete mock registration:', e)
  }

  invalidateCache(['teams_dashboard', 'registrations_', 'event_confirmations_'])
  revalidatePath('/ligas')
  if (slug) revalidatePath(`/ligas/${slug}`)
  revalidatePath('/equipos')
}

