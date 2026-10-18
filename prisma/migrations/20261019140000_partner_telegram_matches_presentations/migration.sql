-- Partner portal Phase 3e (2026-10-19). Additive only: new enum values, new enum, new columns on "partners" and "client_presentations", new table.
-- Written only by code shipping in the same deploy. ADD VALUE stays first and the values are not used in this file.
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'MATCH';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'PRESENTATION_OPENED';

CREATE TYPE "PartnerNotifyChannel" AS ENUM ('EMAIL', 'TELEGRAM', 'BOTH');

-- New NOT NULL column: the default is permanent (matches the Prisma @default), existing rows become EMAIL.
ALTER TABLE "partners" ADD COLUMN "notifyChannel" "PartnerNotifyChannel" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "partners" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "partners" ADD COLUMN "telegramLinkedAt" TIMESTAMP(3);
ALTER TABLE "partners" ADD COLUMN "brandName" TEXT;
ALTER TABLE "partners" ADD COLUMN "brandPhone" TEXT;
ALTER TABLE "partners" ADD COLUMN "brandEmail" TEXT;
ALTER TABLE "partners" ADD COLUMN "brandWebsite" TEXT;
ALTER TABLE "partners" ADD COLUMN "brandLogo" BYTEA;
ALTER TABLE "partners" ADD COLUMN "brandLogoType" TEXT;
ALTER TABLE "partners" ADD COLUMN "brandLogoUpdatedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "partners_telegramChatId_key" ON "partners"("telegramChatId");

ALTER TABLE "client_presentations" ADD COLUMN "partnerId" TEXT;
CREATE INDEX "client_presentations_partnerId_idx" ON "client_presentations"("partnerId");
ALTER TABLE "client_presentations" ADD CONSTRAINT "client_presentations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "partner_telegram_codes" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_telegram_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_telegram_codes_codeHash_key" ON "partner_telegram_codes"("codeHash");
CREATE INDEX "partner_telegram_codes_partnerId_idx" ON "partner_telegram_codes"("partnerId");

ALTER TABLE "partner_telegram_codes" ADD CONSTRAINT "partner_telegram_codes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
