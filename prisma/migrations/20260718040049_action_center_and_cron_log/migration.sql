-- CreateTable
CREATE TABLE "cron_run_logs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT,
    "durationMs" INTEGER,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_center_snoozes" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_center_snoozes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cron_run_logs_job_ranAt_idx" ON "cron_run_logs"("job", "ranAt");

-- CreateIndex
CREATE INDEX "action_center_snoozes_itemId_idx" ON "action_center_snoozes"("itemId");
