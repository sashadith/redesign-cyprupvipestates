-- Meta Lead Ads (2026-10-11, docs/META-LEADGEN.md). Purely additive: one new
-- LeadSource value, one new enum, one new table. No existing column touched.
-- The new enum value is only ever WRITTEN by code that ships together with
-- this migration, so no row carries it before a client that knows it is live.
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'META_LEAD_AD';

CREATE TYPE "MetaLeadgenStatus" AS ENUM ('PROCESSING', 'DONE', 'FAILED');

CREATE TABLE "meta_leadgen_events" (
    "id" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "status" "MetaLeadgenStatus" NOT NULL,
    "outcome" TEXT,
    "leadId" TEXT,
    "formId" TEXT,
    "formName" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "alertedAt" TIMESTAMP(3),
    "notification" TEXT,
    "telegramSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meta_leadgen_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_leadgen_events_leadgenId_key" ON "meta_leadgen_events"("leadgenId");
CREATE INDEX "meta_leadgen_events_status_idx" ON "meta_leadgen_events"("status");
CREATE INDEX "meta_leadgen_events_leadId_idx" ON "meta_leadgen_events"("leadId");

ALTER TABLE "meta_leadgen_events" ADD CONSTRAINT "meta_leadgen_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
