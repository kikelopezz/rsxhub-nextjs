import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { SessionUser } from '@/types'

export type AuditAction =
  | 'league.delete'
  | 'league.restore'
  | 'league.purge'
  | 'team.delete'
  | 'team.restore'
  | 'team.purge'
  | 'admin.grant'
  | 'admin.revoke'
  | 'ticket_access.grant'
  | 'ticket_access.revoke'
  | 'user.delete'
  | 'platform_role.update'
  | 'league_role.update'
  | 'platform.reset_all'

/**
 * Writes one audit-trail row for a sensitive admin action. Never throws — a logging failure
 * must not block or roll back the action it's recording, so this only ever logs to the
 * console on error and swallows it, same as the rest of this app's best-effort side effects.
 */
export async function logAudit(params: {
  actor: SessionUser | null
  action: AuditAction
  entityType?: string
  entityId?: string
  entityLabel?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: params.actor?.userId ?? null,
        actorSteamId: params.actor?.steamId ?? null,
        actorLabel: params.actor?.steamDisplayName ?? 'system',
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        entityLabel: params.entityLabel ?? null,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (err) {
    console.error(`Failed to write audit log entry (${params.action}):`, err)
  }
}
