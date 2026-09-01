'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'

import { invalidateCache } from '@/lib/ttl-cache'

export async function respondTeamInvite(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const inviteId = String(formData.get('inviteId') || '')
  const decision = String(formData.get('decision') || '').toLowerCase()
  if (!inviteId || (decision !== 'accepted' && decision !== 'rejected')) redirect('/perfil')

  let handled = false

  if (hasFirebase) {
    const db = getFirestoreDb()
    if (db) {
      try {
        const inviteRef = db.collection('team_invites').doc(inviteId)
        const doc = await inviteRef.get()
        if (doc.exists) {
          const invite = doc.data()
          if (invite.status === 'pending') {
            const isInviteForUser =
              invite.invited_user_id === session.userId ||
              String(invite.invited_steam_id || '') === session.steamId

            if (isInviteForUser) {
              await inviteRef.update({ status: decision })

              if (decision === 'accepted') {
                const memberRef = db.collection('team_members').doc(`${invite.team_id}_${session.userId}`)
                await memberRef.set({
                  team_id: invite.team_id,
                  user_id: session.userId,
                  role: 'driver',
                  created_at: new Date(),
                })

                // Cleanup driver's market listings
                const listingsSnap = await db.collection('market_listings')
                  .where('user_id', '==', session.userId)
                  .get()
                
                const batch = db.batch()
                listingsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

                // Cleanup driver's pending applications
                const appsSnap = await db.collection('market_applications')
                  .where('user_id', '==', session.userId)
                  .where('status', '==', 'pending')
                  .get()
                appsSnap.docs.forEach((doc: any) => batch.delete(doc.ref))

                // Cleanup driver's other pending invites
                const invitesSnap = await db.collection('team_invites')
                  .where('invited_user_id', '==', session.userId)
                  .where('status', '==', 'pending')
                  .get()
                invitesSnap.docs.forEach((doc: any) => {
                  if (doc.id !== inviteId) {
                    batch.delete(doc.ref)
                  }
                })

                await batch.commit()
              }
              handled = true
            }
          }
        }
      } catch (error) {
        console.error('Failed to respond to team invite in Firestore:', error)
      }
    }
  }

  if (!handled) {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()

      // Handle mock invites
      const mockInvitesVal = cookieStore.get('mock_invites')?.value
      let mockInvites = mockInvitesVal ? JSON.parse(mockInvitesVal) : []

      const targetInvite = mockInvites.find((i: any) => i.id === inviteId)
      if (targetInvite) {
        targetInvite.status = decision
        cookieStore.set('mock_invites', JSON.stringify(mockInvites), { path: '/', maxAge: 60 * 60 * 24 * 30 })

        if (decision === 'accepted') {
          // Add driver to mock team members
          const mockTeamsVal = cookieStore.get('mock_teams')?.value
          let mockTeams = mockTeamsVal ? JSON.parse(mockTeamsVal) : []
          const team = mockTeams.find((t: any) => t.id === targetInvite.team_id || t.id === targetInvite.teamId)
          if (team) {
            if (!Array.isArray(team.members)) team.members = []
            if (!team.members.some((m: any) => m.userId === session.userId)) {
              team.members.push({
                userId: session.userId,
                role: 'driver',
                displayName: session.steamDisplayName,
              })
              cookieStore.set('mock_teams', JSON.stringify(mockTeams), { path: '/', maxAge: 60 * 60 * 24 * 30 })
            }
          }
        }
        handled = true
      }

      // Handle mock market invites
      const mockMarketInvitesVal = cookieStore.get('mock_market_invites')?.value
      let mockMarketInvites = mockMarketInvitesVal ? JSON.parse(mockMarketInvitesVal) : []
      const targetMarketInvite = mockMarketInvites.find((i: any) => i.id === inviteId)
      if (targetMarketInvite) {
        targetMarketInvite.status = decision
        cookieStore.set('mock_market_invites', JSON.stringify(mockMarketInvites), { path: '/', maxAge: 60 * 60 * 24 * 30 })

        if (decision === 'accepted') {
          const mockTeamsVal = cookieStore.get('mock_teams')?.value
          let mockTeams = mockTeamsVal ? JSON.parse(mockTeamsVal) : []
          const team = mockTeams.find((t: any) => t.id === targetMarketInvite.teamId)
          if (team) {
            if (!Array.isArray(team.members)) team.members = []
            if (!team.members.some((m: any) => m.userId === session.userId)) {
              team.members.push({
                userId: session.userId,
                role: 'driver',
                displayName: session.steamDisplayName,
              })
              cookieStore.set('mock_teams', JSON.stringify(mockTeams), { path: '/', maxAge: 60 * 60 * 24 * 30 })
            }
          }
        }
        handled = true
      }
    } catch (e) {
      console.error('Failed to update mock team invite:', e)
    }
  }

  invalidateCache(['teams_dashboard', 'platform_leagues'])
  revalidatePath('/perfil')
  revalidatePath('/equipos')
  revalidatePath('/market')
  redirect(`/perfil?invite=${decision}`)
}

export async function updateProfile(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const preferredCategories = formData.getAll('preferredCategories').map((value) => String(value).trim().toUpperCase())

  const payload = {
    display_name: String(formData.get('displayName') || '').trim() || session.steamDisplayName,
    country_code: String(formData.get('countryCode') || 'ES').trim().toUpperCase(),
    bio: String(formData.get('bio') || ''),
    main_sim: String(formData.get('mainSim') || 'ac'),
    preferred_categories: preferredCategories,
    avatar_url: session.avatarUrl || null,
  }

  const db = getFirestoreDb()
  if (hasFirebase && db) {
    try {
      await db.collection('profiles').doc(session.userId).set({
        user_id: session.userId,
        ...payload,
      }, { merge: true })
    } catch (error) {
      console.error('Failed to update profile in Firestore:', error)
    }
  } else {
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const profileData = {
        ...payload,
        user_id: session.userId,
        avatar_url: session.avatarUrl || null,
        onboarded: true,
      }
      const cookieOptions = {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      }
      cookieStore.set(`mock_profile_${session.userId}`, JSON.stringify(profileData), cookieOptions)
      cookieStore.set('mock_profile', JSON.stringify(profileData), cookieOptions)
    } catch (e) {
      console.error('Failed to set mock_profile cookie:', e)
    }
  }

  revalidatePath('/perfil')
  revalidatePath('/perfil/editar')
  redirect('/perfil')
}

