import { db } from '@/lib/db'
import { flattenHubEntries, getHubEntries, type FlatHubEntry, type HubEntry } from '@/lib/hub-entries'
import { findEntry, loadLeagueEntries, type LeagueEntry } from '@/lib/league-entries'
import { getClassTagFromModel } from '@/lib/live-timing'

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
  /** Todas las entradas de Equipos aplanadas (no solo las del Steam ID de esta fila) — para
   * poder buscar por equipo+número cuando el Steam ID no está vinculado todavía. */
  hubFlat?: FlatHubEntry[]
}): CarDetection {
  const { steamId, classTag, storedTeam, storedDorsal, hub, registration, hubFlat } = args
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
    // Nada por Steam ID. Si el archivo trae equipo y número, se busca ese mismo equipo+número en
    // Equipos por si el piloto todavía no tiene su Steam ID vinculado ahí — mejor que asumir que
    // no hay coche cuando sí lo hay, solo que vinculado a otro Steam ID o sin vincular.
    const byTeamNumber = (storedTeam && storedDorsal
      ? (hubFlat || []).find(
          (e) =>
            e.dorsal === storedDorsal &&
            e.teamName.trim().toLowerCase() === storedTeam.trim().toLowerCase() &&
            sameCategory(e.category, classTag)
        )
      : undefined)

    if (byTeamNumber) {
      flags.push(steamId ? 'not-found' : 'no-steam')
      detection = { teamName: byTeamNumber.teamName, dorsal: byTeamNumber.dorsal, carModel: byTeamNumber.carModel, source: 'team-car' }
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
  }

  if (storedDorsal && detection.dorsal && storedDorsal !== detection.dorsal) flags.push('file-differs')
  else if (storedTeam && detection.teamName && storedTeam.trim().toLowerCase() !== detection.teamName.trim().toLowerCase() && detection.source !== 'file') flags.push('file-differs')

  return { ...detection, flags }
}

/* ------------------------------------------------------------- correlación */

/**
 * Categoría de cada modelo de coche que algún equipo ya tiene registrado (modelName/modelFolder, en
 * minúsculas → category). Complementa la lista fija de `live-timing.ts` con los coches que los propios
 * equipos han dado de alta, para poder clasificar por categoría a un piloto sin equipo asignado con solo
 * el modelo que trae el archivo de resultados.
 */
export async function loadCarModelCategoryMap(): Promise<Record<string, string>> {
  const cars = await db.teamCar.findMany({
    where: { OR: [{ modelName: { not: null } }, { modelFolder: { not: null } }] },
    select: { modelName: true, modelFolder: true, category: true },
  })
  const map: Record<string, string> = {}
  for (const c of cars) {
    const cat = c.category.trim().toUpperCase()
    if (!cat) continue
    if (c.modelFolder) map[c.modelFolder.trim().toLowerCase()] ||= cat
    if (c.modelName) map[c.modelName.trim().toLowerCase()] ||= cat
  }
  return map
}

/** Datos necesarios para vincular filas de resultados con equipos y coches (se cargan una vez por sesión). */
export type CorrelationContext = {
  hub: Record<string, HubEntry[]>
  hubFlat: FlatHubEntry[]
  entries: LeagueEntry[]
  reviews: ReviewMap
  carModelCategory: Record<string, string>
}

export async function loadCorrelationContext(leagueId: string, eventId: string, sessionType: string): Promise<CorrelationContext> {
  // Si alguna de las fuentes falla, esa parte se salta: los resultados se siguen mostrando con lo que haya
  const safely = async <T,>(load: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await load()
    } catch {
      return fallback
    }
  }
  const [hub, entries, reviews, carModelCategory] = await Promise.all([
    safely(() => getHubEntries(), {} as Record<string, HubEntry[]>),
    safely(() => loadLeagueEntries(leagueId), [] as LeagueEntry[]),
    safely(() => readReviews(eventId, sessionType), {} as ReviewMap),
    safely(() => loadCarModelCategoryMap(), {} as Record<string, string>),
  ])
  return { hub, hubFlat: flattenHubEntries(hub), entries, reviews, carModelCategory }
}

