-- Additive only: one new table, no existing row touched, no column changed.
-- Applied exclusively via the deploy path (CVP_RUN_MIGRATE=1), never from a
-- dev machine — .env.local points at production.
CREATE TABLE "page_events" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "locale" TEXT,
    "type" TEXT NOT NULL,
    "contentId" TEXT,
    "visitorHash" TEXT,
    "deviceType" TEXT,
    "country" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isPrefetch" BOOLEAN NOT NULL DEFAULT false,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_events_type_createdAt_idx" ON "page_events"("type", "createdAt");
CREATE INDEX "page_events_path_idx" ON "page_events"("path");
CREATE INDEX "page_events_contentId_idx" ON "page_events"("contentId");
