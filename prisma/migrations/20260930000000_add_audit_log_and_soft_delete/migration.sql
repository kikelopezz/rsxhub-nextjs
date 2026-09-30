-- Papelera para ligas/equipos (borrado suave) + rastro de auditoría para acciones
-- administrativas sensibles (borrados, cambios de rol de admin, "BORRAR TODO").
ALTER TABLE "leagues" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "teams" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_steam_id" TEXT,
    "actor_label" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "entity_label" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
