-- AlterTable
ALTER TABLE "projects" ADD COLUMN "supersededByDevelopmentId" TEXT;

-- CreateIndex
CREATE INDEX "projects_supersededByDevelopmentId_idx" ON "projects"("supersededByDevelopmentId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_supersededByDevelopmentId_fkey" FOREIGN KEY ("supersededByDevelopmentId") REFERENCES "developments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
