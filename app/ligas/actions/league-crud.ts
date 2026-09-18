'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, getAdminAccessContext, getLeagueRole, canManageLeague } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'

export async function createLeagueAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin) throw new Error('Forbidden')

  const title = String(formData.get('title') || '').trim()
  const simulator = String(formData.get('simulator') || 'ac').trim()
  const format = String(formData.get('format') || 'sprint').trim()
  const classTagsRaw = String(formData.get('classTags') || 'GT3').trim()
  const startsAt = String(formData.get('startsAt') || '').trim()
  const endsAt = String(formData.get('endsAt') || '').trim()
  const registrationOpen = formData.has('registrationOpen') ? formData.get('registrationOpen') === 'true' : true
  const bannerUrl = String(formData.get('bannerUrl') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim()
  const accentColor = String(formData.get('accentColor') || '').trim()
  const slogan = String(formData.get('slogan') || '').trim()
  const discordUrl = String(formData.get('discordUrl') || '').trim()
  const youtubeUrl = String(formData.get('youtubeUrl') || '').trim()
  const rulebookUrl = String(formData.get('rulebookUrl') || '').trim()
  const driveUrl = String(formData.get('driveUrl') || '').trim()

  if (!title || !startsAt || !endsAt) {
    throw new Error('Title, Start Date, and End Date are required.')
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

  await db.league.create({
    data: {
      title,
      slug,
      simulator: simulator as any,
      format: format as any,
      classTags: classTagsRaw.split(',').map((tag) => tag.trim().toUpperCase()).filter(Boolean),
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      status: registrationOpen ? 'open' : 'draft',
      bannerUrl: bannerUrl || null,
      logoUrl: logoUrl || null,
      accentColor: accentColor || null,
      slogan: slogan || null,
      discordUrl: discordUrl || null,
      youtubeUrl: youtubeUrl || null,
      rulebookUrl: rulebookUrl || null,
      driveUrl: driveUrl || null,
      isFeatured: false,
      registrationMode: 'individual',
    },
  })

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/ligas')
  revalidatePath('/admin')
}

export async function updateLeagueDetailsAction(formData: FormData) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const leagueId = String(formData.get('leagueId') || '').trim()
  if (!leagueId) {
    throw new Error('League ID is required.')
  }

  const access = await getAdminAccessContext(session.userId)
  const isPlatformAdmin = access.canAccessPlatformAdmin

  const leagueRole = await getLeagueRole(leagueId, session.userId)
  const isLeagueManager = canManageLeague(leagueRole)

  if (!isPlatformAdmin && !isLeagueManager) {
    throw new Error('Forbidden: Only platform admins or league managers can customize league settings.')
  }

  const title = String(formData.get('title') || '').trim()
  const slug = String(formData.get('slug') || '').trim()
  const simulator = String(formData.get('simulator') || 'ac').trim()
  const format = String(formData.get('format') || 'sprint').trim()
  const status = String(formData.get('status') || 'open').trim()
  const registrationMode = String(formData.get('registrationMode') || 'team').trim()
  const classTagsRaw = String(formData.get('classTags') || '').trim()
  const startsAt = String(formData.get('startsAt') || '').trim()
  const endsAt = String(formData.get('endsAt') || '').trim()
  const bannerUrl = String(formData.get('bannerUrl') || '').trim()
  const logoUrl = String(formData.get('logoUrl') || '').trim()
  const accentColor = String(formData.get('accentColor') || '').trim()
  const slogan = String(formData.get('slogan') || '').trim()
  const discordUrl = String(formData.get('discordUrl') || '').trim()
  const youtubeUrl = String(formData.get('youtubeUrl') || '').trim()
  const rulebookUrl = String(formData.get('rulebookUrl') || '').trim()
  const driveUrl = String(formData.get('driveUrl') || '').trim()

  if (!leagueId || !startsAt || !endsAt) {
    throw new Error('League ID, Start Date, and End Date are required.')
  }

  const classTags = classTagsRaw
    ? classTagsRaw.split(',').map((tag) => tag.trim().toUpperCase()).filter(Boolean)
    : undefined

  await db.league.update({
    where: { id: leagueId },
    data: {
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      bannerUrl: bannerUrl || null,
      logoUrl: logoUrl || null,
      accentColor: accentColor || null,
      slogan: slogan || null,
      discordUrl: discordUrl || null,
      youtubeUrl: youtubeUrl || null,
      rulebookUrl: rulebookUrl || null,
      driveUrl: driveUrl || null,
      ...(title && { title }),
      ...(slug && { slug }),
      ...(simulator && { simulator: simulator as any }),
      ...(format && { format: format as any }),
      ...(status && { status: status as any }),
      ...(registrationMode && { registrationMode: registrationMode as any }),
      ...(classTags && { classTags }),
    },
  })

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/ligas')
  revalidatePath('/admin')
  if (slug) {
    revalidatePath(`/ligas/${slug}`)
  }
}

export async function deleteLeagueAction(leagueId: string, slug?: string) {
  const session = await getCurrentUser()
  if (!session) throw new Error('Unauthorized')

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessPlatformAdmin) throw new Error('Forbidden')

  // Every child table has ON DELETE CASCADE back to leagues, so a single
  // delete removes members, events, registrations, results, cars, etc.
  await db.league.delete({ where: { id: leagueId } })

  invalidateCache(['platform_leagues', 'leagues', 'teams_dashboard'])
  revalidatePath('/ligas')
  revalidatePath('/admin')
  if (slug) {
    revalidatePath(`/ligas/${slug}`)
    redirect('/ligas')
  }
}
