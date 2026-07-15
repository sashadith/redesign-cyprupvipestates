-- unitIds (DevelopmentUnit UUIDs) get orphaned within 24h of a feed re-sync
-- (units are wiped/recreated). unitRefs stores normalized, sync-stable refs
-- instead. Existing rows are backfilled by a one-off script run right after
-- this migration (scripts/backfill-presentation-unit-refs.mjs) while the old
-- UUIDs are still valid.
ALTER TABLE "client_presentation_items" ADD COLUMN IF NOT EXISTS "unitRefs" JSONB;
