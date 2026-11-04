-- CRM v2 foundation (2026-10-18). Additive only.
ALTER TABLE "users" ADD COLUMN "canSeeColleagues" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "canEditColleagues" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "acceptsLeads" BOOLEAN NOT NULL DEFAULT true;

-- Everyone who exists today sees and edits every lead; keep it that way.
UPDATE "users" SET "canSeeColleagues" = true, "canEditColleagues" = true;
