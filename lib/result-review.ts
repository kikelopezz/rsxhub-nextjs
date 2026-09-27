import { db } from '@/lib/db'
import type { HubEntry } from '@/lib/hub-entries'
import type { LeagueEntry } from '@/lib/league-entries'

/**
 * Detección y revisión del coche que ha quedado en cada posición de unos resultados.
 *
 * Cada fila de resultados trae un Steam ID. Con él se busca en el apartado de Equipos qué coche (equipo, número y
 * modelo) tiene ese piloto en la categoría de la fila. Lo que no encaja se marca para que un admin lo revise, y el admin
 * puede confirmarlo o corregirlo. Las revisiones se guardan en la tabla de ajustes (una entrada por sesión), sin tocar el
 * esquema de la base de datos, y sobreviven a volver a subir el archivo porque se identifican por Steam ID y categoría.
 */

export type ReviewFlag =
  | 'no-steam'
  | 'not-found'
  | 'no-car'
  | 'category-mismatch'
  | 'multiple-cars'
  | 'duplicate-number'
  | 'file-differs'

/** Avisos que hacen que una fila necesite revisión (file-differs es solo informativo) */
export const WARNING_FLAGS: ReviewFlag[] = ['no-steam', 'not-found', 'no-car', 'category-mismatch', 'multiple-cars', 'duplicate-number']

export type CarDetection = {
  teamName: string | null
  dorsal: string | null
  carModel: string | null
  source: 'team-car' | 'team-member' | 'registration' | 'file' | 'none'
  flags: ReviewFlag[]
}

export type ReviewEntry = {
  status: 'confirmed' | 'override'
  teamName?: string | null
  dorsal?: string | null
  by: string
  at: string
}
export type ReviewMap = Record<string, ReviewEntry>

export const reviewSettingKey = (eventId: string, sessionType: string) => `result_review:${eventId}:${sessionType}`

export const reviewRowKey = (steamId: string | null | undefined, driverName: string, classTag: string) =>
  `${steamId || `name:${driverName.trim().toLowerCase()}`}|${classTag.trim().toUpperCase()}`

export async function readReviews(eventId: string, sessionType: string): Promise<ReviewMap> {
  const row = await db.setting.findUnique({ where: { key: reviewSettingKey(eventId, sessionType) } })
  const value = row?.value
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as unknown as ReviewMap) : {}
}

export async function writeReviews(eventId: string, sessionType: string, map: ReviewMap) {
  const key = reviewSettingKey(eventId, sessionType)
  const value = map as any
  if (Object.keys(map).length === 0) {
    await db.setting.deleteMany({ where: { key } })
    return
  }
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

const sameCategory = (category: string | null, classTag: string) => {
  if (!category) return false
  const cls = classTag.trim().toUpperCase()
  return category === cls || cls.includes(category) || category.includes(cls)
}

/**
 * Qué coche corresponde a una fila de resultados, según su Steam ID.
 * Orden de fuentes: coche del piloto en Equipos → equipo del que es miembro → inscripción en la liga → lo que traía el archivo.
 */
export function detectCar(args: {
  steamId: string
  classTag: string
  storedTeam: string | null
  storedDorsal: string | null
  hub: HubEntry[] | undefined
  registration: LeagueEntry | null
}): CarDetection {
  const { steamId, classTag, storedTeam, storedDorsal, hub, registration } = args
  const flags: ReviewFlag[] = []
  const entries = hub || []
  const withCar = entries.filter((e) => e.dorsal)
  const inCategory = withCar.filter((e) => sameCategory(e.category, classTag))

  let detection: Omit<CarDetection, 'flags'>
  if (inCategory.length > 0) {
    const pick = inCategory[0]
    if (new Set(inCategory.map((e) => e.dorsal)).size > 1) flags.push('multiple-cars')
    detection = { teamName: pick.teamName, dorsal: pick.dorsal, carModel: pick.carModel, source: 'team-car' }
  } else if (withCar.length > 0) {
    // Tiene coche en Equipos, pero de otra categoría
    const pick = withCar[0]
    flags.push('category-mismatch')
    detection = { teamName: pick.teamName, dorsal: pick.dorsal, carModel: pick.carModel, source: 'team-car' }
  } else if (entries.length > 0) {
    // Es miembro de un equipo pero sin coche asignado: el equipo es fiable, el número no
    flags.push('no-car')
    detection = { teamName: entries[0].teamName, dorsal: registration?.dorsal ?? storedDorsal, carModel: null, source: 'team-member' }
  } else {
    flags.push(steamId ? 'not-found' : 'no-steam')
    if (registration && (registration.teamName || registration.dorsal)) {
      detection = { teamName: registration.teamName, dorsal: registration.dorsal, carModel: null, source: 'registration' }
    } else if (storedTeam || storedDorsal) {
      detection = { teamName: storedTeam, dorsal: storedDorsal, carModel: null, source: 'file' }
    } else {
      detection = { teamName: null, dorsal: null, carModel: null, source: 'none' }
    }
  }

  if (storedDorsal && detection.dorsal && storedDorsal !== detection.dorsal) flags.push('file-differs')
  else if (storedTeam && detection.teamName && storedTeam.trim().toLowerCase() !== detection.teamName.trim().toLowerCase() && detection.source !== 'file') flags.push('file-differs')

  return { ...detection, flags }
}
