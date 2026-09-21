/**
 * The teams listing (/equipos) is public and its data is serialized straight into the page the
 * browser receives. It only needs names/logos/skins, so everything else `getTeamsDashboard`
 * returns for the whole platform — pending invites (with the invited person's SteamID and the
 * private invite message), members' SteamIDs / user ids, and each car's driver ids — is dropped
 * here, server-side, before it can reach a client component.
 */
type MemberLike = { id?: string; role?: string; displayName?: string; steamDisplayName?: string; avatarUrl?: string | null }

export function toPublicTeamListing<T extends { members: MemberLike[]; invites?: unknown[]; cars?: unknown[] }>(team: T): T {
  return {
    ...team,
    invites: [],
    cars: [],
    members: team.members.map((m) => ({
      id: m.id,
      role: m.role,
      displayName: m.displayName,
      steamDisplayName: m.steamDisplayName,
      avatarUrl: m.avatarUrl,
    })),
  }
}
