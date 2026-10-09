-- Additive only: two nullable-or-defaulted columns on an existing table, no
-- data rewritten. Applied exclusively via the deploy path
-- (CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh), never from a dev machine —
-- .env.local points at production.
--
-- Column order is alphabetical, not schema order, because that is what
-- `prisma migrate dev` emits for a multi-column ALTER TABLE — see
-- 20260801082214 (schema says soldOutSince then returnedToMarketAt, the
-- migration says the reverse) and 20260706054910 (seven columns, fully
-- re-sorted). Hand-writing it the other way round would leave the table's
-- physical column order disagreeing with every future generated migration.
ALTER TABLE "developer_accounts" ADD COLUMN     "bridgeChangedAt" TIMESTAMP(3),
ADD COLUMN     "bridgeEnabled" BOOLEAN NOT NULL DEFAULT false;
