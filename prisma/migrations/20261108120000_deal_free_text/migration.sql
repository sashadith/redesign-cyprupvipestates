-- Manual deals (2026-11-08): developer and project from our lists or typed in. Additive.
ALTER TABLE "deals" ADD COLUMN "developerAccountId" TEXT;
ALTER TABLE "deals" ADD COLUMN "developerName" TEXT;
ALTER TABLE "deals" ADD COLUMN "projectName" TEXT;

CREATE INDEX "deals_developerAccountId_idx" ON "deals"("developerAccountId");

ALTER TABLE "deals" ADD CONSTRAINT "deals_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
