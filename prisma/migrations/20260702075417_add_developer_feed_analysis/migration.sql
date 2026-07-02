-- CreateTable
CREATE TABLE "developer_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "contactInfo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_feed_analyses" (
    "id" TEXT NOT NULL,
    "developerAccountId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceFileName" TEXT,
    "rawXml" TEXT,
    "itemNodePath" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "fields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developer_feed_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "developer_accounts_slug_key" ON "developer_accounts"("slug");

-- CreateIndex
CREATE INDEX "developer_feed_analyses_developerAccountId_idx" ON "developer_feed_analyses"("developerAccountId");

-- AddForeignKey
ALTER TABLE "developer_feed_analyses" ADD CONSTRAINT "developer_feed_analyses_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

