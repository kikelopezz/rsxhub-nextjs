// Pure, dependency-free — split out of lib/lineup-rules.ts (which pulls in the Prisma
// client) so client components can build the same composite key without bundling `db`.
export function carLineupKey(teamId: string, category: string, leagueId: string | null, dorsal: string) {
  return `${teamId}_${category}_${leagueId || 'general'}_${dorsal}`
}
