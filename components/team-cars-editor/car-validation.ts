import type { CarEntry, TakenDorsal } from './types'
import type { Dictionary } from '@/lib/i18n/dictionaries/es'

type ValidationDict = Dictionary['equipos']['carEditor']

/**
 * Checks whether two league scopes overlap.
 * null/empty means "all leagues" and always overlaps with anything.
 */
export function leaguesOverlap(l1?: string | null, l2?: string | null): boolean {
  if (!l1 || !l2) return true
  return l1 === l2
}

/** A team may field at most this many cars of a given category within the same league. */
export const MAX_CARS_PER_CATEGORY = 3

/**
 * Computes per-car validation errors.
 * Returns a map of carId -> string[] of error messages.
 * An empty object means all cars are valid.
 */
export function computeCarValidation(
  cars: CarEntry[],
  takenDorsals: TakenDorsal[],
  currentTeamId: string,
  t: ValidationDict,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  for (const car of cars) {
    const carErrs: string[] = []

    // Only the car model is mandatory — league, dorsal and skin can be filled in later.
    const d = String(car.dorsal || '').trim()
    if (d && !/^[0-9]{1,3}$/.test(d)) {
      carErrs.push(t.errorDorsalFormat)
    }

    if (!car.modelName) {
      carErrs.push(t.errorModelRequired)
    }

    const sameCategoryLeagueCount = cars.filter((other) => {
      if (String(other.category).toUpperCase() !== String(car.category).toUpperCase()) return false
      return leaguesOverlap(car.leagueId, other.leagueId)
    }).length

    if (sameCategoryLeagueCount > MAX_CARS_PER_CATEGORY) {
      carErrs.push(
        t.errorMaxCarsPerCategory
          .replace('{max}', String(MAX_CARS_PER_CATEGORY))
          .replace('{category}', car.category)
          .replace('{count}', String(sameCategoryLeagueCount)),
      )
    }

    if (d && /^[0-9]{1,3}$/.test(d)) {
      const internalCollision = cars.find((other) => {
        if (other.id === car.id) return false
        const otherD = String(other.dorsal || '').trim()
        if (!otherD || otherD !== d) return false
        if (String(other.category).toUpperCase() !== String(car.category).toUpperCase()) return false
        return leaguesOverlap(car.leagueId, other.leagueId)
      })
      if (internalCollision) {
        carErrs.push(t.errorDuplicateInternal.replace('{dorsal}', d))
      }

      const takenByOther = takenDorsals.find((td) => {
        if (td.teamId === currentTeamId) return false
        const otherD = String(td.dorsal || '').trim()
        if (!otherD || otherD !== d) return false
        if (String(td.category).toUpperCase() !== String(car.category).toUpperCase()) return false
        return leaguesOverlap(car.leagueId, td.leagueId)
      })
      if (takenByOther) {
        carErrs.push(
          t.errorDuplicateOther
            .replace('{dorsal}', d)
            .replace('{team}', takenByOther.teamName || t.anotherTeamFallback)
        )
      }
    }

    if (carErrs.length > 0) {
      errors[car.id] = carErrs
    }
  }

  return errors
}
