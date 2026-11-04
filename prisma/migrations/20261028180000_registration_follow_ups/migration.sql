-- CreateTable
CREATE TABLE "registration_follow_ups" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "developerAccountId" TEXT NOT NULL,
    "skippedAt" TIMESTAMP(3),
    "skippedById" TEXT,
    "skipReason" TEXT,
    "lastRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_follow_ups_leadId_developerAccountId_key" ON "registration_follow_ups"("leadId", "developerAccountId");

-- AddForeignKey
ALTER TABLE "registration_follow_ups" ADD CONSTRAINT "registration_follow_ups_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_follow_ups" ADD CONSTRAINT "registration_follow_ups_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
