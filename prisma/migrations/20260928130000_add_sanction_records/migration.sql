-- Historial de sanciones (race directors / comisarios), independiente de Team.sanction_tags.
CREATE TYPE "SanctionType" AS ENUM ('warning', 'time_penalty', 'points_deduction', 'grid_drop', 'disqualification', 'race_ban', 'season_ban', 'other');

CREATE TABLE "sanction_records" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "event_id" TEXT,
    "team_id" TEXT,
    "driver_name" TEXT,
    "team_name_snapshot" TEXT,
    "sanction_type" "SanctionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sanction_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sanction_records_league_id_created_at_idx" ON "sanction_records"("league_id", "created_at");

ALTER TABLE "sanction_records" ADD CONSTRAINT "sanction_records_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sanction_records" ADD CONSTRAINT "sanction_records_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "league_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sanction_records" ADD CONSTRAINT "sanction_records_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
