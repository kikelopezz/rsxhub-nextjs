export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { getLeagues, getLeagueEvents, getAllRegisteredDrivers, getRegistrations } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { LeagueCard } from '@/components/league-card'
import { SteamLoginButton } from '@/components/steam-login-button'
import { Trophy, Radio, Users, Flag, ArrowRight } from 'lucide-react'
import { HeroSection } from '@/components/hero-section'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export default async function HomePage() {
  const dict = getDictionary(await getLocale())
  // Fetch platform data in parallel (independent reads — no need to wait on each other)
  const [leagues, events, drivers, allRegistrations, teamsDashboard] = await Promise.all([
    getLeagues(),
    getLeagueEvents(),
    getAllRegisteredDrivers(),
    getRegistrations(),
    getTeamsDashboard(),
  ])

  const registeredByLeague: Record<string, number> = {}
  const countedKeysByLeague = new Map<string, Set<string>>()

  for (const registration of allRegistrations) {
    if (registration.status === 'rejected') continue
    const leagueId = registration.leagueId
    if (!countedKeysByLeague.has(leagueId)) {
      countedKeysByLeague.set(leagueId, new Set<string>())
    }
    const countedKeys = countedKeysByLeague.get(leagueId)!
    const key = `${registration.teamId || registration.userId}_${registration.classTag || 'default'}`
    if (!countedKeys.has(key)) {
      countedKeys.add(key)
      registeredByLeague[leagueId] = (registeredByLeague[leagueId] || 0) + 1
    }
  }

  // Stats calculation
  const driversCount = drivers.length
  const leaguesCount = leagues.length
  const simulatorsCount = 2
  const racesCount = events.length
  const teamsCount = teamsDashboard.teams.length

  // Active leagues for preview
  const activeLeagues = leagues.filter((l) => l.status === 'open' || l.status === 'ongoing').slice(0, 3)
  const displayLeagues = activeLeagues.length > 0 ? activeLeagues : leagues.slice(0, 3)

  return (
    <div className="space-y-20 text-white pb-12">
      {/* 1. Hero Banner Carousel & Stats Section */}
      <HeroSection
        driversCount={driversCount}
        leaguesCount={leaguesCount}
        simulatorsCount={simulatorsCount}
        racesCount={racesCount}
        teamsCount={teamsCount}
      />

      {/* 2. "Real competition, not arcade." Value Proposition Section */}
      <section className="space-y-10 max-w-[1400px] mx-auto px-4 md:px-6">
        <div className="space-y-3">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white italic uppercase">
            {dict.home.valueProp.titleLine1} <span className="text-[#1274de]">{dict.home.valueProp.titleLine2}</span>
          </h2>
          <p className="text-sm md:text-base text-slate-400 font-medium max-w-2xl">
            {dict.home.valueProp.subtitle}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Professional Leagues */}
          <div className="glass glass-soft group relative overflow-hidden p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,116,222,0.18)]">
            <div className="glass-sheen opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="glass glass-tint flex h-11 w-11 items-center justify-center rounded-2xl text-[#bcdcff]">
              <Trophy className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              {dict.home.valueProp.cards.professionalLeagues.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              {dict.home.valueProp.cards.professionalLeagues.description}
            </p>
          </div>

          {/* Card 2: Live Broadcast */}
          <div className="glass glass-soft group relative overflow-hidden p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,116,222,0.18)]">
            <div className="glass-sheen opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="glass glass-tint flex h-11 w-11 items-center justify-center rounded-2xl text-[#bcdcff]">
              <Radio className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              {dict.home.valueProp.cards.liveBroadcast.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              {dict.home.valueProp.cards.liveBroadcast.description}
            </p>
          </div>

          {/* Card 3: Teams & Drivers */}
          <div className="glass glass-soft group relative overflow-hidden p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,116,222,0.18)]">
            <div className="glass-sheen opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="glass glass-tint flex h-11 w-11 items-center justify-center rounded-2xl text-[#bcdcff]">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              {dict.home.valueProp.cards.teamsAndDrivers.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              {dict.home.valueProp.cards.teamsAndDrivers.description}
            </p>
          </div>

          {/* Card 4: Race Control */}
          <div className="glass glass-soft group relative overflow-hidden p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,116,222,0.18)]">
            <div className="glass-sheen opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="glass glass-tint flex h-11 w-11 items-center justify-center rounded-2xl text-[#bcdcff]">
              <Flag className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">
              {dict.home.valueProp.cards.raceControl.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              {dict.home.valueProp.cards.raceControl.description}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Active Leagues Section */}
      <section className="space-y-6 max-w-[1400px] mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-white">
            {dict.home.activeLeagues.title}
          </h2>
          <Link
            href="/ligas"
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider"
          >
            {dict.home.activeLeagues.viewAll}
          </Link>
        </div>

        {displayLeagues.length === 0 ? (
          <div className="glass glass-soft p-8 text-center text-slate-400 text-sm">
            {dict.home.activeLeagues.empty}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayLeagues.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                registeredCount={registeredByLeague[league.id] || 0}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. JOIN RSX CTA Section */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-6">
        <div className="glass glass-soft relative overflow-hidden p-10 md:p-16 space-y-6">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(18,116,222,0.55), transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(0,240,255,0.45), transparent 70%)' }}
          />
          <div className="relative space-y-3 max-w-xl">
            <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tight text-white leading-tight">
              {dict.home.cta.titleLine1} <br />
              <span className="text-[#1274de]">{dict.home.cta.titleLine2}</span>
            </h2>
            <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">
              {dict.home.cta.subtitle}
            </p>
          </div>

          <div className="relative flex flex-wrap items-center gap-4 pt-2">
            <SteamLoginButton className="glass glass-pill glass-tint inline-flex text-white px-7 py-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-all hover:brightness-110 cursor-pointer">
              {dict.home.cta.signInSteam}
            </SteamLoginButton>
            <Link
              href="/ligas"
              className="glass glass-pill inline-flex text-white px-7 py-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors hover:bg-white/10"
            >
              {dict.home.cta.viewLeagues}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
