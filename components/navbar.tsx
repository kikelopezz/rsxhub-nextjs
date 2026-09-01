import Link from 'next/link'
import { getAdminAccessContext, getCurrentUser } from '@/lib/auth'

export async function Navbar() {
  const user = await getCurrentUser()
  const access = await getAdminAccessContext(user?.userId)
  const isAdmin = access.canAccessPlatformAdmin

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
        <Link href="/" className="text-lg font-black tracking-wide text-white">
          SIM<span className="text-accent">LEAGUE</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/ligas" className="text-sm text-slate-300 hover:text-white">Ligas</Link>
          <Link href="/calendario" className="text-sm text-slate-300 hover:text-white">Calendario</Link>
          <Link href="/perfil" className="text-sm text-slate-300 hover:text-white">Perfil</Link>
          {user && isAdmin ? <Link href="/admin" className="text-sm text-slate-300 hover:text-white">Admin</Link> : null}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-slate-300 md:inline">{user.steamDisplayName}</span>
              <a href="/api/auth/logout" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:border-accent/40">
                Salir
              </a>
            </>
          ) : (
            <a href="/api/auth/steam" className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Entrar con Steam
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
