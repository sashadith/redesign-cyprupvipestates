-- Partner-worked FIX leads: the partner runs these clients themselves in the portal pipeline.
ALTER TABLE "leads" ADD COLUMN "workedByPartner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lead_interactions" ADD COLUMN "createdByPartnerUserId" TEXT;
ALTER TABLE "deals" ADD COLUMN "createdByPartnerUserId" TEXT;
ALTER TYPE "PartnerNotificationKind" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_DUE';
CREATE INDEX "leads_partnerId_workedByPartner_idx" ON "leads"("partnerId", "workedByPartner");
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_createdByPartnerUserId_fkey" FOREIGN KEY ("createdByPartnerUserId") REFERENCES "partner_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_createdByPartnerUserId_fkey" FOREIGN KEY ("createdByPartnerUserId") REFERENCES "partner_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
