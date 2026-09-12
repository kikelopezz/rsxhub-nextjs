-- CreateEnum
CREATE TYPE "SkinReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "car_skin_reviews" (
    "id" TEXT NOT NULL,
    "car_key" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dorsal" TEXT NOT NULL,
    "league_id" TEXT,
    "skin_url" TEXT NOT NULL,
    "skin_name" TEXT,
    "status" "SkinReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "car_skin_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "car_skin_reviews_car_key_key" ON "car_skin_reviews"("car_key");

-- CreateIndex
CREATE INDEX "car_skin_reviews_team_id_idx" ON "car_skin_reviews"("team_id");

-- CreateIndex
CREATE INDEX "car_skin_reviews_status_idx" ON "car_skin_reviews"("status");

-- AddForeignKey
ALTER TABLE "car_skin_reviews" ADD CONSTRAINT "car_skin_reviews_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

