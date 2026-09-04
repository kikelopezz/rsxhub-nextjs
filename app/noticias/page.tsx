import Image from 'next/image'
import { Newspaper } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getLocale } from '@/lib/i18n/get-locale'
import { getNewsPosts } from '@/lib/news-data'

export default async function NoticiasPage() {
  const dict = getDictionary(await getLocale())
  const t = dict.news
  const posts = await getNewsPosts()

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="mb-8">
        <h1 className="font-display-league flex items-center gap-3 text-3xl uppercase text-white md:text-4xl">
          <Newspaper className="h-7 w-7 text-[#4ea1ff]" />
          {t.title}
        </h1>
        <p className="mt-1 text-xs text-slate-500">{t.subtitle}</p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-slate-500">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <article
              key={post.id}
              id={post.id}
              className="scroll-mt-28 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] transition-colors hover:border-[#4ea1ff]/40"
            >
              <div className="relative aspect-[21/9] w-full overflow-hidden bg-gradient-to-br from-[#14203a] to-[#0a0a0c]">
                {post.imageUrl ? (
                  <Image src={post.imageUrl} alt={post.title} fill sizes="900px" className="object-cover" />
                ) : (
                  <span className="pointer-events-none absolute -right-3 -top-10 select-none font-display-league text-[160px] leading-none text-white/[0.06]">
                    {post.title.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] from-15% via-[#0a0a0c]/40 via-50% to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="font-mono-data text-[11px] uppercase tracking-widest text-slate-300">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </p>
                  <h2 className="font-display-league text-3xl uppercase leading-[0.95] text-white [text-shadow:0_2px_10px_rgba(0,0,0,.5)]">{post.title}</h2>
                </div>
              </div>
              <div className="p-6">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{post.body}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
