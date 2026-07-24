-- Compose batch: formal-address title form for DE/PL first-contact salutation.
-- Pure additive — new enum type + ADD COLUMN with a default, no drops, no
-- renames, no type changes on existing columns.
CREATE TYPE "LeadSalutation" AS ENUM ('UNKNOWN', 'MR', 'MS');

ALTER TABLE "leads" ADD COLUMN     "salutation" "LeadSalutation" NOT NULL DEFAULT 'UNKNOWN';
