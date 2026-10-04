-- Licencias por categoría (ver lib/licenses.ts): una fila por piloto y categoría superada.
CREATE TABLE "driver_licenses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "class_tag" TEXT NOT NULL,
    "best_lap_ns" INTEGER NOT NULL,
    "reference_lap_ns" INTEGER NOT NULL,
    "steam_hours" INTEGER NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_licenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_licenses_user_id_idx" ON "driver_licenses"("user_id");

CREATE UNIQUE INDEX "driver_licenses_user_id_class_tag_key" ON "driver_licenses"("user_id", "class_tag");

ALTER TABLE "driver_licenses" ADD CONSTRAINT "driver_licenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
