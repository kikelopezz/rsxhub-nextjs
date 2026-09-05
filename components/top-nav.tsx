'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { SteamLoginButton } from './steam-login-button'
import { NotificationsNav, type NotificationItem } from './notifications-nav'
import { LanguageSwitcher } from './language-switcher'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface TopNavProps {
  signedIn: boolean
  showAdmin: boolean
  displayName?: string
  avatarUrl?: string
  notifications?: NotificationItem[]
  marketBadgeCount?: number
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

export function TopNav({ signedIn, showAdmin, displayName, avatarUrl, notifications, marketBadgeCount = 0 }: TopNavProps) {
  const pathname = usePathname()
  const dict = useDictionary()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showSignInHint, setShowSignInHint] = useState(false)

  useEffect(() => {
    if (signedIn) return
    try {
      if (localStorage.getItem('rsx_signin_hint_dismissed') === '1') return
    } catch {}
    setShowSignInHint(true)
  }, [signedIn])

  const dismissSignInHint = () => {
    setShowSignInHint(false)
    try {
      localStorage.setItem('rsx_signin_hint_dismissed', '1')
    } catch {}
  }

  const baseLinks = [
    { href: '/noticias', label: dict.nav.news },
    { href: '/calendario', label: dict.nav.calendar },
    { href: '/ligas', label: dict.nav.leagues },
    { href: '/equipos', label: dict.nav.teams },
    { href: '/market', label: dict.nav.market },
    { href: '/live-timing', label: dict.nav.liveTiming },
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
          className="inline-flex w-fit items-center md:justify-self-start"
          aria-label="RSX"
        >
          <Image src="/branding/rsx-logo.png" alt="RSX" width={140} height={38} priority className="h-auto w-[110px] md:w-[130px]" />
        </Link>

        {/* Nav links */}
        <nav className="flex flex-wrap items-center justify-center gap-1 p-1.5 text-[12px] font-bold uppercase tracking-wider text-white">
          {links.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`relative rounded-md border px-4 py-2 transition-all duration-200 active:scale-90 ${
                isActive(pathname, item.href)
                  ? 'border-[#4ea1ff] bg-[#1274de] text-white shadow-[0_0_20px_rgba(78,161,255,0.7)]'
                  : 'border-transparent text-slate-300 hover:-translate-y-1 hover:scale-105 hover:border-[#4ea1ff] hover:bg-white/10 hover:text-white hover:shadow-[0_0_18px_rgba(78,161,255,0.65)]'
              }`}
            >
              {item.label}
              {item.href === '/market' && marketBadgeCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1274de] text-[10px] font-black text-white leading-none shadow-[0_0_12px_#00f0ff] ring-2 ring-cyan-400/80 animate-pulse">
                  {marketBadgeCount > 9 ? '9+' : marketBadgeCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Right side: user widget or sign-in */}
        <div className="flex items-center gap-2 justify-self-center md:justify-self-end">
          {signedIn ? (
            <div className="flex items-center gap-2">
              {/* Notifications Center */}
              <NotificationsNav initialNotifications={notifications} />

              {/* User Profile Button */}
              <Link
                href="/perfil"
                className="group flex items-center gap-2.5 border border-white/20 bg-white/5 px-4 py-2.5 rounded-lg hover:bg-white/10 hover:-translate-y-1 hover:scale-105 hover:border-[#4ea1ff] hover:shadow-[0_0_18px_rgba(78,161,255,0.65)] active:scale-95 transition-all duration-200"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName ?? 'Avatar'}
                    width={24}
                    height={24}
                    className="rounded-full object-cover ring-1 ring-white/20 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                  />
                ) : (
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-800/40 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 transition-transform duration-200 group-hover:scale-110">
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
                className="flex items-center justify-center h-10 w-10 border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 hover:-translate-y-1 hover:scale-110 hover:shadow-[0_0_18px_rgba(244,63,94,0.6)] active:scale-90 rounded-lg text-rose-400 hover:text-rose-300 transition-all duration-200"
                aria-label={dict.nav.signOut}
              >
                <LogoutIcon />
              </a>
            </div>
          ) : (
            <div className="relative">
              <SteamLoginButton
                className="group relative inline-flex items-stretch overflow-hidden border border-[#4ea1ff]/50 bg-[#0a0f18] text-white shadow-[0_0_14px_rgba(78,161,255,0.35)] transition-all duration-200 [clip-path:polygon(9px_0,100%_0,100%_calc(100%-9px),calc(100%-9px)_100%,0_100%,0_9px)] hover:border-[#8fc4ff] hover:shadow-[0_0_24px_rgba(78,161,255,0.7)] active:scale-[0.97] cursor-pointer"
              >
                <span className="flex items-center justify-center bg-[#1274de] px-3 transition-colors group-hover:bg-[#1f82ee]">
                  <SteamIcon />
                </span>
                <span className="flex items-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em]">
                  {dict.nav.signIn}
                </span>
              </SteamLoginButton>

              {showSignInHint && (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 animate-dropdown-in rounded-lg border border-[#4ea1ff]/40 bg-[#0a0f18] p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                  <div className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-[#4ea1ff]/40 bg-[#0a0f18]" />
                  <button
                    type="button"
                    onClick={dismissSignInHint}
                    aria-label={dict.nav.dismiss}
                    className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <p className="pr-4 text-[11px] font-semibold normal-case leading-relaxed text-slate-200">
                    {dict.nav.signInHint}
                  </p>
                </div>
              )}
            </div>
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
          {signedIn && <NotificationsNav initialNotifications={notifications} />}
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={isMenuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:scale-110 hover:border-[#4ea1ff] hover:shadow-[0_0_18px_rgba(78,161,255,0.65)] active:scale-90 transition-all duration-200 cursor-pointer"
          >
            <span className={`flex transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {isMenuOpen && (
        <div className="md:hidden fixed left-6 right-6 top-[84px] rounded-lg border border-white/10 bg-[#090d16] shadow-[0_16px_40px_rgba(0,0,0,0.6)] p-3 space-y-3 z-50 origin-top animate-dropdown-in">
          <nav className="flex flex-col gap-1 text-[13px] font-bold uppercase tracking-wider">
            {links.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`relative rounded-md border px-4 py-2.5 transition-all duration-200 active:scale-95 ${
                  isActive(pathname, item.href)
                    ? 'border-[#4ea1ff] bg-[#1274de] text-white shadow-[0_0_16px_rgba(78,161,255,0.6)]'
                    : 'border-transparent text-slate-300 hover:translate-x-1.5 hover:border-[#4ea1ff] hover:bg-white/10 hover:text-white hover:shadow-[0_0_14px_rgba(78,161,255,0.55)]'
                }`}
              >
                {item.label}
                {item.href === '/market' && marketBadgeCount > 0 && (
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1274de] text-[10px] font-black text-white leading-none shadow-[0_0_12px_#00f0ff] ring-2 ring-cyan-400/80">
                    {marketBadgeCount > 9 ? '9+' : marketBadgeCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-2">
            {signedIn ? (
              <>
                <Link
                  href="/perfil"
                  className="flex min-w-0 flex-1 items-center gap-2.5 border border-white/20 bg-white/5 px-3 py-2 rounded-lg hover:bg-white/10 hover:border-[#4ea1ff] hover:shadow-[0_0_16px_rgba(78,161,255,0.6)] active:scale-95 transition-all duration-200"
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 hover:shadow-[0_0_16px_rgba(244,63,94,0.6)] active:scale-90 rounded-lg text-rose-400 hover:text-rose-300 transition-all duration-200"
                >
                  <LogoutIcon />
                </a>
              </>
            ) : (
              <SteamLoginButton
                className="relative flex flex-1 items-stretch overflow-hidden border border-[#4ea1ff]/50 bg-[#0a0f18] text-white shadow-[0_0_14px_rgba(78,161,255,0.35)] transition-all duration-200 [clip-path:polygon(9px_0,100%_0,100%_calc(100%-9px),calc(100%-9px)_100%,0_100%,0_9px)] active:scale-[0.97] cursor-pointer"
              >
                <span className="flex items-center justify-center bg-[#1274de] px-3">
                  <SteamIcon />
                </span>
                <span className="flex flex-1 items-center justify-center px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em]">
                  {dict.nav.signIn}
                </span>
              </SteamLoginButton>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </div>
  )
}
