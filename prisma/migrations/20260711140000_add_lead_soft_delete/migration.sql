-- Soft-delete support for leads (trash bin, 90-day auto-purge).
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
CREATE INDEX IF NOT EXISTS "leads_deletedAt_idx" ON "leads"("deletedAt");
