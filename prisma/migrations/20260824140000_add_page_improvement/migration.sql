-- Additive only. Applied exclusively via the deploy path (CVP_RUN_MIGRATE=1).
CREATE TABLE "page_improvements" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetTable" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposal" JSONB NOT NULL,
    "currentSeo" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "appliedBy" TEXT,

    CONSTRAINT "page_improvements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_improvements_pageKey_status_idx" ON "page_improvements"("pageKey", "status");

CREATE INDEX "page_improvements_status_appliedAt_idx" ON "page_improvements"("status", "appliedAt");
