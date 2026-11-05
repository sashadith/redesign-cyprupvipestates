-- Price note for the Instagram carousel (render_instagram_carousel), set per project in the admin.
ALTER TABLE "development_overrides" ADD COLUMN "vatNote" TEXT;
ALTER TABLE "development_overrides" ADD CONSTRAINT "development_overrides_vatNote_check" CHECK ("vatNote" IS NULL OR "vatNote" IN ('plus', 'included'));
