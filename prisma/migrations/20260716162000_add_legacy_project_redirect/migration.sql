-- CreateTable
CREATE TABLE "legacy_project_redirects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legacy_project_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legacy_project_redirects_projectId_key" ON "legacy_project_redirects"("projectId");

-- AddForeignKey
ALTER TABLE "legacy_project_redirects" ADD CONSTRAINT "legacy_project_redirects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
