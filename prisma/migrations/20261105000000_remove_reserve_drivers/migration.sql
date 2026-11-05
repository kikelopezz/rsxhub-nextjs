-- Quitar pilotos reserva del todo: las filas marcadas como reserva se eliminan de la
-- alineación (no se promocionan a piloto normal), y se quita la columna is_reserve.
DELETE FROM "team_car_league_drivers" WHERE "is_reserve" = true;

DROP INDEX "team_car_league_drivers_car_id_user_id_league_id_is_reserve_key";

ALTER TABLE "team_car_league_drivers" DROP COLUMN "is_reserve";

CREATE UNIQUE INDEX "team_car_league_drivers_car_id_user_id_league_id_key" ON "team_car_league_drivers"("car_id", "user_id", "league_id");
