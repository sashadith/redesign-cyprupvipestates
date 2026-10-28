-- Developer registration to a WhatsApp group (2026-10-28). Additive only: 2 nullable columns.
ALTER TABLE "developer_accounts" ADD COLUMN "registrationWhatsAppGroupId" TEXT,
ADD COLUMN "registrationWhatsAppGroupName" TEXT;
