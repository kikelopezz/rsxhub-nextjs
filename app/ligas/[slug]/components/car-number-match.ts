/**
 * El dorsal de un coche se guarda como texto ("001", "007"…) para poder llevar ceros a la
 * izquierda, pero la confirmación de asistencia lo guarda como número (columna Int) — "001" vuelve
 * como 1. Comparar ambos como texto exacto ("1" !== "001") hacía que un coche con dorsal de 3
 * cifras nunca apareciera como confirmado aunque la confirmación sí se hubiera guardado bien.
 * Sin dependencias de Next/React a propósito, para poder testearlo sin arrastrar medio servidor.
 */
export function sameCarNumber(a: unknown, b: unknown): boolean {
  const an = Number(String(a ?? '').trim())
  const bn = Number(String(b ?? '').trim())
  return Number.isFinite(an) && Number.isFinite(bn) && an === bn
}
