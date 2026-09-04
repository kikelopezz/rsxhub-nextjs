import Image from 'next/image'
import Link from 'next/link'
import { Newspaper } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getLocale } from '@/lib/i18n/get-locale'
import type { NewsPostDTO } from '@/lib/news-data'

export async function HomeNewsSection({ posts }: { posts: NewsPostDTO[] }) {
  if (posts.length === 0) return null

  const dict = getDictionary(await getLocale())
  const t = dict.news

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <h2 className="font-display-league flex items-center gap-2.5 text-3xl uppercase text-white">
          <Newspaper className="h-6 w-6 text-[#4ea1ff]" />
          {t.homeTitle}
        </h2>
        <Link href="/noticias" className="text-xs font-bold uppercase tracking-wider text-[#4ea1ff] hover:text-white transition-colors">
          {t.homeViewAll}
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/noticias#${post.id}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] transition-colors hover:border-[#4ea1ff]/50"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#14203a] to-[#0a0a0c]">
              {post.imageUrl ? (
                <Image
                  src={post.imageUrl}
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="pointer-events-none absolute -right-2 -top-8 select-none font-display-league text-[110px] leading-none text-white/[0.07]">
                  {post.title.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] from-15% via-[#0a0a0c]/30 via-55% to-transparent" />
              <p className="absolute left-3 top-3 font-mono-data text-[10px] uppercase tracking-widest text-slate-300">
                {new Date(post.publishedAt).toLocaleDateString()}
              </p>
              <h3 className="absolute inset-x-3 bottom-3 line-clamp-2 font-display-league text-xl leading-[0.95] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.5)]">
                {post.title}
              </h3>
            </div>
            <div className="p-4">
              <p className="line-clamp-2 text-xs text-slate-400">{post.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
