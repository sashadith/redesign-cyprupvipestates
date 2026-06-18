CREATE TABLE "media_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "media_folders_name_key" ON "media_folders"("name");
