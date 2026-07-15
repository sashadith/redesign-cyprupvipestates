ALTER TABLE "client_presentation_items" ADD COLUMN IF NOT EXISTS "aliasName" TEXT;
ALTER TABLE "client_presentation_items" ADD COLUMN IF NOT EXISTS "isNew" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "client_presentation_items" ADD COLUMN IF NOT EXISTS "newAddedAt" TIMESTAMP(3);
