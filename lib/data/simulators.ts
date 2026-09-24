import { cache } from 'react'
import { db } from '@/lib/db'

export type SimulatorOption = {
  key: string
  name: string
  logoUrl: string | null
}

// Used when the simulators table doesn't exist yet (migration pending) or is empty, so the
// site keeps working with the two original games.
const DEFAULT_SIMULATORS: SimulatorOption[] = [
  { key: 'ac', name: 'Assetto Corsa', logoUrl: '/branding/ACLogo.png' },
  { key: 'lmu', name: 'Le Mans Ultimate', logoUrl: '/branding/LMULogo.png' },
]

export const getSimulators = cache(async (): Promise<SimulatorOption[]> => {
  try {
    const rows = await db.simulatorConfig.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
    if (rows.length === 0) return DEFAULT_SIMULATORS
    return rows.map((r) => ({ key: r.key, name: r.name, logoUrl: r.logoUrl }))
  } catch (error) {
    console.error('Failed to get simulators:', error)
    return DEFAULT_SIMULATORS
  }
})

export function simulatorName(key: string, simulators: SimulatorOption[]) {
  return simulators.find((s) => s.key === key)?.name || key
}

export function simulatorLogo(key: string, simulators: SimulatorOption[]) {
  return simulators.find((s) => s.key === key)?.logoUrl || null
}
