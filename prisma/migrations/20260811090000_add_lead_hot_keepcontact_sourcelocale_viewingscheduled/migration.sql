-- 2026-08-11 — lead list rebuild. All additive: new enum value + three
-- nullable columns. Nothing removed, nothing cast, no data at risk.

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'KEEP_CONTACT' AFTER 'OFFER';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "hotAt" TIMESTAMP(3),
ADD COLUMN     "sourceLocale" "Locale",
ADD COLUMN     "viewingScheduledAt" TIMESTAMP(3);
