-- Shared cloud-drive folder link (Google Drive / OneDrive) used as a no-feed source.
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "driveFolderUrl" TEXT;
