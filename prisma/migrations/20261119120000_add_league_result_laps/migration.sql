-- Numero de vueltas completadas, para poder mostrarlo en el resultado oficial de una ronda
-- (hasta ahora solo se guardaba posicion, mejor vuelta y tiempo total).
ALTER TABLE "league_results" ADD COLUMN "laps" INTEGER;
