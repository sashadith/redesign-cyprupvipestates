ALTER TABLE "media" ADD COLUMN "folder" TEXT;
CREATE INDEX "media_folder_idx" ON "media"("folder");
