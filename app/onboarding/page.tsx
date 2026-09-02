import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import OnboardingForm from './onboarding-form'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export default async function OnboardingPage() {
  const dict = getDictionary(await getLocale())
  const session = await getCurrentUser()

  if (!session) {
    redirect('/perfil')
  }

  // Load current values if they exist, or default to Steam values
  let defaultData = {
    displayName: session.steamDisplayName || '',
    avatarUrl: session.avatarUrl || null,
    countryCode: 'ES',
    mainSim: 'ac' as 'ac' | 'lmu',
    preferredCategories: [] as string[],
  }

  try {
    const profile = await db.profile.findUnique({ where: { userId: session.userId } })
    if (profile) {
      defaultData = {
        displayName: profile.displayName || session.steamDisplayName || '',
        avatarUrl: profile.avatarUrl || session.avatarUrl || null,
        countryCode: profile.countryCode || 'ES',
        mainSim: profile.mainSim,
        preferredCategories: profile.preferredCategories || [],
      }
    }
  } catch (err) {
    console.error('Failed to load onboarding default data:', err)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-2xl bg-gradient-to-b from-[#111622] to-[#0a0d14] border border-white/10 p-6 md:p-8 relative shadow-2xl">
        {/* Futuristic accent header lines */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#1274de] to-transparent" />
        
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-[#1274de] font-bold">{dict.onboarding.page.welcome}</p>
          <h1 className="mt-2 text-3xl font-extrabold text-white tracking-tight uppercase">{dict.onboarding.page.title}</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            {dict.onboarding.page.subtitle}
          </p>
        </div>

        <OnboardingForm defaultData={defaultData} userId={session.userId} />
      </div>
    </div>
  )
}
