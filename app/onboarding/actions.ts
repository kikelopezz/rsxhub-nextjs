'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function saveOnboarding(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const displayName = String(formData.get('displayName') || '').trim() || session.steamDisplayName
  const countryCode = String(formData.get('countryCode') || 'ES').trim().toUpperCase()
  const mainSim = String(formData.get('mainSim') || 'ac') as any
  const preferredCategories = formData.getAll('preferredCategories').map((v) => String(v).trim().toUpperCase())

  try {
    await db.profile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        displayName,
        countryCode,
        mainSim,
        preferredCategories,
        avatarUrl: session.avatarUrl || null,
        onboarded: true,
      },
      update: {
        displayName,
        countryCode,
        mainSim,
        preferredCategories,
        avatarUrl: session.avatarUrl || null,
        onboarded: true,
      },
    })
  } catch (err) {
    console.error('Failed to save profile during onboarding:', err)
  }

  revalidatePath('/perfil')
  revalidatePath('/')
  redirect('/perfil?onboarding=completed')
}
