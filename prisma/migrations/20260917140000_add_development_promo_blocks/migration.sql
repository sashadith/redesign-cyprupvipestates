-- Adds the long-form promotional content block (rendered between the map
-- and the units section on /projects/[slug]), separate from the existing
-- short description{EN,DE,PL,RU} fields. Same Portable-Text-shaped JSON
-- array BlockEditor already produces for blog/case-study content.
--
-- Purely additive, all four columns nullable — no backfill needed, existing
-- rows just have no promo block until an admin adds one.

-- AlterTable
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "promoBlocksEN" JSONB;
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "promoBlocksDE" JSONB;
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "promoBlocksPL" JSONB;
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "promoBlocksRU" JSONB;
