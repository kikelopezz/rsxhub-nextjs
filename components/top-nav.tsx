'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { SteamLoginButton } from './steam-login-button'
import { NotificationsNav } from './notifications-nav'
import { LanguageSwitcher } from './language-switcher'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface TopNavProps {
  signedIn: boolean
  showAdmin: boolean
  displayName?: string
  avatarUrl?: string
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  if (href === '#') return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SteamIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.283 2.69 7.935 6.49 9.35l.937-2.868c-.144-.065-.28-.152-.405-.257-.958-.8-1.572-2.003-1.572-3.348 0-2.457 1.998-4.455 4.455-4.455h.023l2.846 4.19c.774.07 1.492.42 2.015.992l-.001.002c.49.537.785 1.25.785 2.037 0 1.688-1.374 3.063-3.063 3.063-.807 0-1.536-.312-2.079-.82l-2.85 2.85C10.233 21.895 11.096 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm1.905 15.688c0-.992-.808-1.802-1.802-1.802s-1.802.81-1.802 1.802.808 1.802 1.802 1.802 1.802-.81 1.802-1.802z"/>
    </svg>
  )
}

export function TopNav({ signedIn, showAdmin, displayName, avatarUrl }: TopNavProps) {
  const pathname = usePathname()
  const dict = useDictionary()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const baseLinks = [
    { href: '/calendario', label: dict.nav.calendar },
    { href: '/ligas', label: dict.nav.leagues },
    { href: '/equipos', label: dict.nav.teams },
    { href: '/market', label: dict.nav.market },
    { href: '/about', label: dict.nav.about },
  ]
  const links = showAdmin ? [...baseLinks, { href: '/admin', label: dict.nav.admin }] : baseLinks

  // Close the mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <div className="relative">
      {/* Desktop layout (>= md) */}
      <div className="hidden md:grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        {/* Logo */}
        <Link
          href="/"
          className="glass glass-pill inline-flex w-fit items-center gap-2 px-4 py-2 md:justify-self-start"
          aria-label="RSX"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f8dff] shadow-[0_0_8px_rgba(31,141,255,0.9)]" />
          <Image src="/branding/rsx-logo.png" alt="RSX" width={140} height={38} priority className="h-auto w-[100px] md:w-[120px]" />
        </Link>

        {/* Nav links */}
        <nav className="glass glass-pill flex flex-wrap items-center justify-center gap-0.5 p-1 text-[11.5px] font-bold uppercase tracking-wider text-white">
          {links.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 transition-all duration-200 ${
                  active
                    ? 'glass-tint text-white shadow-[0_0_16px_rgba(18,116,222,0.4)]'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side: user widget or sign-in */}
        <div className="flex items-center gap-2 justify-self-center md:justify-self-end">
          {signedIn ? (
            <div className="flex items-center gap-2">
              {/* Notifications Center */}
              <NotificationsNav />

              {/* User Profile Button */}
              <Link
                href="/perfil"
                className="glass glass-pill flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/10 transition-colors"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName ?? 'Avatar'}
                    width={24}
                    height={24}
                    className="rounded-full object-cover ring-1 ring-white/20 flex-shrink-0"
                  />
                ) : (
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-800/40 border border-emerald-500/30 text-[11px] font-bold text-emerald-400">
                    {(displayName?.[0] ?? 'U').toUpperCase()}
                  </span>
                )}
                <span className="text-[12px] font-bold text-slate-200 tracking-wide max-w-[140px] truncate">
                  {displayName ?? dict.nav.driver}
                </span>
              </Link>

              {/* Logout Button */}
              <a
                href="/api/auth/logout"
                title={dict.nav.signOut}
                className="glass glass-pill flex items-center justify-center h-10 w-10 !border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                aria-label={dict.nav.signOut}
              >
                <LogoutIcon />
              </a>
            </div>
          ) : (
            <SteamLoginButton
              className="glass glass-pill glass-tint inline-flex items-center gap-1.5 px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white transition-colors hover:brightness-110 cursor-pointer"
            >
              <SteamIcon />
              {dict.nav.signIn}
            </SteamLoginButton>
          )}
          <LanguageSwitcher />
        </div>
      </div>

      {/* Mobile layout (< md) */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Link href="/" className="inline-flex w-fit items-center" aria-label="RSX">
          <Image src="/branding/rsx-logo.png" alt="RSX" width={140} height={38} priority className="h-auto w-[100px]" />
        </Link>

        <div className="flex items-center gap-2">
          {signedIn && <NotificationsNav />}
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={isMenuOpen}
            className="glass glass-pill flex h-10 w-10 items-center justify-center text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {isMenuOpen && (
        <div className="glass glass-soft md:hidden absolute left-0 right-0 top-full mt-2 p-3 space-y-3 z-50">
          <nav className="flex flex-col gap-1 text-[13px] font-bold uppercase tracking-wider">
            {links.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-2xl px-4 py-2.5 transition-colors ${
                  isActive(pathname, item.href)
                    ? 'glass-tint text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-2">
            {signedIn ? (
              <>
                <Link
                  href="/perfil"
                  className="glass glass-pill flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName ?? 'Avatar'}
                      width={24}
                      height={24}
                      className="rounded-full object-cover ring-1 ring-white/20 flex-shrink-0"
                    />
                  ) : (
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-800/40 border border-emerald-500/30 text-[11px] font-bold text-emerald-400">
                      {(displayName?.[0] ?? 'U').toUpperCase()}
                    </span>
                  )}
                  <span className="text-[12px] font-bold text-slate-200 tracking-wide truncate">
                    {displayName ?? dict.nav.driver}
                  </span>
                </Link>
                <a
                  href="/api/auth/logout"
                  title={dict.nav.signOut}
                  aria-label={dict.nav.signOut}
                  className="glass glass-pill flex h-10 w-10 shrink-0 items-center justify-center !border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <LogoutIcon />
                </a>
              </>
            ) : (
              <SteamLoginButton
                className="glass glass-pill glass-tint inline-flex flex-1 items-center justify-center gap-1.5 px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white transition-colors hover:brightness-110 cursor-pointer"
              >
                <SteamIcon />
                {dict.nav.signIn}
              </SteamLoginButton>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </div>
  )
}
