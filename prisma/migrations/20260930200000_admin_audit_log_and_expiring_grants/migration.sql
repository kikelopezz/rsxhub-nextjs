-- Esto es exactamente lo que se ejecutó contra producción (marcado como aplicado en
-- _prisma_migrations con este mismo nombre) — no se retoca después de aplicarlo.
--
-- NOTA: la tabla `admin_audit_log` de aquí abajo quedó huérfana casi de inmediato: una sesión en
-- paralelo añadió su propio sistema de auditoría (modelo `AuditLog` / tabla `audit_logs`, más
-- completo) y se adoptó ese en su lugar. La tabla existe en producción, vacía, sin ningún modelo
-- de Prisma que la use — se puede borrar en una migración aparte y deliberada si se confirma que
-- no hace falta, pero no se toca aquí para no encadenar otro DROP sin revisar.
ALTER TABLE "admin_grants" ADD COLUMN "expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ticket_access_grants" ADD COLUMN "expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_actor_user_id_idx" ON "admin_audit_log"("actor_user_id");
