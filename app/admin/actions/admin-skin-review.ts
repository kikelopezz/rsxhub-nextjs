'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { notifySkinReviewed } from '@/lib/notifications-data'
import { guardPlatformAdmin } from './admin-league'

async function reviewCarSkin(reviewId: string, status: 'approved' | 'rejected') {
  const session = await guardPlatformAdmin()
  if (!reviewId) return { success: false, error: 'Missing skin review id.' }

  try {
    const review = await db.carSkinReview.findUnique({ where: { id: reviewId }, include: { team: true } })
    if (!review) return { success: false, error: 'Skin submission not found.' }

    await db.carSkinReview.update({
      where: { id: reviewId },
      data: { status, reviewedBy: session.userId, reviewedAt: new Date() },
    })

    await notifySkinReviewed({
      userId: review.team.ownerUserId,
      teamName: review.team.name,
      category: review.category,
      dorsal: review.dorsal,
      status,
    })

    invalidateCache(['teams_dashboard'])
    revalidatePath('/admin')
    revalidatePath(`/equipos/${review.teamId}`)
    return { success: true }
  } catch (error) {
    console.error(`Failed to ${status === 'approved' ? 'approve' : 'reject'} car skin:`, error)
    return { success: false, error: 'Failed to update the skin submission.' }
  }
}

export async function approveCarSkinAction(formData: FormData) {
  return reviewCarSkin(String(formData.get('reviewId') || ''), 'approved')
}

export async function rejectCarSkinAction(formData: FormData) {
  return reviewCarSkin(String(formData.get('reviewId') || ''), 'rejected')
}
