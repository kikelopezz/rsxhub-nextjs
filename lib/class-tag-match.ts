/**
 * lib/class-tag-match.ts
 *
 * Compara la categoría de un coche (TeamCar.category: siempre "GT3" | "LMP2" | "HYPERCAR",
 * fijado por el editor de coches) contra el classTag de una liga (League.classTags: texto libre
 * que escribe el admin, sin validar contra esas 3 opciones — ver league-edit-modal.tsx).
 *
 * Un admin puede escribir "LMDh" o "LMH" en vez de "HYPERCAR" para la clase reina y, con una
 * comparación exacta, eso deja a esos equipos fuera de la clasificación aunque tengan coche y
 * puntos (el coche nunca hace match con el classTag de la liga). Ya existía el mismo problema
 * para LMP2/LMP3 y se resolvió igual: tratando como equivalente cualquier texto que empiece por
 * "LMP". Aquí se generaliza con grupos de alias explícitos.
 */

const ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['HYPERCAR', 'LMDH', 'LMH'],
]

function normalize(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase()
}

/** ¿Son la misma clase a efectos de liga, aceptando los alias conocidos (LMP*, Hypercar/LMDh/LMH)? */
export function sameClassTag(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = normalize(a)
  const cb = normalize(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  if (ca.startsWith('LMP') && cb.startsWith('LMP')) return true
  return ALIAS_GROUPS.some((group) => group.includes(ca) && group.includes(cb))
}

/**
 * Texto canónico de una clase: reduce cualquier alias conocido a una única forma, para usarlo como
 * clave de mapa (p. ej. los puntos por clase en getTeamPointsOverrides) donde `sameClassTag` no sirve
 * porque hace falta una clave exacta, no una comparación. "LMDH"/"LMH" → "HYPERCAR"; "LMP2"/"LMP3"/… →
 * "LMP"; cualquier otra cosa se deja tal cual (en mayúsculas).
 */
export function canonicalClassTag(value: string | null | undefined): string {
  const c = normalize(value)
  if (!c) return c
  if (c.startsWith('LMP')) return 'LMP'
  const group = ALIAS_GROUPS.find((g) => g.includes(c))
  return group ? group[0]! : c
}
