-- Solo los cambios aditivos de esta migración. NOTA: `prisma migrate diff` contra la base de datos
-- real también detectó `DROP COLUMN leagues.deleted_at`, `DROP COLUMN teams.deleted_at` y
-- `DROP TABLE audit_logs` — objetos que existen en producción pero no en este schema.prisma y que
-- ningún código de este repo referencia. Se han dejado FUERA a propósito: no forman parte de lo que
-- se pidió y podrían pertenecer a otra cosa; bórralos aparte, de forma deliberada, si confirmas que
-- de verdad no hacen falta.

-- AlterTable
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
