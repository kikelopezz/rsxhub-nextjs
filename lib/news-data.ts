import { db } from '@/lib/db'
import { fetchWithTTLCache } from '@/lib/ttl-cache'

export type NewsPostDTO = {
  id: string
  title: string
  excerpt: string
  body: string
  imageUrl: string | null
  publishedAt: string
}

function toDTO(post: {
  id: string
  title: string
  excerpt: string
  body: string
  imageUrl: string | null
  publishedAt: Date
}): NewsPostDTO {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    imageUrl: post.imageUrl,
    publishedAt: post.publishedAt.toISOString(),
  }
}

export async function getNewsPosts(): Promise<NewsPostDTO[]> {
  return fetchWithTTLCache(
    'news_posts',
    async () => {
      const posts = await db.newsPost.findMany({ orderBy: { publishedAt: 'desc' } })
      return posts.map(toDTO)
    },
    30
  )
}

export async function getLatestNewsPosts(limit: number): Promise<NewsPostDTO[]> {
  return fetchWithTTLCache(
    `home_news_posts_${limit}`,
    async () => {
      const posts = await db.newsPost.findMany({ orderBy: { publishedAt: 'desc' }, take: limit })
      return posts.map(toDTO)
    },
    30
  )
}
