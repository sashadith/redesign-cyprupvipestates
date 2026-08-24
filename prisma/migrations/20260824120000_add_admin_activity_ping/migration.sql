-- Working-hours activity tracking: one row per throttled admin-panel
-- heartbeat, clustered into sessions at report time. Additive only.

-- CreateTable
CREATE TABLE "admin_activity_pings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_pings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_activity_pings_userId_pingAt_idx" ON "admin_activity_pings"("userId", "pingAt");

-- AddForeignKey
ALTER TABLE "admin_activity_pings" ADD CONSTRAINT "admin_activity_pings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
