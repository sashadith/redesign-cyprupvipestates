-- Developer client registration (2026-10-27). Additive only: 2 enums, 4 columns, 2 tables.
-- Spec: docs/superpowers/specs/2026-10-27-developer-registration-design.md §6
-- CreateEnum
CREATE TYPE "RegistrationChannel" AS ENUM ('NONE', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DeveloperRegistrationStatus" AS ENUM ('SENT', 'PRELIMINARY', 'FIXED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "developer_accounts" ADD COLUMN     "registrationChannel" "RegistrationChannel" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "registrationEmailCc" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "registrationEmailTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "registrationWhatsApp" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "developer_registrations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "developerAccountId" TEXT NOT NULL,
    "developmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channel" "RegistrationChannel" NOT NULL,
    "status" "DeveloperRegistrationStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "sendError" TEXT,
    "outboundInteractionId" TEXT,
    "preliminaryAt" TIMESTAMP(3),
    "preliminarySource" TEXT,
    "preliminaryById" TEXT,
    "fixedAt" TIMESTAMP(3),
    "fixedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_mailbox_state" (
    "id" TEXT NOT NULL,
    "lastUid" BIGINT,
    "uidValidity" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_mailbox_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "developer_registrations_status_sentAt_idx" ON "developer_registrations"("status", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "developer_registrations_leadId_developerAccountId_key" ON "developer_registrations"("leadId", "developerAccountId");

-- AddForeignKey
ALTER TABLE "developer_registrations" ADD CONSTRAINT "developer_registrations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_registrations" ADD CONSTRAINT "developer_registrations_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

