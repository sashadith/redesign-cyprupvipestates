-- Partner portal submissions (2026-10-19). Additive only: new columns on "partner_claims", new enum, new tables.
-- Written only by code shipping in the same deploy.
CREATE TYPE "PartnerNotificationKind" AS ENUM ('STAGE', 'MESSAGE', 'CLAIM_OUTCOME');

-- New NOT NULL columns: add with a temporary default so the migration is safe even if rows exist, then drop it.
ALTER TABLE "partner_claims" ADD COLUMN "mode" "PartnerMode" NOT NULL DEFAULT 'HANDOVER';
ALTER TABLE "partner_claims" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "partner_claims" ADD COLUMN "contactMode" "ContactMode" NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "partner_claims" ALTER COLUMN "contactMode" DROP DEFAULT;
ALTER TABLE "partner_claims" ADD COLUMN "submission" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "partner_claims" ALTER COLUMN "submission" DROP DEFAULT;
ALTER TABLE "partner_claims" ADD COLUMN "outcomeNote" TEXT;

-- At most one ACTIVE claim per lead. Partial unique index: exists only in SQL (Prisma cannot declare it);
-- it is noted on the PartnerClaim model in schema.prisma.
CREATE UNIQUE INDEX "partner_claims_one_active_per_lead" ON "partner_claims"("leadId") WHERE "state" = 'ACTIVE';

CREATE TABLE "partner_messages" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partner_messages_leadId_createdAt_idx" ON "partner_messages"("leadId", "createdAt");

CREATE TABLE "partner_notifications" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" "PartnerNotificationKind" NOT NULL,
    "refKey" TEXT NOT NULL,
    "leadId" TEXT,
    "claimId" TEXT,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    CONSTRAINT "partner_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_notifications_refKey_key" ON "partner_notifications"("refKey");
CREATE INDEX "partner_notifications_sentAt_createdAt_idx" ON "partner_notifications"("sentAt", "createdAt");

ALTER TABLE "partner_messages" ADD CONSTRAINT "partner_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_messages" ADD CONSTRAINT "partner_messages_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_messages" ADD CONSTRAINT "partner_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
