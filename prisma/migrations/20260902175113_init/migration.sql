-- CreateEnum
CREATE TYPE "Simulator" AS ENUM ('ac', 'lmu');

-- CreateEnum
CREATE TYPE "PlatformRoleValue" AS ENUM ('user', 'steward', 'platform_admin', 'super_admin');

-- CreateEnum
CREATE TYPE "LeagueFormat" AS ENUM ('sprint', 'endurance', 'gt3', 'prototype', 'formula', 'multiclass');

-- CreateEnum
CREATE TYPE "LeagueStatus" AS ENUM ('draft', 'open', 'ongoing', 'finished');

-- CreateEnum
CREATE TYPE "RegistrationMode" AS ENUM ('individual', 'team');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('race', 'qualifying', 'time_attack');

-- CreateEnum
CREATE TYPE "LeagueRoleValue" AS ENUM ('league_owner', 'league_admin', 'steward', 'team_manager', 'driver');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('pending', 'approved', 'rejected', 'waitlist');

-- CreateEnum
CREATE TYPE "TeamRegStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('qualifying', 'race');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('finished', 'dnf', 'dsq');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('pending', 'approved');

-- CreateEnum
CREATE TYPE "TeamRoleValue" AS ENUM ('owner', 'manager', 'driver');

-- CreateEnum
CREATE TYPE "TeamInviteStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "MarketListingType" AS ENUM ('team_seeking_driver', 'driver_seeking_team');

