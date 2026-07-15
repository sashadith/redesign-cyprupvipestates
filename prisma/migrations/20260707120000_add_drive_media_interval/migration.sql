-- Drive sync interval per developer + per-project image tracking.
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "driveSyncInterval" TEXT DEFAULT 'daily';
ALTER TABLE "developments" ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
ALTER TABLE "developments" ADD COLUMN IF NOT EXISTS "driveImagesModified" TEXT;
