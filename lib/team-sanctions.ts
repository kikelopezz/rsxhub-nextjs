// Constantes compartidas entre la acción de servidor (admin-team.ts, que es 'use server' y por
// tanto solo puede exportar funciones async) y la tabla de admin (admin-teams-table.tsx).
export const TEAM_SANCTION_TAGS = ['race_ban', 'season_ban', 'disqualified'] as const
export type TeamSanctionTag = (typeof TEAM_SANCTION_TAGS)[number]
