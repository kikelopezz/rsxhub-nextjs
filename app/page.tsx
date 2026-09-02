export const dynamic = 'force-dynamic'

import { getLeagues, getLeagueEvents, getAllRegisteredDrivers } from '@/lib/platform-data'
import { getTeamsDashboard } from '@/lib/team-data'
import { HeroSection } from '@/components/hero-section'

export default async function HomePage() {
  // Fetch platform data in parallel (independent reads — no need to wait on each other)
  const [leagues, events, drivers, teamsDashboard] = await Promise.all([
    getLeagues(),
    getLeagueEvents(),
    getAllRegisteredDrivers(),
    getTeamsDashboard(),
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
    </div>
  )
}
