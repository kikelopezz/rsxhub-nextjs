-- Nombre de carrera/ronda, puesto por el staff al cerrar o transcribir un ticket, para poder
-- agrupar los tickets de un campeonato por carrera en el Hub.
ALTER TABLE "support_tickets" ADD COLUMN "race_name" TEXT;

CREATE INDEX "support_tickets_guild_id_campeonato_id_race_name_idx" ON "support_tickets"("guild_id", "campeonato_id", "race_name");
