import { getAdminAccessContext, getCurrentUser } from '@/lib/auth'
import { TopNav } from '@/components/top-nav'
import { Footer } from '@/components/footer'
import { db } from '@/lib/db'
import { getUserNotifications } from '@/lib/notifications-data'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  // access, the DB profile lookup, and notifications only depend on `user`, not on each
  // other — run them together instead of one after another. Fetching notifications here
  // (instead of only client-side on mount) means the nav bell doesn't need to make its
  // own network round-trip on every single page load.
  const [access, profile, notifications] = await Promise.all([
    getAdminAccessContext(user?.userId),
    user
      ? db.profile.findUnique({ where: { userId: user.userId } }).catch(() => null)
      : Promise.resolve(null),
    user ? getUserNotifications(user.userId) : Promise.resolve([]),
  ])

  const displayName = profile?.displayName || user?.steamDisplayName
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl

  return (
    <div className="min-h-screen bg-shell flex flex-col">
      {/* Faint fixed logo watermark behind every page — same "ghost" device used for
          team/car initials elsewhere in the redesign, just site-wide and much fainter
          so it never competes with real content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat opacity-[0.04]"
        style={{ backgroundImage: "url('/branding/rsx-logo.png')", backgroundSize: 'min(60vw, 720px) auto' }}
      />
      <div className="relative z-[1] flex flex-1 flex-col">
        <header className="bg-transparent fixed inset-x-0 top-0 z-40 h-[76px] flex items-center animate-header-in">
          <div className="w-full px-6 md:px-12">
            <TopNav
              signedIn={Boolean(user)}
              showAdmin={access.canAccessPlatformAdmin}
              displayName={displayName}
              avatarUrl={avatarUrl}
              notifications={notifications}
            />
          </div>
        </header>

        <main className="w-full flex-1 px-10 pt-[92px] pb-16 md:px-20 md:pt-[100px] md:pb-24">{children}</main>
      </div>

      <Footer />
    </div>
  )
}
