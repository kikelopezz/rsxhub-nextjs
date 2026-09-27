/**
 * Tiempos de vuelta en formato m:ss.mmm (minutos, segundos y milésimas), p. ej. 76451 ms → "1:16.451".
 *
 * Los resultados guardan el tiempo tal como venía en el JSON de la carrera: normalmente milisegundos ("76451"), pero
 * también puede ser en nanosegundos (los que da el live timing) o ya con formato ("1:16.451").
 */
export function formatLapTime(raw: string | number | null | undefined): string {
  if (raw == null) return '—'
  const text = String(raw).trim()
  if (!text) return '—'
  // Ya viene con formato (contiene minutos o dos puntos): se deja como está
  if (text.includes(':')) return text

  const n = Number(text.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return '—'

  // Nanosegundos (> 1e9), milisegundos (>= 1000, sin decimales) o segundos con decimales (< 1000)
  const ms = n >= 1e9 ? n / 1e6 : n >= 1000 ? n : n * 1000
  return formatMs(ms)
}

/** Milisegundos → m:ss.mmm, o h:mm:ss.mmm a partir de la hora (tiempos de carrera). */
export function formatMs(ms: number): string {
  const total = Math.round(ms)
  const millis = total % 1000
  const seconds = Math.floor(total / 1000) % 60
  const minutes = Math.floor(total / 60_000) % 60
  const hours = Math.floor(total / 3_600_000)
  const mmm = String(millis).padStart(3, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}.${mmm}` : `${minutes}:${ss}.${mmm}`
}
