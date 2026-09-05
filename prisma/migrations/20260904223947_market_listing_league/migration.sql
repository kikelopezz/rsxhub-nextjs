-- AlterTable
ALTER TABLE "market_listings" ADD COLUMN     "league_id" TEXT,
ADD COLUMN     "league_title" TEXT;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
