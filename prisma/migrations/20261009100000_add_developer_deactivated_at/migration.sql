-- Deactivatable public developer pages (2026-10-09). Purely additive — one
-- nullable column, no default, nothing existing touched; applying it before
-- the code deploys cannot break the running app (old code never reads it).
ALTER TABLE "developers" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
