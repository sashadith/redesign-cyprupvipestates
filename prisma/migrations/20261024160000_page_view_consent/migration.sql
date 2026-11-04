-- Records the cookie-banner decision alongside each page view.
--
-- Nullable with no default on purpose: NULL means "no decision recorded", which
-- covers both every row written before today and a visitor who has not answered
-- the banner yet. A DEFAULT false would have merged those into "declined" and
-- destroyed the only thing this column is for.
ALTER TABLE "page_views" ADD COLUMN "analyticsConsent" BOOLEAN;
