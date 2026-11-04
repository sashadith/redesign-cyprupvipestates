-- Hard bounce on the lead's current email address.
ALTER TABLE "leads" ADD COLUMN "emailInvalidAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "emailInvalidReason" TEXT;
