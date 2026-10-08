-- Ligas de pago: las inscripciones nuevas quedan "pending" hasta que un admin
-- las apruebe a mano tras confirmar el pago fuera de la plataforma.
ALTER TABLE "leagues" ADD COLUMN "requires_payment" BOOLEAN NOT NULL DEFAULT false;
