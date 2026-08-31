-- Additive only. Applied exclusively via the deploy path (CVP_RUN_MIGRATE=1).
--
-- search_metrics' existing UNIQUE (date, page, locale, query) does not
-- enforce uniqueness for page-level rows (query IS NULL): standard SQL
-- treats every NULL as distinct from every other NULL for a unique
-- constraint, so Postgres has always allowed unlimited page-level rows for
-- the same (date, page, locale). This is a partial unique index covering
-- exactly the case the composite constraint misses.
--
-- Pre-existing duplicates were cleaned up first (see
-- scripts/cleanup-searchmetric-duplicates.mjs, run 2026-08-31: 438 groups /
-- 1,696 rows resolved -- 88 identical-value groups deduplicated, 350
-- diverged-value groups merged by summing impressions/clicks and
-- recomputing the impression-weighted average position). Without that step
-- this CREATE UNIQUE INDEX would fail outright over the existing
-- violations.
CREATE UNIQUE INDEX "search_metrics_page_level_unique"
  ON "search_metrics" ("date", "page", "locale")
  WHERE "query" IS NULL;
