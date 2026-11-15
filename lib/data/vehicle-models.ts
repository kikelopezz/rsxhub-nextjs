import { cache } from 'react'
import { db } from '@/lib/db'
import type { VehicleModelOption } from '@/components/team-cars-editor/types'

// Modelos añadidos por un admin desde /admin, además de la lista fija en vehicle-selector-modal.tsx.
// Prefijados "custom_" para no chocar con los ids de la lista por defecto.
export const getCustomVehicleModels = cache(async (): Promise<VehicleModelOption[]> => {
  try {
    const rows = await db.customVehicleModel.findMany({ orderBy: { createdAt: 'asc' } })
    return rows.map((r) => ({
      id: `custom_${r.id}`,
      name: r.name,
      acFolder: r.acFolder,
      category: r.category.toUpperCase() as VehicleModelOption['category'],
      manufacturer: r.manufacturer || undefined,
      imageUrl: r.imageUrl || undefined,
    }))
  } catch (error) {
    console.error('Failed to get custom vehicle models:', error)
    return []
  }
})
