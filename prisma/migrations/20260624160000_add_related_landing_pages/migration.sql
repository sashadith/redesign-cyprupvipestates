-- Curated contextual links between same-language landing pages (Phase 2).
-- Shape: [{ _key, _ref (target sanityId), _type: "singlepageRef" }]
ALTER TABLE "singlepages" ADD COLUMN "relatedLandingPages" JSONB;
