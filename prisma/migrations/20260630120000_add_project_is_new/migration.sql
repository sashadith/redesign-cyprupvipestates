-- Manual "New" badge flag for projects (replaces the createdAt-based heuristic).
-- Additive, non-destructive: existing rows default to false so nothing becomes "New".
ALTER TABLE "projects" ADD COLUMN "isNew" BOOLEAN NOT NULL DEFAULT false;
