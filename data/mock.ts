import type { League, LeagueEvent, LeagueRegistration, Profile } from '@/types'

export const leagues: League[] = [
  {
    id: '1',
    title: 'Endurance Real Championship Next Gen',
    slug: 'erc-next-gen',
    shortDescription: 'Official Endurance Real Championship Next Gen League.',
    fullDescription:
      'Official Endurance Real Championship Next Gen League in Assetto Corsa featuring multi-class endurance races.',
    simulator: 'ac',
    format: 'endurance',
    classTags: ['GT3', 'HYPERCAR'],
    status: 'open',
    bannerUrl: '',
    startsAt: '2026-04-05T18:00:00.000Z',
    endsAt: '2026-06-28T18:00:00.000Z',
    featured: true,
    registrationOpen: true,
  },
  {
    id: '2',
    title: 'ERC Next Gen',
    slug: 'erc-next-gen',
    shortDescription: 'Official ERC Next Gen League.',
    fullDescription:
      'Official ERC Next Gen League in Assetto Corsa featuring intense sprint races for upcoming drivers.',
    simulator: 'ac',
    format: 'sprint',
    classTags: ['GT3'],
    status: 'ongoing',
    bannerUrl: '',
    startsAt: '2026-03-18T19:30:00.000Z',
    endsAt: '2026-05-20T19:30:00.000Z',
    featured: true,
    registrationOpen: true,
  }
]

export const leagueEvents: LeagueEvent[] = [
  {
    id: 'e1',
    leagueId: '1',
    title: '6 Hours of Monza',
    circuitName: 'Monza',
    startsAt: '2026-04-05T18:00:00.000Z',
    endsAt: '2026-04-05T21:00:00.000Z',
    status: 'scheduled',
    eventType: 'race',
  },
  {
    id: 'e2',
    leagueId: '1',
    title: 'Hotlap Time Attack',
    circuitName: 'Spa-Francorchamps',
    startsAt: '2026-04-19T18:00:00.000Z',
    endsAt: '2026-04-19T21:00:00.000Z',
    status: 'scheduled',
    eventType: 'time_attack',
  },
  {
    id: 'e3',
    leagueId: '2',
    title: '6 Hours of Fuji',
    circuitName: 'Fuji Speedway',
    startsAt: '2026-05-10T19:30:00.000Z',
    endsAt: '2026-05-10T22:30:00.000Z',
    status: 'scheduled',
    eventType: 'race',
  },
  {
    id: 'e4',
    leagueId: '2',
    title: 'Time Attack Challenge',
    circuitName: 'Imola',
    startsAt: '2026-05-24T19:30:00.000Z',
    endsAt: '2026-05-24T20:30:00.000Z',
    status: 'scheduled',
    eventType: 'time_attack',
  }
]

export const mockRegistrations: LeagueRegistration[] = []

export const mockProfile: Profile = {
  id: 'p1',
  displayName: 'Pol Cuerva',
  countryCode: 'ES',
  bio: 'Piloto y organizador de campeonatos de simracing con foco en experiencia competitiva y branding profesional.',
  mainSim: 'ac',
  racingNumber: 14,
  avatarUrl: null,
  steamId: '76561198000000000',
  steamDisplayName: 'PolSimracing',
}
