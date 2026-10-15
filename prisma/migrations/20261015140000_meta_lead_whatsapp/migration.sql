-- Meta lead WhatsApp notification (2026-10-15). Purely additive: one nullable
-- column, the WhatsApp counterpart of "telegramSentAt"/"emailSentAt".
ALTER TABLE "meta_leadgen_events" ADD COLUMN "whatsappSentAt" TIMESTAMP(3);

-- Leads imported before this release are not announced to the group after the
-- fact.
UPDATE "meta_leadgen_events" SET "whatsappSentAt" = "updatedAt" WHERE "status" = 'DONE';
