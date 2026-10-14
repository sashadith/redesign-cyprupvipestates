-- UTM per page view (2026-10-14). Purely additive: three nullable columns on
-- page_views, no default, so Postgres only touches the catalogue — the table
-- is not rewritten. Only utm_source / utm_medium / utm_campaign are ever
-- stored (src/lib/analytics/pageViewUtm.ts); every other query parameter is
-- dropped at ingestion as before. Rows written before this migration stay NULL
-- and keep being attributed by referrer.
ALTER TABLE "page_views" ADD COLUMN "utmSource" VARCHAR(100);
ALTER TABLE "page_views" ADD COLUMN "utmMedium" VARCHAR(100);
ALTER TABLE "page_views" ADD COLUMN "utmCampaign" VARCHAR(100);
