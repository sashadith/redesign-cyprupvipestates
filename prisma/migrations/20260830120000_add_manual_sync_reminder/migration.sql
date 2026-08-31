-- Manual-sync reminder cadence (days). NULL = no reminder. See DeveloperAccount
-- in schema.prisma and the manualSyncDue() rule in
-- src/lib/actionCenter/rules/developers.ts. Additive, nullable — no backfill.
ALTER TABLE "developer_accounts" ADD COLUMN "manualSyncReminderDays" INTEGER;
