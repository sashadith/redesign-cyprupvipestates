-- Partner engagement (2026-10-19). Additive only: two Partner preference columns, one new table.
-- Written only by code shipping in the same deploy.
ALTER TABLE "partners" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "partners" ADD COLUMN "digestOptIn" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "partner_digest_logs" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_digest_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_digest_logs_partnerId_weekKey_key" ON "partner_digest_logs"("partnerId", "weekKey");

ALTER TABLE "partner_digest_logs" ADD CONSTRAINT "partner_digest_logs_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Decision 10: VAT number at registration; vatMode derived automatically unless set manually.
ALTER TABLE "partners" ADD COLUMN "vatId" TEXT;
ALTER TABLE "partners" ADD COLUMN "vatModeManual" BOOLEAN NOT NULL DEFAULT false;
-- Every non-NONE mode stored before this deploy was picked by the office by hand: keep it pinned so a later
-- VAT-number change does not re-derive it.
UPDATE "partners" SET "vatModeManual" = true WHERE "vatMode" <> 'NONE';
