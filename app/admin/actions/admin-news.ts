'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { invalidateCache } from '@/lib/ttl-cache'
import { guardPlatformAdmin } from './admin-league'

export async function createNewsPostAction(formData: FormData) {
  const session = await guardPlatformAdmin()

  const title = String(formData.get('title') || '').trim()
  const excerpt = String(formData.get('excerpt') || '').trim()
  const body = String(formData.get('body') || '').trim()
  const imageUrl = String(formData.get('imageUrl') || '').trim()

  if (!title || !excerpt || !body) {
    return { success: false, error: 'Title, excerpt and body are required.' }
  }

  try {
    await db.newsPost.create({
      data: { title, excerpt, body, imageUrl: imageUrl || null, authorId: session.userId },
    })
    invalidateCache(['news_posts', 'home_news_posts'])
    revalidatePath('/admin')
    revalidatePath('/noticias')
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to create news post:', error)
    return { success: false, error: 'Failed to create the news post.' }
  }
}

export async function updateNewsPostAction(formData: FormData) {
  await guardPlatformAdmin()

  const id = String(formData.get('id') || '').trim()
  const title = String(formData.get('title') || '').trim()
  const excerpt = String(formData.get('excerpt') || '').trim()
  const body = String(formData.get('body') || '').trim()
  const imageUrl = String(formData.get('imageUrl') || '').trim()

  if (!id || !title || !excerpt || !body) {
    return { success: false, error: 'Title, excerpt and body are required.' }
  }

  try {
    await db.newsPost.update({
      where: { id },
      data: { title, excerpt, body, imageUrl: imageUrl || null },
    })
    invalidateCache(['news_posts', 'home_news_posts'])
    revalidatePath('/admin')
    revalidatePath('/noticias')
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to update news post:', error)
    return { success: false, error: 'Failed to update the news post.' }
  }
}

export async function deleteNewsPostAction(formData: FormData) {
  await guardPlatformAdmin()

  const id = String(formData.get('id') || '').trim()
  if (!id) return { success: false, error: 'Missing news post id.' }

  try {
    await db.newsPost.delete({ where: { id } })
    invalidateCache(['news_posts', 'home_news_posts'])
    revalidatePath('/admin')
    revalidatePath('/noticias')
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete news post:', error)
    return { success: false, error: 'Failed to delete the news post.' }
  }
}
