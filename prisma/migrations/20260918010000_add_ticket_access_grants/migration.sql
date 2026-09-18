-- CreateTable
CREATE TABLE "ticket_access_grants" (
    "steam_id" TEXT NOT NULL,
    "granted_by_user_id" TEXT NOT NULL,
    "granted_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_access_grants_pkey" PRIMARY KEY ("steam_id")
);
