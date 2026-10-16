-- Botón "Mostrar/Ocultar" del admin: separado de "status" para poder ocultar un campeonato de
-- las páginas públicas sin tocar su estado del flujo (draft/open/ongoing/...).
ALTER TABLE "leagues" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
