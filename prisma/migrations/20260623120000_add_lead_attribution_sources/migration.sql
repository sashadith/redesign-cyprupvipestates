-- New lead sources for partner / ROI / newsletter capture
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'PARTNER';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'ROI_CALCULATOR';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'NEWSLETTER';

-- Attribution columns (UTM / click ids / referrer)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utmContent" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "gclid" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "fbclid" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "referrer" TEXT;
