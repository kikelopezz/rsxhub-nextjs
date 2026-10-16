-- Catálogo de categorías de coches gestionable desde el admin (reemplaza la lista fija que
-- estaba harcodeada en app/admin/ligas/[id]/page.tsx). classTag sigue siendo texto libre en el
-- resto de tablas, sin FK hacia aquí.
CREATE TABLE "car_categories" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "car_categories_pkey" PRIMARY KEY ("key")
);
