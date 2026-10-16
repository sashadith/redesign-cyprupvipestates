-- One monthly manual-sync round, first Monday of the month (2026-10-16,
-- operator: "alle an einem Tag im Monat synchronisieren", reminded by ONE Action
-- Center item). Additive: two new columns on developer_accounts.
--   monthlyManualSync — the account is part of the round;
--   manualSyncedAt    — when its monthly sync was last marked done. Separate from
--                       driveSyncedAt on purpose: Korantina and Motive Point also
--                       sync automatically every week, which stamps driveSyncedAt
--                       and would make their manual part look done forever.
ALTER TABLE "developer_accounts" ADD COLUMN "monthlyManualSync" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "developer_accounts" ADD COLUMN "manualSyncedAt" TIMESTAMP(3);

-- The ten hand-maintained accounts (2026-10-16 list). October counts as done;
-- the first round is Monday 2 November 2026.
UPDATE "developer_accounts"
   SET "monthlyManualSync" = true, "manualSyncedAt" = CURRENT_TIMESTAMP
 WHERE "slug" IN ('agg', 'platon', 'prospecta', 'quality-home', 'reiwa', 'sol-properties', 'square-one', 'luma', 'motive-point', 'korantina-homes');
