-- Corrige un error de la migracion anterior: un mismo coche con varios
-- pilotos genera, a proposito, varias filas de league_registrations con el
-- mismo (league_id, class_tag, assigned_number) — una por piloto. La regla
-- de negocio real ("ese numero ya lo tiene OTRO equipo en esta clase") se
-- queda como chequeo de aplicacion, igual que ya vivia contra Firestore.
DROP INDEX IF EXISTS "uq_league_class_number_active";
