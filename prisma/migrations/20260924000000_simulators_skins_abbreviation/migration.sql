-- Formatos y estados nuevos de campeonato
ALTER TYPE "LeagueFormat" ADD VALUE IF NOT EXISTS 'time_attack';
ALTER TYPE "LeagueStatus" ADD VALUE IF NOT EXISTS 'closed';

-- Simuladores configurables: el enum "Simulator" pasa a texto + tabla "simulators"
CREATE TABLE "simulators" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulators_pkey" PRIMARY KEY ("key")
);

INSERT INTO "simulators" ("key", "name", "logo_url", "sort_order") VALUES
  ('ac', 'Assetto Corsa', '/branding/ACLogo.png', 0),
  ('lmu', 'Le Mans Ultimate', '/branding/LMULogo.png', 1);

ALTER TABLE "leagues" ALTER COLUMN "simulator" TYPE TEXT USING "simulator"::text;
ALTER TABLE "leagues" ALTER COLUMN "simulator" SET DEFAULT 'ac';
ALTER TABLE "profiles" ALTER COLUMN "main_sim" DROP DEFAULT;
ALTER TABLE "profiles" ALTER COLUMN "main_sim" TYPE TEXT USING "main_sim"::text;
ALTER TABLE "profiles" ALTER COLUMN "main_sim" SET DEFAULT 'ac';
ALTER TABLE "market_listings" ALTER COLUMN "main_sim" TYPE TEXT USING "main_sim"::text;
DROP TYPE "Simulator";

-- Abreviatura del equipo y datos extra de las skins
ALTER TABLE "teams" ADD COLUMN "abbreviation" TEXT;
ALTER TABLE "car_skin_reviews" ADD COLUMN "car_model" TEXT;
ALTER TABLE "car_skin_reviews" ADD COLUMN "reject_reason" TEXT;
