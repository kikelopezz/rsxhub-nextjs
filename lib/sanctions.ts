// Compartido entre la acción de servidor (admin-sanctions.ts, 'use server', solo puede exportar
// funciones async), la página del formulario y la ruta de exportación a Excel.
export const SANCTION_TYPES = [
  'warning',
  'time_penalty',
  'points_deduction',
  'grid_drop',
  'disqualification',
  'race_ban',
  'season_ban',
  'other',
] as const

export type SanctionType = (typeof SANCTION_TYPES)[number]

export const SANCTION_TYPE_LABELS: Record<SanctionType, string> = {
  warning: 'Aviso',
  time_penalty: 'Penalización de tiempo',
  points_deduction: 'Resta de puntos',
  grid_drop: 'Penalización en parrilla',
  disqualification: 'Descalificación',
  race_ban: 'Race Ban',
  season_ban: 'Season Ban',
  other: 'Otra',
}
