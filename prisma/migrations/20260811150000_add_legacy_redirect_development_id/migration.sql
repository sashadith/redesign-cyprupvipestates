-- AlterTable
ALTER TABLE "legacy_project_redirects" ADD COLUMN     "developmentId" TEXT;

-- CreateIndex
CREATE INDEX "legacy_project_redirects_developmentId_idx" ON "legacy_project_redirects"("developmentId");

-- AddForeignKey
ALTER TABLE "legacy_project_redirects" ADD CONSTRAINT "legacy_project_redirects_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

