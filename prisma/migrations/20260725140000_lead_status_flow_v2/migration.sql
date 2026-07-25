-- Batch B (2026-07-25): Lead status flow rework.
-- NOT purely additive — recreates the LeadStatus enum type (Postgres has no
-- DROP VALUE for enums). Confirmed against the real shared DB before writing
-- this: zero leads hold QUALIFIED or VIEWING_SCHEDULED today (distribution
-- was CONTACTED:73, LOST:74, NEW:3, CLOSED:1), so no data is actually at
-- risk — but the guard below aborts loudly rather than assume that's still
-- true at apply time.

-- Defensive guard: abort BEFORE touching the type if any lead still holds
-- QUALIFIED (the value being removed). The later USING cast would also fail
-- on this, but this gives a clear, specific error instead of a generic
-- Postgres enum-cast error.
DO $$
DECLARE
  qualified_count integer;
BEGIN
  SELECT COUNT(*) INTO qualified_count FROM "leads" WHERE status::text = 'QUALIFIED';
  IF qualified_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % lead(s) still have QUALIFIED status — resolve manually before re-running this migration.', qualified_count;
  END IF;
END $$;

-- Recreate the enum: rename old type out of the way, create the new one
-- (QUALIFIED removed, COMMUNICATING added), cast the column across, drop the
-- old type. VIEWING_SCHEDULED/OFFER/CLOSED/LOST/NEW/CONTACTED values are
-- unchanged so every one of those leads keeps its exact status through the cast.
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'COMMUNICATING', 'VIEWING_SCHEDULED', 'OFFER', 'CLOSED', 'LOST');

ALTER TABLE "leads" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "status" TYPE "LeadStatus" USING (status::text::"LeadStatus");
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'NEW';

DROP TYPE "LeadStatus_old";
