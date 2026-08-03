-- CreateTable
CREATE TABLE "overlap_candidates" (
    "id" TEXT NOT NULL,
    "legacyProjectId" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "note" TEXT,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overlap_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "overlap_candidates_legacyProjectId_developmentId_key" ON "overlap_candidates"("legacyProjectId", "developmentId");
