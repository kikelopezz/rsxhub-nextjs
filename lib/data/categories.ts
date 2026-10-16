import { cache } from 'react'
import { db } from '@/lib/db'

export type CarCategoryOption = {
  key: string
  name: string
  active: boolean
}

// Se usa mientras la tabla no existe todavía (migración pendiente) o está vacía, para que el admin
// de ligas siga ofreciendo las categorías de siempre.
const DEFAULT_CATEGORIES: CarCategoryOption[] = ['GT3', 'HYPERCAR', 'LMP2', 'GTE', 'F1', 'GT4'].map((key) => ({ key, name: key, active: true }))

export const getCarCategories = cache(async (): Promise<CarCategoryOption[]> => {
  try {
    const rows = await db.carCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
    if (rows.length === 0) return DEFAULT_CATEGORIES
    return rows.map((r) => ({ key: r.key, name: r.name, active: r.active }))
  } catch (error) {
    console.error('Failed to get car categories:', error)
    return DEFAULT_CATEGORIES
  }
})