export type CorrelatedRow = {
  classTag: string
  teamName: string | null
  dorsal: string | null
  carModel: string | null
  detection: CarDetection
  reviewKey: string
  review: ReviewEntry | undefined
}

/**
 * Vincula una fila de resultados con su equipo, número, modelo de coche y CATEGORÍA a través del Steam ID del
 * piloto. Es la única regla que usan todas las pantallas y APIs que muestran resultados.
 *
 * Prioridad para decidir la categoría (GT3, LMP2...) de la fila:
 *  1. El coche que el piloto tiene asignado en Equipos para ese Steam ID — si solo tiene coche en una
 *     categoría, esa manda sobre lo que traiga el archivo (el archivo a menudo no trae categoría, o la trae mal).
 *  2. Si el piloto tiene coches en Equipos de VARIAS categorías (caso raro), se usa la categoría del coche que
 *     trae el archivo (explícita o deducida de su modelo) para desempatar cuál de esos coches es el de esta fila.
 *  3. Si el piloto no tiene ningún equipo/coche asignado, se usa el coche que trae el archivo: categoría
 *     explícita o, si no, la deducida de su modelo (p. ej. "Oreca 07" → LMP2), con la lista fija de
 *     `live-timing.ts` y con los modelos que los equipos ya tienen registrados (`ctx.carModelCategory`).
 *  4. Sin nada de lo anterior, GT3 por defecto.
 * Por encima de todo esto manda lo que un admin haya corregido a mano (revisión guardada).
 */
export function correlateRow(
  ctx: CorrelationContext,
  row: {
    userId?: string | null
    steamId?: string | null
    driverName?: string | null
    classTag?: string | null
    teamName?: string | null
    dorsal?: string | null
    /** Modelo de coche que traía el archivo de resultados (folder de Assetto Corsa), si lo trae. */
    carModel?: string | null
  }
): CorrelatedRow {
  const steamId = row.steamId || ''
  const driverName = row.driverName || ''

  const fileGuess = (
    row.classTag ||
    (row.carModel ? getClassTagFromModel(row.carModel, ctx.carModelCategory) : null) ||
    ''
  )
    .trim()
    .toUpperCase() || null

  const hubForSteam = ctx.hub[steamId] || []
  const teamCategories = Array.from(new Set(hubForSteam.filter((e) => e.dorsal && e.category).map((e) => e.category as string)))

  let classTag: string
  if (teamCategories.length === 1) {
    // El equipo deja claro en qué categoría corre este piloto: manda sobre el archivo.
    classTag = teamCategories[0]
  } else if (teamCategories.length > 1 && fileGuess && teamCategories.includes(fileGuess)) {
    // Varios coches posibles en Equipos: el coche que trae el archivo desempata cuál es.
    classTag = fileGuess
  } else {
    // Sin coche claro en Equipos: el coche del archivo (o su modelo) decide, y si no hay nada, GT3.
    classTag = fileGuess || teamCategories[0] || 'GT3'
  }

  const registration = findEntry(ctx.entries, { userId: row.userId, steamId, driverName }, classTag)
  const detection = detectCar({
    steamId,
    classTag,
    storedTeam: row.teamName ?? null,
    storedDorsal: row.dorsal ?? null,
    hub: ctx.hub[steamId],
    registration,
    hubFlat: ctx.hubFlat,
  })

  const reviewKey = reviewRowKey(steamId, driverName, classTag)
  const review = ctx.reviews[reviewKey]
  let teamName = detection.teamName || row.teamName || null
  let dorsal = detection.dorsal || row.dorsal || null
  // Lo que un admin ha corregido a mano manda sobre cualquier detección
  if (review?.status === 'override') {
    if (review.teamName) teamName = review.teamName
    if (review.dorsal) dorsal = review.dorsal
  }
  return { classTag, teamName, dorsal, carModel: detection.carModel || row.carModel || null, detection, reviewKey, review }
}
