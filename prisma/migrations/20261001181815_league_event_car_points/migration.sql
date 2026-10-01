-- CreateTable
CREATE TABLE "league_event_car_points" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "class_tag" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "car_number" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_event_car_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_event_car_points_league_id_event_id_class_tag_team_i_key" ON "league_event_car_points"("league_id", "event_id", "class_tag", "team_id", "car_number");

-- AddForeignKey
ALTER TABLE "league_event_car_points" ADD CONSTRAINT "league_event_car_points_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_event_car_points" ADD CONSTRAINT "league_event_car_points_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "league_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_event_car_points" ADD CONSTRAINT "league_event_car_points_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
