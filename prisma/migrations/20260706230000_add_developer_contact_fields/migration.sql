-- Structured contact fields for DeveloperAccount (Ansprechpartner, phone, email, developer-cloud link).
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT;
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "developer_accounts" ADD COLUMN IF NOT EXISTS "developerCloudUrl" TEXT;
