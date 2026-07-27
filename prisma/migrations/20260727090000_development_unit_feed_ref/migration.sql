-- Two-field reference split (2026-07-27): "ref" stays the freely-editable
-- display/"online" reference; "feedRef" is new and holds the feed's own
-- reference code, written only by sync/backfill, never by saveUnits() — the
-- match anchor for the upcoming status-only sync. Purely additive, nullable,
-- no default — no existing row is affected.
ALTER TABLE "development_units" ADD COLUMN     "feedRef" TEXT;
