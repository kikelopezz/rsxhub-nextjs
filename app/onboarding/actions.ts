'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { normalizeConnection, parseConnections } from '@/lib/connections'

export async function saveOnboarding(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const displayName = String(formData.get('displayName') || '').trim() || session.steamDisplayName
  const countryCode = String(formData.get('countryCode') || 'ES').trim().toUpperCase()
  const mainSim = String(formData.get('mainSim') || 'ac') as any
  const preferredCategories = formData.getAll('preferredCategories').map((v) => String(v).trim().toUpperCase())

  // El usuario de Discord es obligatorio para completar el registro — es el canal que usan los
  // organizadores para avisos de carrera, por eso se exige aquí en vez de dejarlo opcional.
  const discordInput = String(formData.get('discord') || '').trim()
  const discord = normalizeConnection('discord', discordInput)
  if (!discord) redirect('/onboarding?error=discord-required')

  try {
    const existing = await db.profile.findUnique({ where: { userId: session.userId }, select: { connections: true } })
    const connections = { ...parseConnections(existing?.connections), discord }

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
        connections,
      },
      update: {
        displayName,
        countryCode,
        mainSim,
        preferredCategories,
        avatarUrl: session.avatarUrl || null,
        onboarded: true,
        connections,
      },
    })
  } catch (err) {
    console.error('Failed to save profile during onboarding:', err)
  }

  revalidatePath('/perfil')
  revalidatePath('/')
  redirect('/perfil?onboarding=completed')
}
