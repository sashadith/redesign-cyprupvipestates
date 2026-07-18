-- CreateTable
CREATE TABLE "cwv_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "url" TEXT NOT NULL,
    "lcp" DOUBLE PRECISION NOT NULL,
    "cls" DOUBLE PRECISION NOT NULL,
    "inp" DOUBLE PRECISION,
    "perfScore" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cwv_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_runs" (
    "id" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "telegramSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cwv_metrics_url_date_idx" ON "cwv_metrics"("url", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cwv_metrics_date_url_key" ON "cwv_metrics"("date", "url");

-- CreateIndex
CREATE INDEX "advisor_runs_runDate_idx" ON "advisor_runs"("runDate");
