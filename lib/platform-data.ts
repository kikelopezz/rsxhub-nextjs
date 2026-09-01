/**
 * lib/platform-data.ts — Barrel re-export
 *
 * This file maintains backwards compatibility. All existing imports like:
 *   import { getLeagues } from '@/lib/platform-data'
 * continue to work without any changes across the codebase.
 *
 * The actual implementations have been split into:
 *   - lib/data/leagues.ts       — getLeagues, getLeagueBySlug, getCircuits
 *   - lib/data/events.ts        — getLeagueEvents, getLeagueCars, getLeagueResults
 *   - lib/data/registrations.ts — getRegistrations, getLeagueMembers, getEventConfirmations,
 *                                 getAllRegisteredDrivers, getTeamPointsOverrides, PlatformDriverUser
 */

export * from './data/leagues'
export * from './data/events'
export * from './data/registrations'
