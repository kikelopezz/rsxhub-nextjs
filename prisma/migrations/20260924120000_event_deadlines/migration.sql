-- Fechas límite configurables por ronda: entrega de skins y alta de equipos/coches
ALTER TABLE "league_events" ADD COLUMN "skins_deadline" TIMESTAMP(3);
ALTER TABLE "league_events" ADD COLUMN "entries_deadline" TIMESTAMP(3);
