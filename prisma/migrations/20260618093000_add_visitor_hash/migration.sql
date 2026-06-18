-- Cookieless unique-visitor hash for self-hosted analytics
ALTER TABLE "page_views" ADD COLUMN "visitorHash" TEXT;
CREATE INDEX "page_views_visitorHash_idx" ON "page_views"("visitorHash");
