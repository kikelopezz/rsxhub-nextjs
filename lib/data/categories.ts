import { cache } from 'react'
import { db } from '@/lib/db'

export type CarCategoryOption = {
  key: string
  name: string
  active: boolean
  minHours: number
}

// Se usa mientras la tabla no existe todavía (migración pendiente) o está vacía, para que el admin
// de ligas siga ofreciendo las categorías de siempre.
const DEFAULT_CATEGORIES: CarCategoryOption[] = ['GT3', 'HYPERCAR', 'LMP2', 'GTE', 'F1', 'GT4'].map((key) => ({ key, name: key, active: true, minHours: 0 }))

export const getCarCategories = cache(async (): Promise<CarCategoryOption[]> => {
  try {
    const rows = await db.carCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
    if (rows.length === 0) return DEFAULT_CATEGORIES
    return rows.map((r) => ({ key: r.key, name: r.name, active: r.active, minHours: r.minHours }))
  } catch (error) {
    console.error('Failed to get car categories:', error)
    return DEFAULT_CATEGORIES
  }
})

/** Horas mínimas de Assetto Corsa exigidas para una categoría (0 = sin mínimo, o si no está configurada). */
export const getMinHoursForCategory = cache(async (classTag: string): Promise<number> => {
  const categories = await getCarCategories()
  const match = categories.find((c) => c.key.toUpperCase() === classTag.toUpperCase())
  return match?.minHours || 0
})
