-- Partner portal accounts (2026-10-19). Additive only: new enums, new tables, new nullable columns on "leads".
-- Written only by code shipping in the same deploy.
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "PartnerType" AS ENUM ('REAL_ESTATE', 'PRIVATE_BROKER', 'BANK', 'INVESTMENT', 'FAMILY_OFFICE', 'TOURISM', 'DESIGN', 'LEGAL', 'OTHER');
CREATE TYPE "PartnerTokenKind" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');
CREATE TYPE "PartnerMode" AS ENUM ('HANDOVER', 'FIX');
CREATE TYPE "ContactMode" AS ENUM ('DIRECT', 'VIA_PARTNER', 'VIA_PARTNER_REP', 'VIA_CLIENT_REP');
CREATE TYPE "PartnerClaimState" AS ENUM ('ACTIVE', 'IN_REVIEW', 'REJECTED', 'EXPIRED');

CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "type" "PartnerType" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "country" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "language" "Locale" NOT NULL DEFAULT 'en',
    "handoverShare" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "fixShare" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "trustMode" BOOLEAN NOT NULL DEFAULT false,
    "refCode" TEXT,
    "managerUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partners_refCode_key" ON "partners"("refCode");
CREATE INDEX "partners_status_idx" ON "partners"("status");

CREATE TABLE "partner_users" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partner_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_users_email_key" ON "partner_users"("email");

CREATE TABLE "partner_sessions" (
    "id" TEXT NOT NULL,
    "partnerUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "partner_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_sessions_tokenHash_key" ON "partner_sessions"("tokenHash");
CREATE INDEX "partner_sessions_partnerUserId_idx" ON "partner_sessions"("partnerUserId");

CREATE TABLE "partner_tokens" (
    "id" TEXT NOT NULL,
    "partnerUserId" TEXT NOT NULL,
    "kind" "PartnerTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_tokens_tokenHash_key" ON "partner_tokens"("tokenHash");
CREATE INDEX "partner_tokens_partnerUserId_kind_idx" ON "partner_tokens"("partnerUserId", "kind");

CREATE TABLE "partner_agreement_acceptances" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    CONSTRAINT "partner_agreement_acceptances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partner_agreement_acceptances_partnerId_idx" ON "partner_agreement_acceptances"("partnerId");

CREATE TABLE "partner_claims" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "state" "PartnerClaimState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    CONSTRAINT "partner_claims_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partner_claims_leadId_idx" ON "partner_claims"("leadId");
CREATE INDEX "partner_claims_partnerId_state_idx" ON "partner_claims"("partnerId", "state");

ALTER TABLE "leads" ADD COLUMN "partnerId" TEXT;
ALTER TABLE "leads" ADD COLUMN "partnerMode" "PartnerMode";
ALTER TABLE "leads" ADD COLUMN "contactMode" "ContactMode";
ALTER TABLE "leads" ADD COLUMN "contactRepName" TEXT;
ALTER TABLE "leads" ADD COLUMN "contactRepPhone" TEXT;
CREATE INDEX "leads_partnerId_idx" ON "leads"("partnerId");

ALTER TABLE "partners" ADD CONSTRAINT "partners_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_sessions" ADD CONSTRAINT "partner_sessions_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "partner_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_tokens" ADD CONSTRAINT "partner_tokens_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "partner_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_agreement_acceptances" ADD CONSTRAINT "partner_agreement_acceptances_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_claims" ADD CONSTRAINT "partner_claims_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_claims" ADD CONSTRAINT "partner_claims_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
