export const dynamic = 'force-dynamic'

import { getLeagues, getLeagueEvents, getAllRegisteredDrivers } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { getLatestNewsPosts } from '@/lib/news-data'
import { HeroSection } from '@/components/hero-section'
import { HomeNewsSection } from '@/components/home-news-section'
import type { Metadata } from 'next'

// El título y la descripción vienen del layout raíz (title.default); aquí solo se fija la URL canónica de la portada.
export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function HomePage() {
  // Fetch platform data in parallel (independent reads — no need to wait on each other)
  const [leagues, events, drivers, teamsDashboard, newsPosts] = await Promise.all([
    getLeagues(),
    getLeagueEvents(),
    getAllRegisteredDrivers(),
    getTeamsDashboard(),
    getLatestNewsPosts(3),
  ])

  // Stats calculation
  const driversCount = drivers.length
  const leaguesCount = leagues.length
  const simulatorsCount = 2
  const racesCount = events.length
  const teamsCount = teamsDashboard.teams.length

  return (
    <div className="text-white">
      <HeroSection
        driversCount={driversCount}
        leaguesCount={leaguesCount}
        simulatorsCount={simulatorsCount}
        racesCount={racesCount}
        teamsCount={teamsCount}
      />
      <HomeNewsSection posts={newsPosts} />
    </div>
  )
}
