-- CreateTable
CREATE TABLE "verified_duplicate_images" (
    "id" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "matchedHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_duplicate_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verified_duplicate_images_sourceHash_key" ON "verified_duplicate_images"("sourceHash");
