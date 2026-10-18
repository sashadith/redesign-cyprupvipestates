-- Partner portal payouts (2026-10-19). Additive only: new columns on "partners", new enum value, new enum, new tables.
-- Written only by code shipping in the same deploy. ADD VALUE stays first and the value is not used in this file.
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'PAYOUT';

CREATE TYPE "PartnerVatMode" AS ENUM ('NONE', 'CY_VAT', 'REVERSE_CHARGE');

ALTER TABLE "partners" ADD COLUMN "bankDetailsEnc" TEXT;
ALTER TABLE "partners" ADD COLUMN "ibanLast4" TEXT;
ALTER TABLE "partners" ADD COLUMN "bankDetailsUpdatedAt" TIMESTAMP(3);
ALTER TABLE "partners" ADD COLUMN "ibanChangedAt" TIMESTAMP(3);
-- New NOT NULL column: the default is permanent (matches the Prisma @default), existing rows become NONE.
ALTER TABLE "partners" ADD COLUMN "vatMode" "PartnerVatMode" NOT NULL DEFAULT 'NONE';

CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "partnerId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "vatMode" "PartnerVatMode" NOT NULL,
    "vatRate" DECIMAL(5,2),
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "pdf" BYTEA NOT NULL,
    "pdfSha256" TEXT NOT NULL,
    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "credit_notes_number_key" ON "credit_notes"("number");
CREATE UNIQUE INDEX "credit_notes_dealId_key" ON "credit_notes"("dealId");
CREATE UNIQUE INDEX "credit_notes_year_seq_key" ON "credit_notes"("year", "seq");
CREATE INDEX "credit_notes_partnerId_idx" ON "credit_notes"("partnerId");

CREATE TABLE "credit_note_counters" (
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "credit_note_counters_pkey" PRIMARY KEY ("year")
);

ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
