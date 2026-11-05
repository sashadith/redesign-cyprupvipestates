-- Partner handover requests: a partner asks the office to take over a FIX lead they work themselves.
CREATE TYPE "HandoverState" AS ENUM ('OPEN', 'ACCEPTED', 'WITHDRAWN');

CREATE TABLE "partner_handover_requests" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "partnerUserId" TEXT,
    "state" "HandoverState" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "stageAtRequest" "LeadStatus" NOT NULL,
    "downgrade" BOOLEAN NOT NULL,
    "keepFix" BOOLEAN NOT NULL DEFAULT false,
    "keepFixById" TEXT,
    "keepFixAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_handover_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partner_handover_requests_leadId_idx" ON "partner_handover_requests"("leadId");
CREATE INDEX "partner_handover_requests_partnerId_state_idx" ON "partner_handover_requests"("partnerId", "state");
CREATE INDEX "partner_handover_requests_state_createdAt_idx" ON "partner_handover_requests"("state", "createdAt");

-- One OPEN request per lead. Prisma cannot express a partial unique index.
CREATE UNIQUE INDEX "partner_handover_requests_one_open_per_lead" ON "partner_handover_requests"("leadId") WHERE "state" = 'OPEN';

ALTER TABLE "partner_handover_requests" ADD CONSTRAINT "partner_handover_requests_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_handover_requests" ADD CONSTRAINT "partner_handover_requests_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "partner_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_handover_requests" ADD CONSTRAINT "partner_handover_requests_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_handover_requests" ADD CONSTRAINT "partner_handover_requests_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "partner_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partner_handover_requests" ADD CONSTRAINT "partner_handover_requests_keepFixById_fkey" FOREIGN KEY ("keepFixById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partner_handover_requests" ADD CONSTRAINT "partner_handover_requests_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
