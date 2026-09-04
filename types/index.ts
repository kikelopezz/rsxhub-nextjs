export type Simulator = 'ac' | 'lmu'
export type LeagueStatus = 'open' | 'ongoing' | 'finished' | 'draft'
export type LeagueFormat = 'sprint' | 'endurance' | 'gt3' | 'prototype' | 'formula' | 'multiclass'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'waitlist'
export type LeagueRegistrationMode = 'individual' | 'team'
export type PlatformRole = 'super_admin' | 'platform_admin' | 'steward' | 'user'
export type LeagueRole = 'league_owner' | 'league_admin' | 'steward' | 'team_manager' | 'driver'
export type TeamRole = 'owner' | 'manager' | 'driver'
export type TeamInviteStatus = 'pending' | 'accepted' | 'rejected'

export interface Circuit {
  id: string
  name: string
  slug: string
  imageUrl: string
  isSystem: boolean
}

export interface LeagueCar {
  id: string
  leagueId: string
  label: string
  model: string
  sortOrder: number
  isActive: boolean
}

export interface LeagueEvent {
  id: string
  leagueId: string
  circuitId?: string | null
  title: string
  circuitName: string
  circuitImageUrl?: string | null
  serverLink?: string | null
  hasQualy?: boolean
  qualyStartsAt?: string | null
  qualyEndsAt?: string | null
  startsAt: string
  endsAt: string
  status: 'scheduled' | 'completed' | 'cancelled'
  eventType?: 'race' | 'qualifying' | 'time_attack'
  countryCode?: string | null
  color?: string | null
  qualyCompleted?: boolean
  completedAt?: string | null
  maxDrivers?: number | null
  classLimits?: Record<string, number> | null
}

export interface League {
  id: string
  title: string
  slug: string
  shortDescription: string
  fullDescription: string
  simulator: Simulator
  format: LeagueFormat
  classTags?: string[]
  status: LeagueStatus
  bannerUrl: string
  logoUrl?: string | null
  startsAt: string
  endsAt: string
  featured: boolean
  registrationOpen?: boolean
  registrationMode?: LeagueRegistrationMode
  accentColor?: string | null
  slogan?: string | null
  discordUrl?: string | null
  youtubeUrl?: string | null
  rulebookUrl?: string | null
  classLimits?: Record<string, number> | null
}

export interface Profile {
  id: string
  displayName: string
  countryCode: string
  bio: string
  mainSim: Simulator
  racingNumber?: number | null
  avatarUrl?: string | null
  steamId?: string
  steamDisplayName?: string
}

export interface SessionUser {
  userId: string
  steamId: string
  steamDisplayName: string
  avatarUrl?: string
}

export interface LeagueRegistration {
  id: string
  leagueId: string
  userId: string
  teamId?: string | null
  displayName: string
  steamId: string
  classTag?: string | null
  assignedNumber?: number | null
  createdAt: string
  status: RegistrationStatus
}

export interface LeagueResult {
  id: string
  leagueId: string
  eventId: string
  userId: string
  position: number
  points?: number | null
  createdAt: string
}

export interface LeagueMember {
  id: string
  leagueId: string
  userId: string
  role: LeagueRole
  createdAt: string
  steamId?: string
  steamDisplayName?: string
  displayName?: string
}

export interface Team {
  id: string
  leagueId: string | null
  name: string
  description?: string | null
  classTags?: string[]
  primaryColor?: string | null
  secondaryColor?: string | null
  logoUrl?: string | null
  bannerUrl?: string | null
  carSkinUrls?: string[]
  skinAssignments?: Array<{
    leagueSlug: string
    skinUrl: string
    carNumber?: number | null
    featured?: boolean
  }>
  ownerUserId?: string | null
  maxSlots?: number | null
  createdAt: string
  status?: 'pending' | 'approved' | 'rejected'
  accentColor?: string | null
  slogan?: string | null
  discordUrl?: string | null
  youtubeUrl?: string | null
  instagramUrl?: string | null
  twitterUrl?: string | null
  twitchUrl?: string | null
  tiktokUrl?: string | null
  cars?: Array<{
    id: string
    category: 'GT3' | 'LMP2' | 'HYPERCAR'
    dorsal: string
    skinUrl: string
    driverUserIds: string[]
    leagueId?: string | null
  }>
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  roleTags: string[]
  createdAt: string
  steamId?: string
  steamDisplayName?: string
  displayName?: string
  avatarUrl?: string | null
}

export interface TeamInvite {
  id: string
  teamId: string
  invitedByUserId: string
  invitedUserId?: string | null
  invitedSteamId: string
  message?: string | null
  status: TeamInviteStatus
  createdAt: string
}
