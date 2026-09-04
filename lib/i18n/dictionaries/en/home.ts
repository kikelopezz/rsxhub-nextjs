import type es from '../es/home'

const home: typeof es = {
  hero: {
    slides: [
      "Spain's most demanding sim racing platform. Real championships, race control, and professional broadcast.",
      'Championships with active stewards, full regulations, and live broadcasts.',
      'Short sprints, endurance races, and the highest on-track rivalry.',
      'Assetto Corsa and Le Mans Ultimate. Real competition, not arcade.',
      'Join the greatest sim racing experience in Spain and show your pace.',
    ],
    viewLeagues: 'View championships',
    aboutRsx: 'About RSX',
    goToSlide: 'Go to slide',
    stats: {
      drivers: 'Drivers',
      teams: 'Teams',
      leagues: 'Championships',
      simulators: 'Simulators',
      races: 'Races',
    },
  },
  valueProp: {
    titleLine1: 'Real competition,',
    titleLine2: 'not arcade.',
    subtitle: 'Every RSX detail is built to replicate professional motorsport inside the simulator.',
    cards: {
      professionalLeagues: {
        title: 'Professional Championships',
        description: 'Detailed regulations, active stewards, and official standings in every championship.',
      },
      liveBroadcast: {
        title: 'Live Broadcast',
        description: 'Live broadcast of every race with commentators, graphics, and multicam production.',
      },
      teamsAndDrivers: {
        title: 'Teams & Drivers',
        description: 'Team, transfers, and contracts system inspired by real motorsport.',
      },
      raceControl: {
        title: 'Race Control',
        description: 'Steward panel with incident management, penalties, and live notices.',
      },
    },
  },
  activeLeagues: {
    title: 'Active championships',
    viewAll: 'View all →',
    empty: 'No active championships available. Check back soon!',
  },
  cta: {
    titleLine1: 'JOIN',
    titleLine2: 'REAL SIM EXPERIENCE',
    subtitle: 'Create your profile, join a team, and start racing. No pay-to-win, no shortcuts.',
    signInSteam: 'Sign in with Steam',
    viewLeagues: 'View championships',
  },
}

export default home
