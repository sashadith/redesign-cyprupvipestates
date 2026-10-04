-- MCP connector Phase 3 (2026-09-08): nightly catalogue snapshots for crm_inventory_changes.
-- Purely additive — one new table, two indexes, no relation. Applying it before the code deploys
-- cannot break the running app (old code never reads this table).

-- CreateTable
CREATE TABLE "development_snapshots" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishStatus" TEXT NOT NULL,
    "priceFrom" INTEGER,
    "priceTo" INTEGER,
    "unitsTotal" INTEGER NOT NULL,
    "unitsAvailable" INTEGER NOT NULL,
    "units" JSONB NOT NULL,

    CONSTRAINT "development_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "development_snapshots_developmentId_capturedAt_idx" ON "development_snapshots"("developmentId", "capturedAt");

-- CreateIndex
CREATE INDEX "development_snapshots_capturedAt_idx" ON "development_snapshots"("capturedAt");
