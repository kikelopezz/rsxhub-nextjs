// ─── Local types used only inside the team profile page ───────────────────────

export type TeamStats = {
  leagues: number
  activeLeagues: number
  approvedEntries: number
  pendingEntries: number
  upcomingEvents: number
  wins: number
  podiums: number
  racesRun: number
  dnf: number
  dsq: number
}

export type TeamPilot = {
  userId: string
  name: string
  role: string
  roleTags: string[]
  avatarUrl: string | null
  steamId?: string
}

// Specialty badges a team member can hold, independent of and in addition to `role`
// (owner/manager/driver, which only gates team-management permissions) — any combination is
// allowed, e.g. a member can be tagged both "engineer" and "HYPERCAR" and "GT3" at once.
export const TEAM_ROLE_TAGS = ['leader', 'team_boss', 'engineer', 'HYPERCAR', 'GT3', 'LMP2'] as const
export type TeamRoleTag = (typeof TEAM_ROLE_TAGS)[number]

export type CategoryStat = {
  classTag: string
  points: number
  carsCount: number
  driversCount: number
}

export type LeagueParticipation = {
  leagueId: string
  title: string
  bannerUrl: string | null
  status: string
  simulator: string
  teamDriversInLeague: number
  approvedEntries: number
  pendingEntries: number
  nextEventAt: string | null
  categories?: CategoryStat[]
}

export type RecentResult = {
  id: string
  leagueTitle: string
  eventTitle: string
  position: number
  points: number | null
  at: string
}

export type PendingApplication = {
  id: string
  userId: string
  userName: string
  userAvatar: string | null
  contactInfo: string
  message?: string
  createdAt: string
}

// ─── Helper functions ─────────────────────────────────────────────────────────

import type { Dictionary } from '@/lib/i18n/dictionaries/es'
import type { StatusMessage } from '@/components/status-banner'

export function profileStatusMessage(
  params: {
    updated?: string
    invite?: string
    memberRemoved?: string
    roleUpdated?: string
    error?: string
  },
  m: Dictionary['equipos']['profileMessages']
): StatusMessage {
  if (params.updated === '1') return { kind: 'ok', text: m.teamUpdated }
  if (params.invite === '1') return { kind: 'ok', text: m.inviteSent }
  if (params.memberRemoved === '1') return { kind: 'ok', text: m.driverRemoved }
  if (params.roleUpdated === '1') return { kind: 'ok', text: m.roleUpdated }
  if (params.error === 'already-member') return { kind: 'warn', text: m.alreadyMember }
  if (params.error === 'owner-protected') return { kind: 'warn', text: m.ownerProtected }
  if (params.error === 'invalid-role') return { kind: 'warn', text: m.invalidRole }
  if (params.error === 'dorsal-duplicate') return { kind: 'error', text: m.dorsalDuplicate }
  if (params.error === 'max-cars-per-category') return { kind: 'error', text: m.maxCarsPerCategory }
  if (params.error) return { kind: 'error', text: m.actionFailed }
  return null
}

export function hexToRgba(hexColor: string | null | undefined, alpha: number) {
  const value = String(hexColor || '')
    .replace('#', '')
    .trim()
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return `rgba(18,116,222,${alpha})`
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
