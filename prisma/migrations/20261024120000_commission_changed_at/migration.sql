-- 2026-10-24 — when a developer account's commission rates last changed, so the
-- Xellex bridge can re-deliver its projects with the new rate. Additive only.
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "commissionChangedAt" TIMESTAMP(3);
