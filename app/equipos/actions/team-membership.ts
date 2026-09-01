'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getFirestoreDb, hasFirebase, runWithTimeout } from '@/lib/firebase'
import { getTeamsDashboard } from '@/lib/team-data'
import { createNotification, notifyTeamInvitation } from '@/lib/notifications-data'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardSession, canManageTeam } from './team-parsers'

export async function invitePilot(formData: FormData) {
  const session = await guardSession()
  const redirectTo = String(formData.get('redirectTo') || '/equipos')
  const teamId = String(formData.get('teamId') || '')
  const invitedUserIdFromForm = String(formData.get('invitedUserId') || '').trim()
  const steamIdFromForm = String(formData.get('steamId') || '').trim()
  const message = String(formData.get('message') || '').trim()
  if (!teamId || (!invitedUserIdFromForm && !steamIdFromForm)) redirect(`${redirectTo}?error=invite-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  let invitedUserId: string | null = invitedUserIdFromForm || null
  let steamId = steamIdFromForm
  let invitedViaFirestore = false
  let redirectUrl: string | null = null

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        if (invitedUserId && !steamId) {
          const snapshot = await runWithTimeout(db.collection('steam_accounts').where('user_id', '==', invitedUserId).limit(1).get(), 3000)
          if (!snapshot.empty) {
            steamId = snapshot.docs[0].data().steam_id || ''
          }
        } else if (!invitedUserId && steamId) {
          const snapshot = await runWithTimeout(db.collection('steam_accounts').where('steam_id', '==', steamId).limit(1).get(), 3000)
          if (!snapshot.empty) {
            invitedUserId = snapshot.docs[0].data().user_id || null
          }
        }

        if (steamId) {
          if (invitedUserId) {
            const memberDoc = await runWithTimeout(db.collection('team_members').doc(`${teamId}_${invitedUserId}`).get(), 3000)
            if (memberDoc.exists) {
              redirectUrl = `${redirectTo}?error=already-member`
            }
          }

          if (!redirectUrl) {
            await runWithTimeout(db.collection('team_invites').add({
              team_id: teamId,
              invited_by_user_id: session.userId,
              invited_user_id: invitedUserId,
              invited_steam_id: steamId,
              message: message || null,
              status: 'pending',
              created_at: new Date(),
            }), 4000)

            invitedViaFirestore = true
          }
        }
      } catch (error) {
        console.error('Failed to invite pilot in Firestore (falling back to mock):', error)
      }
    }
  }

  if (redirectUrl) {
    redirect(redirectUrl)
  }

  // Fallback / Dual-mode Mock Invite
  if (!invitedViaFirestore) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const existingInvites = cookieStore.get('mock_invites')?.value
      const invites = existingInvites ? JSON.parse(existingInvites) : []
      invites.push({
        id: `mock_invite_${Date.now()}`,
        team_id: teamId,
        invited_by_user_id: session.userId,
        invited_user_id: invitedUserId,
        invited_steam_id: steamId || 'mock_steam',
        message: message || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      cookieStore.set('mock_invites', JSON.stringify(invites), { path: '/', maxAge: 60 * 60 * 24 * 30 })
    } catch (e) {
      console.error('Failed to invite mock pilot:', e)
      redirect(`${redirectTo}?error=invite-failed`)
    }
  }

  // Send notification to invited user
  if (invitedUserId) {
    try {
      const dashboard = await getTeamsDashboard(session.userId)
      const team = dashboard.teams.find((t) => t.id === teamId)
      const teamName = team?.name || 'Equipo'
      await notifyTeamInvitation({
        invitedUserId,
        teamName,
        message: message || `${teamName} has sent you an invitation to join their team.`,
      })
    } catch (errNotif) {
      console.error('Failed to send team invite notification:', errNotif)
    }
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?invite=1`)
}

