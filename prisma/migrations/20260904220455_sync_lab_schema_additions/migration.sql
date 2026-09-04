-- DropIndex
DROP INDEX "league_team_points_league_id_class_tag_team_id_key";

-- DropIndex
DROP INDEX "team_car_league_drivers_car_id_user_id_league_id_key";

-- AlterTable
ALTER TABLE "league_team_points" ADD COLUMN     "car_number" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "accent_color" TEXT,
ADD COLUMN     "banner_url" TEXT,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "team_car_league_drivers" ADD COLUMN     "is_reserve" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "role_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "lineup_change_logs" (
    "id" TEXT NOT NULL,
    "car_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lineup_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_notes" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "author_id" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lineup_change_logs_car_id_changed_at_idx" ON "lineup_change_logs"("car_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "league_team_points_league_id_class_tag_team_id_car_number_key" ON "league_team_points"("league_id", "class_tag", "team_id", "car_number");

-- CreateIndex
CREATE UNIQUE INDEX "team_car_league_drivers_car_id_user_id_league_id_is_reserve_key" ON "team_car_league_drivers"("car_id", "user_id", "league_id", "is_reserve");

