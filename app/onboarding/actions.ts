'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getFirestoreDb, hasFirebase } from '@/lib/firebase'

export async function saveOnboarding(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const displayName = String(formData.get('displayName') || '').trim() || session.steamDisplayName
  const countryCode = String(formData.get('countryCode') || 'ES').trim().toUpperCase()
  const mainSim = String(formData.get('mainSim') || 'ac')
  const preferredCategories = formData.getAll('preferredCategories').map((v) => String(v).trim().toUpperCase())

  const payload = {
    display_name: displayName,
    country_code: countryCode,
    main_sim: mainSim,
    preferred_categories: preferredCategories,
    avatar_url: session.avatarUrl || null,
    onboarded: true,
  }

  const db = getFirestoreDb()
  if (hasFirebase && db) {
    try {
      await db.collection('profiles').doc(session.userId).set({
        user_id: session.userId,
        ...payload,
        updated_at: new Date(),
      }, { merge: true })
    } catch (err) {
      console.error('Failed to save profile during onboarding:', err)
    }
  } else {
    // In session-only/mock mode, save to cookie
    try {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const profileData = {
        ...payload,
        user_id: session.userId,
        bio: '',
      }
      const cookieOptions = {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      }
      cookieStore.set(`mock_profile_${session.userId}`, JSON.stringify(profileData), cookieOptions)
      cookieStore.set('mock_profile', JSON.stringify(profileData), cookieOptions)
    } catch (e) {
      console.error('Failed to save onboarding in cookie:', e)
    }
  }

  revalidatePath('/perfil')
  revalidatePath('/')
  redirect('/perfil?onboarding=completed')
}
