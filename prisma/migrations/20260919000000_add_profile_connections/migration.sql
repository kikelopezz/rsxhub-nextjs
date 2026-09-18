-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "connections" JSONB NOT NULL DEFAULT '{}';
