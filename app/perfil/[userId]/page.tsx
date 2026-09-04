export const dynamic = 'force-dynamic'

import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Lock, Flag } from 'lucide-react'
import { getCurrentUser, getAdminAccessContext } from '@/lib/auth'
import { db } from '@/lib/db'
import { getCountryFlagUrl, getCountryName } from '@/lib/countries'
import { ClassBadge } from '@/components/class-badge'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

function hexToRgba(hexColor: string | null | undefined, alpha: number) {
  const value = String(hexColor || '').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return `rgba(18,116,222,${alpha})`
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default async function PublicProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const session = await getCurrentUser()
  const isOwnProfile = session?.userId === userId

  const dict = getDictionary(await getLocale())
  const t = dict.perfil.content

  const [profile, steamAccount] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.steamAccount.findUnique({ where: { userId } }),
  ])

  if (!profile) notFound()

  if (!profile.isPublic && !isOwnProfile) {
    const access = session ? await getAdminAccessContext(session.userId) : null
    if (!access?.canAccessPlatformAdmin) {
      return (
        <div className="mx-auto max-w-md space-y-3 rounded-lg border border-shell-line bg-black/30 p-8 text-center text-white">
          <Lock className="mx-auto h-8 w-8 text-slate-500" />
          <h1 className="text-lg font-bold">{t.privateProfileTitle}</h1>
          <p className="text-sm text-slate-400">{t.privateProfileBody}</p>
        </div>
      )
    }
  }

  const displayName = profile.displayName || steamAccount?.steamDisplayName || 'Piloto'
  const avatarUrl = profile.avatarUrl || steamAccount?.steamAvatarUrl || null

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-white">
      <div
        className="relative overflow-hidden rounded-lg border border-shell-line p-5 md:p-6"
        style={{
          backgroundImage: profile.bannerUrl
            ? `linear-gradient(112deg, rgba(6,10,17,0.94) 20%, ${hexToRgba(profile.accentColor, 0.35)} 58%, rgba(6,10,17,0.88) 100%), url(${profile.bannerUrl})`
            : `linear-gradient(135deg, #0d1420, #0a0f18, #070a10)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 flex flex-wrap items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-shell-line bg-slate-800">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={displayName} width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-slate-500">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {getCountryFlagUrl(profile.countryCode) && (
                <span className="relative h-4 w-6 shrink-0 overflow-hidden rounded-sm">
                  <Image src={getCountryFlagUrl(profile.countryCode)!} alt="" fill className="object-cover" />
                </span>
              )}
              <h1 className="truncate text-2xl font-black uppercase italic text-white">{displayName}</h1>
            </div>
            <p className="text-xs text-slate-400">{getCountryName(profile.countryCode)}</p>
          </div>
        </div>
      </div>

      {profile.bio && (
        <div
          className="rounded-lg border-l-2 bg-black/40 p-4 text-sm italic leading-relaxed text-slate-300 whitespace-pre-wrap"
          style={{ borderColor: profile.accentColor || '#1274de' }}
        >
          "{profile.bio}"
        </div>
      )}

      {profile.preferredCategories.length > 0 && (
        <div className="shell-panel space-y-3 rounded-lg p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
            <Flag className="h-4 w-4 text-accent" />
            {dict.onboarding.form.preferredCategories}
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.preferredCategories.map((cat) => (
              <ClassBadge key={cat} classTag={cat} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
