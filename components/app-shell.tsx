import { getAdminAccessContext, getCurrentUser } from '@/lib/auth'
import { TopNav } from '@/components/top-nav'
import { Footer } from '@/components/footer'
import { db } from '@/lib/db'

import { TopLoadingBar } from '@/components/top-loading-bar'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const access = await getAdminAccessContext(user?.userId)

  let displayName = user?.steamDisplayName
  let avatarUrl = user?.avatarUrl

  if (user) {
    try {
      const profile = await db.profile.findUnique({ where: { userId: user.userId } })
      if (profile) {
        displayName = profile.displayName || displayName
        avatarUrl = profile.avatarUrl || avatarUrl
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-shell flex flex-col">
      <TopLoadingBar />
      <div className="flex flex-1 flex-col">
        <header className="bg-transparent fixed inset-x-0 top-0 z-40 h-[76px] flex items-center animate-header-in">
          <div className="w-full px-6 md:px-12">
            <TopNav
              signedIn={Boolean(user)}
              showAdmin={access.canAccessPlatformAdmin}
              displayName={displayName}
              avatarUrl={avatarUrl}
            />
          </div>
        </header>

        <main className="w-full flex-1 px-10 pt-[92px] pb-16 md:px-20 md:pt-[100px] md:pb-24">{children}</main>
      </div>

      <Footer />
    </div>
  )
}
