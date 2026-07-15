-- Drive availability-sync state on DeveloperAccount.
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "driveFileModified" TEXT;
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "driveSyncedAt" TIMESTAMP(3);
