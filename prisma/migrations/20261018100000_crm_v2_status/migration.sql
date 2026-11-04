-- CRM v2 foundation (2026-10-18). Additive only.
-- RESERVED: written only by code that ships in the same deploy as this
-- migration, so no row can hold it while an older client is running.
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'RESERVED' AFTER 'OFFER';

CREATE TYPE "LostReason" AS ENUM ('BUDGET', 'BOUGHT_ELSEWHERE', 'UNREACHABLE', 'NOT_INTERESTED', 'TIMING', 'INVALID', 'OTHER');
ALTER TABLE "leads" ADD COLUMN "lostReason" "LostReason";
