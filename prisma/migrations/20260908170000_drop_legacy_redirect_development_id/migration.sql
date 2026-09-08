-- Removes legacy_project_redirects.developmentId again.
--
-- It was added on 2026-08-11 from a branch that was never merged (see
-- 20260811150000_add_legacy_redirect_development_id, whose file had to be
-- recovered in c270623). The idea was sound — resolving a redirect target
-- through a foreign key so a Development rename cannot orphan it — but the
-- code half never landed, so nothing has ever written or read the column.
--
-- Verified immediately before writing this migration: 730 rows, 0 of them
-- with a non-null developmentId. Nothing is lost. schema.prisma never knew
-- about the column, so after this the database and the schema agree again.
--
-- If the idea is revived later, this is a fresh AddColumn, not a revert.

-- DropForeignKey
ALTER TABLE "legacy_project_redirects" DROP CONSTRAINT IF EXISTS "legacy_project_redirects_developmentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "legacy_project_redirects_developmentId_idx";

-- AlterTable
ALTER TABLE "legacy_project_redirects" DROP COLUMN IF EXISTS "developmentId";
