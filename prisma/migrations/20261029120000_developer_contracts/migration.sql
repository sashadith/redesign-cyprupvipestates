-- CreateTable
CREATE TABLE "developer_contracts" (
    "id" TEXT NOT NULL,
    "developerAccountId" TEXT NOT NULL,
    "signedAt" DATE NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "commissionPercent" DECIMAL(5,2),
    "note" TEXT,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "reminder14SentAt" TIMESTAMP(3),
    "reminder1SentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "developer_contracts_developerAccountId_idx" ON "developer_contracts"("developerAccountId");

-- AddForeignKey
ALTER TABLE "developer_contracts" ADD CONSTRAINT "developer_contracts_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
