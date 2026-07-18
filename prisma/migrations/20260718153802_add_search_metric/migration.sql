-- CreateTable
CREATE TABLE "search_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "query" TEXT,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_metrics_page_locale_date_idx" ON "search_metrics"("page", "locale", "date");

-- CreateIndex
CREATE INDEX "search_metrics_date_idx" ON "search_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "search_metrics_date_page_locale_query_key" ON "search_metrics"("date", "page", "locale", "query");
