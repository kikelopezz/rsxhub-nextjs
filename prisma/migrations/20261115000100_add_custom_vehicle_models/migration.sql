-- Modelos de coche personalizados que un admin puede añadir, además de la lista fija
-- hardcodeada en components/vehicle-selector-modal.tsx.
CREATE TABLE "custom_vehicle_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ac_folder" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_vehicle_models_pkey" PRIMARY KEY ("id")
);
