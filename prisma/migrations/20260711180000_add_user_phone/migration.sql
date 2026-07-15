-- Advisor's own contact number, shown large/clickable in the Client
-- Presentation closing section redesign.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