-- CreateEnum
CREATE TYPE "MarketApplicationStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steam_accounts" (
    "user_id" TEXT NOT NULL,
    "steam_id" TEXT NOT NULL,
    "steam_display_name" TEXT NOT NULL,
    "steam_avatar_url" TEXT,
    "steam_profile_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "steam_accounts_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "main_sim" "Simulator" NOT NULL DEFAULT 'ac',
    "avatar_url" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'ES',
    "bio" TEXT NOT NULL DEFAULT '',
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "preferred_categories" TEXT[],
    "racing_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "platform_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "PlatformRoleValue" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_grants" (
    "steam_id" TEXT NOT NULL,
    "granted_by_user_id" TEXT NOT NULL,
    "granted_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_grants_pkey" PRIMARY KEY ("steam_id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_description" TEXT NOT NULL DEFAULT '',
    "full_description" TEXT NOT NULL DEFAULT '',
    "simulator" "Simulator" NOT NULL,
    "format" "LeagueFormat" NOT NULL,
    "class_tags" TEXT[],
    "status" "LeagueStatus" NOT NULL DEFAULT 'draft',
    "banner_url" TEXT,
    "logo_url" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "registration_open" BOOLEAN NOT NULL DEFAULT false,
    "registration_mode" "RegistrationMode" NOT NULL DEFAULT 'individual',
    "accent_color" TEXT,
    "slogan" TEXT,
    "discord_url" TEXT,
    "youtube_url" TEXT,
    "rulebook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_class_limits" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "event_id" TEXT,
    "class_tag" TEXT NOT NULL,
    "max_cars" INTEGER NOT NULL,

    CONSTRAINT "league_class_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_events" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "circuit_id" TEXT,
    "title" TEXT,
    "circuit_name" TEXT NOT NULL,
    "circuit_image_url" TEXT,
    "server_link" TEXT,
    "has_qualy" BOOLEAN NOT NULL DEFAULT true,
    "qualy_starts_at" TIMESTAMP(3),
    "qualy_ends_at" TIMESTAMP(3),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'scheduled',
    "event_type" "EventType" NOT NULL DEFAULT 'race',
    "country_code" TEXT,
    "color" TEXT,
    "max_drivers" INTEGER,
    "qualy_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_cars" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "class_tag" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_members" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "LeagueRoleValue" NOT NULL DEFAULT 'driver',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_registrations" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "display_name" TEXT NOT NULL,
    "steam_id" TEXT,
    "class_tag" TEXT,
    "assigned_number" INTEGER,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_team_registrations" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "class_tag" TEXT,
    "car_number" INTEGER NOT NULL,
    "car_model" TEXT,
    "status" "TeamRegStatus" NOT NULL DEFAULT 'pending',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_team_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_team_registration_drivers" (
    "id" TEXT NOT NULL,
    "team_registration_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_number" INTEGER,

    CONSTRAINT "league_team_registration_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_event_confirmations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "class_tag" TEXT NOT NULL,
    "car_number" INTEGER NOT NULL,
    "car_model" TEXT,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_event_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_confirmation_drivers" (
    "id" TEXT NOT NULL,
    "confirmation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "event_confirmation_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_results" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_type" "SessionType" NOT NULL DEFAULT 'race',
    "position" INTEGER,
    "points" INTEGER,
    "status" "ResultStatus" NOT NULL DEFAULT 'finished',
    "driver_name" TEXT,
    "team_name" TEXT,
    "steam_id" TEXT,
    "class_tag" TEXT,
    "dorsal" TEXT,
    "lap_time" TEXT,
    "race_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_result_imports" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "payload_text" TEXT NOT NULL,
    "rows_total" INTEGER NOT NULL,
    "rows_imported" INTEGER NOT NULL,
    "rows_unresolved" INTEGER NOT NULL,
    "rows_not_registered" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_result_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_team_points" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "class_tag" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "league_team_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_number_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "class_tag" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,

    CONSTRAINT "driver_number_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "league_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "class_tags" TEXT[],
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "accent_color" TEXT,
    "slogan" TEXT,
    "discord_url" TEXT,
    "youtube_url" TEXT,
    "instagram_url" TEXT,
    "twitter_url" TEXT,
    "twitch_url" TEXT,
    "tiktok_url" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "car_skin_urls" TEXT[],
    "owner_user_id" TEXT NOT NULL,
    "max_slots" INTEGER,
    "status" "TeamStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_cars" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dorsal" TEXT NOT NULL,
    "model_name" TEXT,
    "model_folder" TEXT,
    "skin_url" TEXT,
    "skin_name" TEXT,
    "league_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_car_league_drivers" (
    "id" TEXT NOT NULL,
    "car_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "league_id" TEXT,

    CONSTRAINT "team_car_league_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_skin_assignments" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "league_slug" TEXT NOT NULL,
    "car_number" TEXT,
    "skin_url" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_skin_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TeamRoleValue" NOT NULL,
    "display_name" TEXT,
    "steam_id" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "invited_by_user_id" TEXT NOT NULL,
    "invited_user_id" TEXT,
    "invited_steam_id" TEXT,
    "message" TEXT,
    "status" "TeamInviteStatus" NOT NULL DEFAULT 'pending',
    "listing_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_listings" (
    "id" TEXT NOT NULL,
    "type" "MarketListingType" NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_avatar" TEXT,
    "country_code" TEXT,
    "team_id" TEXT,
    "team_name" TEXT,
    "team_logo" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "main_sim" "Simulator" NOT NULL,
    "class_tag" TEXT NOT NULL,
    "contact_info" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_applications" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "team_id" TEXT,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "user_avatar" TEXT,
    "contact_info" TEXT NOT NULL,
    "status" "MarketApplicationStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "steam_accounts_steam_id_key" ON "steam_accounts"("steam_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_user_id_role_key" ON "platform_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_slug_key" ON "leagues"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "league_class_limits_league_id_event_id_class_tag_key" ON "league_class_limits"("league_id", "event_id", "class_tag");

-- CreateIndex
CREATE UNIQUE INDEX "circuits_slug_key" ON "circuits"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "league_members_league_id_user_id_key" ON "league_members"("league_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_team_registrations_league_id_team_id_class_tag_car_n_key" ON "league_team_registrations"("league_id", "team_id", "class_tag", "car_number");

-- CreateIndex
CREATE UNIQUE INDEX "league_team_registration_drivers_team_registration_id_user__key" ON "league_team_registration_drivers"("team_registration_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_event_confirmations_event_id_team_id_class_tag_car_n_key" ON "league_event_confirmations"("event_id", "team_id", "class_tag", "car_number");

-- CreateIndex
CREATE UNIQUE INDEX "event_confirmation_drivers_confirmation_id_user_id_key" ON "event_confirmation_drivers"("confirmation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_team_points_league_id_class_tag_team_id_key" ON "league_team_points"("league_id", "class_tag", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_number_preferences_user_id_class_tag_priority_key" ON "driver_number_preferences"("user_id", "class_tag", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "team_car_league_drivers_car_id_user_id_league_id_key" ON "team_car_league_drivers"("car_id", "user_id", "league_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- AddForeignKey
ALTER TABLE "steam_accounts" ADD CONSTRAINT "steam_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_roles" ADD CONSTRAINT "platform_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_class_limits" ADD CONSTRAINT "league_class_limits_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_class_limits" ADD CONSTRAINT "league_class_limits_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "league_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_events" ADD CONSTRAINT "league_events_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_events" ADD CONSTRAINT "league_events_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_cars" ADD CONSTRAINT "league_cars_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_registrations" ADD CONSTRAINT "league_registrations_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_registrations" ADD CONSTRAINT "league_registrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_team_registrations" ADD CONSTRAINT "league_team_registrations_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_team_registrations" ADD CONSTRAINT "league_team_registrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_team_registration_drivers" ADD CONSTRAINT "league_team_registration_drivers_team_registration_id_fkey" FOREIGN KEY ("team_registration_id") REFERENCES "league_team_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_event_confirmations" ADD CONSTRAINT "league_event_confirmations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "league_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_event_confirmations" ADD CONSTRAINT "league_event_confirmations_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_event_confirmations" ADD CONSTRAINT "league_event_confirmations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_confirmation_drivers" ADD CONSTRAINT "event_confirmation_drivers_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "league_event_confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_results" ADD CONSTRAINT "league_results_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_results" ADD CONSTRAINT "league_results_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "league_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_result_imports" ADD CONSTRAINT "league_result_imports_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_result_imports" ADD CONSTRAINT "league_result_imports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "league_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_team_points" ADD CONSTRAINT "league_team_points_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_team_points" ADD CONSTRAINT "league_team_points_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_cars" ADD CONSTRAINT "team_cars_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_car_league_drivers" ADD CONSTRAINT "team_car_league_drivers_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "team_cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_skin_assignments" ADD CONSTRAINT "team_skin_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_applications" ADD CONSTRAINT "market_applications_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "market_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_applications" ADD CONSTRAINT "market_applications_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
