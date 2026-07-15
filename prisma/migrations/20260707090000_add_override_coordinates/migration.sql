-- Admin-set map coordinates on DevelopmentOverride (win over feed values).
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
