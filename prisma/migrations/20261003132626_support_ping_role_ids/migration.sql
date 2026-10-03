-- Varios roles a mencionar (al abrir un ticket y en el recordatorio), en vez de uno solo.
ALTER TABLE "support_guild_configs" ADD COLUMN "ping_role_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Se conserva el rol que ya estuviera configurado.
UPDATE "support_guild_configs" SET "ping_role_ids" = ARRAY["ping_role_id"] WHERE "ping_role_id" IS NOT NULL;
