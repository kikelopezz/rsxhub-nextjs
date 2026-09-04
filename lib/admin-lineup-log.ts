import { db } from '@/lib/db'

const LINEUP_CHANGE_NOTIFICATION_TITLE = 'Cambio de alineación'

export type LineupChangeLogEntry = {
  id: string
  teamId: string
  teamName: string
  changedByName: string
  changedAt: string
}

/** Recent lineup edits across every team, newest first — the admin-facing audit log. */
export async function getRecentLineupChanges(limit = 50): Promise<LineupChangeLogEntry[]> {
  const logs = await db.lineupChangeLog.findMany({ orderBy: { changedAt: 'desc' }, take: limit })
  if (logs.length === 0) return []

  const teamIds = Array.from(new Set(logs.map((l) => l.teamId)))
  const userIds = Array.from(new Set(logs.map((l) => l.changedById)))

  const [teams, members] = await Promise.all([
    db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
    db.teamMember.findMany({
      where: { userId: { in: userIds }, teamId: { in: teamIds } },
      select: { teamId: true, userId: true, displayName: true },
    }),
  ])

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]))
  const memberNameByKey = new Map(members.map((m) => [`${m.teamId}_${m.userId}`, m.displayName]))

  return logs.map((l) => ({
    id: l.id,
    teamId: l.teamId,
    teamName: teamNameById.get(l.teamId) || 'Equipo eliminado',
    changedByName: memberNameByKey.get(`${l.teamId}_${l.changedById}`) || `Usuario ${l.changedById.slice(0, 6)}`,
    changedAt: l.changedAt.toISOString(),
  }))
}

/** Team ids with a lineup-change notification this admin hasn't seen yet — drives the blink. */
export async function getUnseenLineupChangeTeamIds(adminUserId: string): Promise<Set<string>> {
  const rows = await db.userNotification.findMany({
    where: { userId: adminUserId, title: LINEUP_CHANGE_NOTIFICATION_TITLE, read: false },
    select: { link: true },
  })
  const teamIds = new Set<string>()
  for (const row of rows) {
    const match = row.link?.match(/^\/equipos\/([^/?]+)/)
    if (match) teamIds.add(match[1])
  }
  return teamIds
}

export async function markLineupChangeNotificationsSeen(adminUserId: string) {
  await db.userNotification.updateMany({
    where: { userId: adminUserId, title: LINEUP_CHANGE_NOTIFICATION_TITLE, read: false },
    data: { read: true },
  })
}
