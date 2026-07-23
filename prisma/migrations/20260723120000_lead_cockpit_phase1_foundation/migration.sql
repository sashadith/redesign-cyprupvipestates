-- CreateEnum
CREATE TYPE "LeadPreferredChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'PHONE');

-- CreateEnum
CREATE TYPE "LeadInteractionType" AS ENUM ('EMAIL_OUT', 'EMAIL_IN', 'WHATSAPP_OUT', 'WHATSAPP_IN', 'CALL', 'NOTE', 'STATUS_CHANGE', 'PRESENTATION_EVENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LeadInteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "LeadInteractionChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'PHONE', 'SYSTEM');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "preferredChannel" "LeadPreferredChannel";

-- CreateTable
CREATE TABLE "user_email_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPasswordEnc" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapUser" TEXT,
    "imapPasswordEnc" TEXT,
    "signature" JSONB,
    "lastTestSentAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_interactions" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadInteractionType" NOT NULL,
    "direction" "LeadInteractionDirection",
    "channel" "LeadInteractionChannel",
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "metadata" JSONB,
    "legacyActivityId" TEXT,

    CONSTRAINT "lead_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_settings_userId_key" ON "user_email_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_interactions_legacyActivityId_key" ON "lead_interactions"("legacyActivityId");

-- CreateIndex
CREATE INDEX "lead_interactions_leadId_idx" ON "lead_interactions"("leadId");

-- CreateIndex
CREATE INDEX "lead_interactions_leadId_occurredAt_idx" ON "lead_interactions"("leadId", "occurredAt");

-- AddForeignKey
ALTER TABLE "user_email_settings" ADD CONSTRAINT "user_email_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
