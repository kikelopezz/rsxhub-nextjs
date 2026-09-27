-- Soporte (tickets de Discord) integrado en el Hub: configuración por servidor, contadores de
-- numeración, tickets y notas de CRM por identidad de Discord. Reemplaza al bot y la base de
-- datos SQLite aparte que había antes.

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'claimed', 'closed', 'merged');

-- CreateTable
CREATE TABLE "support_guild_configs" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "guild_name" TEXT,
    "panel_channel_id" TEXT,
    "panel_message_id" TEXT,
    "panel_title" TEXT NOT NULL DEFAULT 'Soporte',
    "panel_description" TEXT NOT NULL DEFAULT 'Pulsa el botón o elige una categoría para abrir un ticket con el equipo de staff.',
    "panel_style" TEXT NOT NULL DEFAULT 'menu',
    "embed_color" TEXT NOT NULL DEFAULT '#1274de',
    "category_id" TEXT,
    "transcript_channel_id" TEXT,
    "log_channel_id" TEXT,
    "staff_role_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ping_role_id" TEXT,
    "max_open_tickets" INTEGER NOT NULL DEFAULT 1,
    "reminder_minutes" INTEGER NOT NULL DEFAULT 0,
    "welcome_message" TEXT NOT NULL DEFAULT 'Gracias por abrir un ticket, {user}. El equipo de staff te atenderá en breve.',
    "ticket_types" JSONB NOT NULL DEFAULT '[]',
    "campeonatos" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_guild_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_counters" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "support_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "type_id" TEXT,
    "type_label" TEXT,
    "campeonato_id" TEXT,
    "campeonato_label" TEXT,
    "opener_id" TEXT NOT NULL,
    "opener_tag" TEXT,
    "claimed_by" TEXT,
    "claimed_by_tag" TEXT,
    "claimed_at" TIMESTAMP(3),
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "closed_by_tag" TEXT,
    "close_reason" TEXT,
    "merged_into_id" TEXT,
    "transcript_url" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_notes" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "target_discord_id" TEXT NOT NULL,
    "target_tag" TEXT,
    "body" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_guild_configs_guild_id_key" ON "support_guild_configs"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_counters_guild_id_key_key" ON "support_counters"("guild_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_channel_id_key" ON "support_tickets"("channel_id");

-- CreateIndex
CREATE INDEX "support_tickets_guild_id_status_idx" ON "support_tickets"("guild_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_opener_id_idx" ON "support_tickets"("opener_id");

-- CreateIndex
CREATE INDEX "support_notes_guild_id_target_discord_id_idx" ON "support_notes"("guild_id", "target_discord_id");

-- AddForeignKey
ALTER TABLE "support_counters" ADD CONSTRAINT "support_counters_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "support_guild_configs"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "support_guild_configs"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
