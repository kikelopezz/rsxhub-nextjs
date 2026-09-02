-- Un unico numero de coche activo por clase y liga: las inscripciones
-- "rejected" quedan fuera del chequeo (una plaza rechazada libera el numero
-- para otro equipo), igual que hacia la app contra Firestore antes de migrar.
CREATE UNIQUE INDEX "uq_league_class_number_active"
  ON "league_registrations" ("league_id", "class_tag", "assigned_number")
  WHERE "status" <> 'rejected' AND "assigned_number" IS NOT NULL;
