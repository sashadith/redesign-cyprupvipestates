-- API source support for developer feed analysis — ADDITIVE ONLY.
-- Adds one nullable JSON column for the API request recipe (never stores secrets).

-- AlterTable
ALTER TABLE "developer_feed_analyses" ADD COLUMN "sourceConfig" JSONB;
