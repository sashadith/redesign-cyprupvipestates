-- CRM v2 foundation (2026-10-18). Additive only: two new tables.
CREATE TYPE "CommissionStatus" AS ENUM ('EXPECTED', 'EARNED', 'DEVELOPER_PAID', 'PAID_OUT', 'CANCELLED');
CREATE TYPE "RateSource" AS ENUM ('PROJECT', 'DEVELOPER', 'MANUAL', 'MISSING');

CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "developmentId" TEXT,
    "unitLabel" TEXT,
    "price" INTEGER NOT NULL,
    "ourRatePercent" DECIMAL(5,2),
    "rateSource" "RateSource" NOT NULL DEFAULT 'MISSING',
    "ourCommission" INTEGER,
    "partnerSharePercent" DECIMAL(5,2),
    "partnerCommission" INTEGER,
    "commissionStatus" "CommissionStatus" NOT NULL DEFAULT 'EXPECTED',
    "expectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earnedAt" TIMESTAMP(3),
    "developerPaidAt" TIMESTAMP(3),
    "paidOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "deals_leadId_idx" ON "deals"("leadId");
CREATE INDEX "deals_commissionStatus_idx" ON "deals"("commissionStatus");
ALTER TABLE "deals" ADD CONSTRAINT "deals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "commission_rates" (
    "id" TEXT NOT NULL,
    "developerAccountId" TEXT NOT NULL,
    "developmentId" TEXT,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commission_rates_developmentId_key" ON "commission_rates"("developmentId");
CREATE INDEX "commission_rates_developerAccountId_idx" ON "commission_rates"("developerAccountId");
-- At most one developer-wide default per account (developmentId IS NULL).
CREATE UNIQUE INDEX "commission_rates_one_default_per_account" ON "commission_rates"("developerAccountId") WHERE "developmentId" IS NULL;
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
