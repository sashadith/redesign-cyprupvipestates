-- Partner attribution (2026-09-28): the `?ref=` parameter a partner link may
-- carry, stored first-touch on the lead like the utm_* columns
-- (src/lib/attribution.ts). Purely additive — one nullable column, no existing
-- column touched; applying it before the code deploys cannot break the running
-- app (old code never reads it).
ALTER TABLE "leads" ADD COLUMN "attributionRef" TEXT;
