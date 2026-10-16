-- Permite resultados manuales para coches/equipos sin piloto registrado en la plataforma (ver
-- admin-results-editor.ts): en ese caso user_id queda a null y se usan solo los campos de texto
-- libre que ya existían (driver_name, team_name, dorsal...).
ALTER TABLE "league_results" ALTER COLUMN "user_id" DROP NOT NULL;
