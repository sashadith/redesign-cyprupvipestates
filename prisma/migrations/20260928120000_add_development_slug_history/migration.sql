-- Development slug rename protection (2026-09-28): captures every slug a
-- Development has ever had so a manual admin rename (saveOverride's "Manual
-- slug edit", admin/(panel)/developments/[id]/actions.ts) doesn't turn the
-- old public URL into a 404 — see resolveDevelopmentSlugHistory in
-- src/lib/developmentRender.ts. Purely additive — one new table, no existing
-- table touched, applying it before the code deploys cannot break the
-- running app (old code never reads this table).

-- CreateTable
CREATE TABLE "development_slug_history" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "development_slug_history_slug_key" ON "development_slug_history"("slug");

-- CreateIndex
CREATE INDEX "development_slug_history_developmentId_idx" ON "development_slug_history"("developmentId");

-- AddForeignKey
ALTER TABLE "development_slug_history" ADD CONSTRAINT "development_slug_history_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
