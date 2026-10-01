-- El tipo de sanción pasa de enum fijo a texto libre (una sanción real suele combinar varios
-- códigos del reglamento, p. ej. "DT + SG 30s", y el comisario tiene potestad para imponer algo
-- fuera de la tabla). Se usa ALTER COLUMN ... USING en vez de borrar y recrear la columna, para
-- conservar los valores ya guardados (quedan como texto plano del propio enum anterior).
ALTER TABLE "sanction_records" ALTER COLUMN "sanction_type" TYPE TEXT USING "sanction_type"::text;

DROP TYPE "SanctionType";

-- Dorsal del coche sancionado, ahora la forma principal de identificar al equipo/piloto en el
-- formulario de sanciones.
ALTER TABLE "sanction_records" ADD COLUMN "dorsal" INTEGER;
