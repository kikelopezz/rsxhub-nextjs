-- Corte de alineaciones (vueltas mínimas + 105% de la mejor vuelta real): opcional por liga,
-- null = la liga no usa esta validación. Ver lib/lineup-cutoff.ts.
ALTER TABLE "leagues" ADD COLUMN "live_timing_source" TEXT;
ALTER TABLE "leagues" ADD COLUMN "cutoff_min_laps" INTEGER;
ALTER TABLE "leagues" ADD COLUMN "cutoff_percent_over_best" DOUBLE PRECISION;
