export type CarEntry = {
  id: string
  category: 'GT3' | 'LMP2' | 'HYPERCAR'
  dorsal: string // String representation: '0', '00', '000', '7', '07', '123'
  modelName?: string // Visual car model name (e.g. "Ferrari 296 GT3")
  modelFolder?: string // Assetto Corsa folder name (e.g. "ks_ferrari_296_gt3")
  skinUrl: string
  skinName?: string
  driverUserIds: string[] // All assigned drivers across all leagues
  driverUserIdsByLeague?: Record<string, string[]> // Mapping: leagueId -> driverUserIds[]
  reserveDriverUserIds?: string[] // Reserve driver(s), same shape as driverUserIds but outside the regular slots
  reserveDriverUserIdsByLeague?: Record<string, string[]> // Mapping: leagueId -> reserveDriverUserIds[]
  leagueId?: string | null
}

export type VehicleModelOption = {
  id: string
  name: string // Display name
  acFolder: string // Assetto Corsa folder name
  category: 'GT3' | 'LMP2' | 'HYPERCAR'
  manufacturer?: string
  imageUrl?: string // Real in-sim preview render, pulled from the car's own skin folder
}

export type TeamMemberOption = {
  userId: string
  name: string
  steamId?: string
}

export type TakenDorsal = {
  teamId: string
  teamName: string
  category: string
  dorsal: string
  leagueId?: string | null
}

export type LeagueOption = {
  id: string
  slug: string
  title: string
  classTags: string[]
}

export const MAX_DRIVERS_PER_CAR = 4
export const MAX_RESERVE_DRIVERS_PER_CAR = 4

export function getSkinFileName(url: string, skinName?: string): string {
  if (skinName && skinName.trim()) return skinName.trim()
  if (!url) return 'skin.zip'
  if (url.startsWith('data:')) {
    const match = url.match(/name=([^;]+)/)
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1])
      } catch {
        return match[1]
      }
    }
    return 'skin.zip'
  }
  const cleanName = url.split('/').pop()?.split('?')[0] || 'skin.zip'
  try {
    return decodeURIComponent(cleanName)
  } catch {
    return cleanName
  }
}
