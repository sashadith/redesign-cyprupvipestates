-- Hebrew content columns, additive and nullable. Table names are the @@map'd
-- physical names (development_overrides / area_descriptions), NOT the Prisma
-- model names — the first version of this file used "DevelopmentOverride" /
-- "AreaDescription" and failed on staging 2026-09-20 with 42P01 (relation
-- does not exist); Postgres rolled the transaction back, nothing partial was
-- applied. Recovery: `migrate resolve --rolled-back 20260914100100_he_content_columns`
-- (through scripts/migrate-deploy-safe.sh), then `migrate deploy` again.
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "descriptionHE" TEXT;
ALTER TABLE "area_descriptions" ADD COLUMN IF NOT EXISTS "textHE" TEXT;