export async function removeTeamMember(formData: FormData) {
  const session = await guardSession()
  const redirectTo = String(formData.get('redirectTo') || '/equipos')
  const teamId = String(formData.get('teamId') || '')
  const memberUserId = String(formData.get('memberUserId') || '')
  if (!teamId || !memberUserId) redirect(`${redirectTo}?error=member-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  let removedFromFirestore = false
  let redirectUrl: string | null = null
  let removedDriverName = 'Driver'
  let teamName = ''
  let ownerUserIdToNotify = ''
  const removedCarsList: string[] = []

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const teamDoc = await runWithTimeout(db.collection('teams').doc(teamId).get(), 3000)
        if (teamDoc.exists) {
          const team = teamDoc.data()
          teamName = team?.name || ''
          ownerUserIdToNotify = team?.owner_user_id || ''

          if (team?.owner_user_id === memberUserId) {
            redirectUrl = `${redirectTo}?error=owner-protected`
          } else {
            // Get member display name before deleting
            const memberDoc = await db.collection('team_members').doc(`${teamId}_${memberUserId}`).get()
            if (memberDoc.exists) {
              removedDriverName = memberDoc.data()?.display_name || removedDriverName
            }

            // 1. Delete member from team_members collection
            await runWithTimeout(db.collection('team_members').doc(`${teamId}_${memberUserId}`).delete(), 3000)

            // 2. Remove member from league_registrations for this team
            try {
              const regSnap = await db
                .collection('league_registrations')
                .where('team_id', '==', teamId)
                .where('user_id', '==', memberUserId)
                .get()

              if (!regSnap.empty) {
                const batch = db.batch()
                regSnap.docs.forEach((doc: any) => batch.delete(doc.ref))
                await batch.commit()
              }
            } catch (errReg) {
              console.error('Failed to remove league registrations for member:', errReg)
            }

            // 3. Update team.cars: remove driver from slots (keep vehicle configuration)
            const currentCars = Array.isArray(team?.cars) ? team.cars : []
            const updatedCars = currentCars.map((car: any) => {
              const currentDrivers = Array.isArray(car.driverUserIds)
                ? car.driverUserIds
                : Array.isArray(car.driver_user_ids)
                ? car.driver_user_ids
                : []

              const filteredDrivers = currentDrivers.filter((id: string) => id && id !== memberUserId)

              const byLeague = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
              const updatedByLeague: Record<string, string[]> = {}
              Object.keys(byLeague).forEach((lKey) => {
                if (Array.isArray(byLeague[lKey])) {
                  updatedByLeague[lKey] = byLeague[lKey].map((id: string) => (id === memberUserId ? '' : id))
                }
              })

              return {
                ...car,
                driverUserIds: filteredDrivers,
                driverUserIdsByLeague: updatedByLeague,
                driver_user_ids_by_league: updatedByLeague,
              }
            })

            await db.collection('teams').doc(teamId).update({ cars: updatedCars })

            // 4. Delete market applications for this driver & team
            try {
              const marketAppsSnap = await db
                .collection('market_applications')
                .where('team_id', '==', teamId)
                .where('user_id', '==', memberUserId)
                .get()

              if (!marketAppsSnap.empty) {
                const batch = db.batch()
                marketAppsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))
                await batch.commit()
              }
            } catch (errApp) {
              console.error('Failed to clean up market applications on member removal:', errApp)
            }

            removedFromFirestore = true
          }
        }
      } catch (error) {
        console.error('Failed to remove team member in Firestore (falling back to mock):', error)
      }
    }
  }

  if (redirectUrl) {
    redirect(redirectUrl)
  }

  // Fallback / Dual-mode Mock Remove
  let mockRemoveSucceeded = false
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const teamsVal = cookieStore.get('mock_teams')?.value
    if (teamsVal) {
      const teams = JSON.parse(teamsVal)
      const teamIdx = teams.findIndex((t: any) => t.id === teamId)
      if (teamIdx !== -1) {
        const team = teams[teamIdx]
        teamName = team.name || teamName
        ownerUserIdToNotify = team.ownerUserId || ownerUserIdToNotify

        if (team.ownerUserId === memberUserId) {
          redirectUrl = `${redirectTo}?error=owner-protected`
        } else {
          // Find member name
          if (Array.isArray(team.members)) {
            const memberObj = team.members.find((m: any) => m.userId === memberUserId)
            if (memberObj) {
              removedDriverName = memberObj.displayName || memberObj.name || removedDriverName
            }
            team.members = team.members.filter((m: any) => m.userId !== memberUserId)
          }

          // Clean up driver slots in mock team cars
          if (Array.isArray(team.cars)) {
            team.cars = team.cars.map((car: any) => {
              const filteredDrivers = (car.driverUserIds || []).filter((id: string) => id && id !== memberUserId)
              const byLeague = car.driverUserIdsByLeague || car.driver_user_ids_by_league || {}
              const updatedByLeague: Record<string, string[]> = {}
              Object.keys(byLeague).forEach((lKey) => {
                if (Array.isArray(byLeague[lKey])) {
                  updatedByLeague[lKey] = byLeague[lKey].map((id: string) => (id === memberUserId ? '' : id))
                }
              })
              return {
                ...car,
                driverUserIds: filteredDrivers,
                driverUserIdsByLeague: updatedByLeague,
                driver_user_ids_by_league: updatedByLeague,
              }
            })
          }

          cookieStore.set('mock_teams', JSON.stringify(teams), { path: '/', maxAge: 60 * 60 * 24 * 30 })

          // Clean up mock registrations
          try {
            const mockRegsVal = cookieStore.get('mock_registrations')?.value
            if (mockRegsVal) {
              const regs = JSON.parse(mockRegsVal)
              const updatedRegs = regs.filter((r: any) => !(r.teamId === teamId && r.userId === memberUserId))
              cookieStore.set('mock_registrations', JSON.stringify(updatedRegs), { path: '/', maxAge: 60 * 60 * 24 * 30 })
            }
          } catch {}

          // Clean up mock market applications
          try {
            const mockMarketAppsVal = cookieStore.get('mock_market_applications')?.value
            if (mockMarketAppsVal) {
              const apps = JSON.parse(mockMarketAppsVal)
              const updatedApps = apps.filter((a: any) => !(a.teamId === teamId && a.userId === memberUserId))
              cookieStore.set('mock_market_applications', JSON.stringify(updatedApps), { path: '/', maxAge: 60 * 60 * 24 * 7 })
            }
          } catch {}

          mockRemoveSucceeded = true
        }
      }
    }
  } catch (e) {
    console.error('Failed to remove mock team member:', e)
  }

  if (redirectUrl) {
    redirect(redirectUrl)
  }

  if (!removedFromFirestore && !mockRemoveSucceeded) {
    redirect(`${redirectTo}?error=remove-failed`)
  }

  // Create Notification for Team Leader
  if (ownerUserIdToNotify) {
    const carNoticeMsg = removedCarsList.length > 0
      ? ` Additionally, vehicle(s) ${removedCarsList.join(', ')} were automatically unassigned due to having no active drivers.`
      : ''

    await createNotification({
      userId: ownerUserIdToNotify,
      title: 'Driver Departure & Vehicle Update',
      message: `Driver ${removedDriverName} has left team ${teamName}.${carNoticeMsg}`,
      link: `/equipos/${teamId}`
    })
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  revalidatePath('/ligas')
  redirect(`${redirectTo}?memberRemoved=1`)
}

export async function updateTeamMemberRole(formData: FormData) {
  const session = await guardSession()
  const redirectTo = String(formData.get('redirectTo') || '/equipos')
  const teamId = String(formData.get('teamId') || '')
  const memberUserId = String(formData.get('memberUserId') || '')
  const role = String(formData.get('role') || '').trim().toLowerCase()
  if (!teamId || !memberUserId) redirect(`${redirectTo}?error=member-required`)

  const allowed = await canManageTeam(teamId, session.userId)
  if (!allowed) redirect(`${redirectTo}?error=forbidden`)

  if (role !== 'driver' && role !== 'manager') {
    redirect(`${redirectTo}?error=invalid-role`)
  }

  let updatedInFirestore = false
  let redirectUrl: string | null = null

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const teamDoc = await runWithTimeout(db.collection('teams').doc(teamId).get(), 3000)
        if (teamDoc.exists) {
          const team = teamDoc.data()
          if (team?.owner_user_id === memberUserId) {
            redirectUrl = `${redirectTo}?error=owner-protected`
          } else {
            await runWithTimeout(db.collection('team_members').doc(`${teamId}_${memberUserId}`).update({ role }), 3000)
            updatedInFirestore = true
          }
        }
      } catch (error) {
        console.error('Failed to update member role in Firestore (falling back to mock):', error)
      }
    }
  }

  if (redirectUrl) {
    redirect(redirectUrl)
  }

  // Fallback / Dual-mode Mock Update
  let mockUpdateSucceeded = false
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const teamsVal = cookieStore.get('mock_teams')?.value
    if (teamsVal) {
      const teams = JSON.parse(teamsVal)
      const teamIdx = teams.findIndex((t: any) => t.id === teamId)
      if (teamIdx !== -1) {
        const team = teams[teamIdx]
        if (team.ownerUserId === memberUserId) {
          redirectUrl = `${redirectTo}?error=owner-protected`
        } else {
          if (Array.isArray(team.members)) {
            const mIdx = team.members.findIndex((m: any) => m.userId === memberUserId)
            if (mIdx !== -1) {
              team.members[mIdx].role = role
              cookieStore.set('mock_teams', JSON.stringify(teams), { path: '/', maxAge: 60 * 60 * 24 * 30 })
            }
          }
          mockUpdateSucceeded = true
        }
      }
    }
  } catch (e) {
    console.error('Failed to update mock role:', e)
  }

  if (redirectUrl) {
    redirect(redirectUrl)
  }

  if (!updatedInFirestore && !mockUpdateSucceeded) {
    redirect(`${redirectTo}?error=role-update-failed`)
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/equipos')
  revalidatePath(`/equipos/${teamId}`)
  redirect(`${redirectTo}?roleUpdated=1`)
}