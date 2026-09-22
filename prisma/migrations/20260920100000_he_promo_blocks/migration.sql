-- Hebrew column for the long-form promotional block added by
-- 20260917140000_add_development_promo_blocks (EN/DE/PL/RU) — same shape,
-- same renderer; keeps the promo feature on the single-source locale list
-- (LOCALES) instead of a hard-coded four-language set. Additive, nullable,
-- no backfill: a Hebrew page falls back to the EN block until an admin (or
-- the translation queue, later) fills this in.

-- AlterTable
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "promoBlocksHE" JSONB;
