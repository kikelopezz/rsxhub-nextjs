import { db } from '@/lib/db'

/**
 * Registro de auditoría de acciones de administración de alto impacto. Nunca debe tirar abajo la
 * acción que audita: si escribir el registro falla, se traga el error (igual que otros sitios de
 * este archivo tratan un fallo de infraestructura no crítico) en vez de deshacer la acción real.
 */
export async function logAdminAction(input: {
  actorUserId: string
  actorName: string
  action: string
  targetId?: string | null
  detail?: string | null
}): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        action: input.action,
        targetId: input.targetId ?? null,
        detail: input.detail ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to write admin audit log entry:', error)
  }
}
