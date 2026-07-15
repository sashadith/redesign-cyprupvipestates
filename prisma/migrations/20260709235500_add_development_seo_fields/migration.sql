-- SEO fundamentals for the new Development pipeline: a stable, sprechender slug
-- (assigned on publish, see src/lib/developmentSeo.ts) and optional per-language
-- title/description overrides that win over the auto-generated defaults.
ALTER TABLE "developments" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "developments_slug_key" ON "developments"("slug");

ALTER TABLE "development_overrides" ADD COLUMN IF NOT EXISTS "seo" JSONB;
