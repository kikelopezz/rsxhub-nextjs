-- Sanciones de equipo puestas a mano por un admin (race ban, season ban, descalificado).
-- Solo se muestran en el panel de admin, nunca en la página pública del equipo.
ALTER TABLE "teams" ADD COLUMN "sanction_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
