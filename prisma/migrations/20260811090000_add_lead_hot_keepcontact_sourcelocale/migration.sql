-- 2026-08-11 — lead list rebuild. All additive: new enum value + two
-- nullable columns. Nothing removed, nothing cast, no data at risk.
--
-- viewingScheduledAt is deliberately NOT here — it was already applied to
-- the real DB on 2026-08-10 via 20260810090000_add_lead_viewing_scheduled_at
-- (adopted into main's migration history alongside this one; see that
-- migration's folder for the incident this resolves).

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'KEEP_CONTACT' AFTER 'OFFER';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "hotAt" TIMESTAMP(3),
ADD COLUMN     "sourceLocale" "Locale";
