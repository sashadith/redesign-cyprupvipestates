-- 2026-10-19 — guide (lead-magnet) requests get their own source instead of
-- BLOG_ENQUIRY, plus the requested guide's title and language on the lead.
-- Additive only. Existing BLOG_ENQUIRY guide leads are re-labelled by
-- scripts/backfill-guide-leads.mjs AFTER this is deployed (a new enum
-- value cannot be used in the transaction that adds it).
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'GUIDE_DOWNLOAD';

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "guideTitle" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "guideLanguage" TEXT;
