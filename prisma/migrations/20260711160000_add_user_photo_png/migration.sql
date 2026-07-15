-- Transparent-background cutout photo for advisors, used free-floating in the
-- Client Presentation closing section (distinct from the small square avatar).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photoPng" TEXT;
