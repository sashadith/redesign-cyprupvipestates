-- Coarse per-beat module label for the working-hours report ("what was
-- worked on", not just "how long"). Nullable + additive: pre-existing rows
-- and beats from old client bundles simply have no module.

-- AlterTable
ALTER TABLE "admin_activity_pings" ADD COLUMN "module" TEXT;
