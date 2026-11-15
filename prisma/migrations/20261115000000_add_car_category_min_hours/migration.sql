-- Horas mínimas jugadas en Assetto Corsa (Steam) requeridas para inscribirse en esta categoría.
-- 0 = sin mínimo (comportamiento actual, sin cambios para las categorías existentes).
ALTER TABLE "car_categories" ADD COLUMN "min_hours" INTEGER NOT NULL DEFAULT 0;
