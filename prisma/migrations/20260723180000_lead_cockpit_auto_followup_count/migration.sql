-- Lead Cockpit correction batch: auto-follow-up cadence counter.
-- Pure additive ALTER TABLE ADD COLUMN — no drops, no renames, no type
-- changes. Existing production code paths are unaffected until the new
-- cadence logic (src/lib/crm/followUpCadence.ts) starts writing to it.
ALTER TABLE "leads" ADD COLUMN     "autoFollowUpCount" INTEGER NOT NULL DEFAULT 0;
