/**
 * lib/dorsal-utils.ts
 * Shared utilities for car dorsal/number assignment and validation.
 */

/**
 * Finds the lowest available dorsal number not in the taken set.
 * Searches from min (default 12) up to max (default 999).
 * Returns null if no number is available in range.
 */
export function findAvailableDorsal(
  taken: number[],
  min: number = 12,
  max: number = 999
): number | null {
  const takenSet = new Set(taken)
  for (let num = min; num <= max; num++) {
    if (!takenSet.has(num)) return num
  }
  return null
}

/**
 * Returns true if the dorsal string is a valid car number.
 * Valid: 1-3 digit numeric string, or special values "0", "00", "000".
 */
export function isDorsalValid(dorsal: string): boolean {
  if (!dorsal) return false
  const trimmed = dorsal.trim()
  // Allow special values
  if (trimmed === '0' || trimmed === '00' || trimmed === '000') return true
  // Must be 1-3 numeric digits
  return /^\d{1,3}$/.test(trimmed)
}
