-- CreateTable
CREATE TABLE "developments" (
    "id" TEXT NOT NULL,
    "developerAccountId" TEXT NOT NULL,
    "dev" TEXT NOT NULL,
    "feedProjectId" TEXT NOT NULL,
    "feedKey" TEXT NOT NULL,
    "developerName" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "developer" TEXT,
    "category" TEXT,
    "status" TEXT,
    "stage" TEXT,
    "completion" TEXT,
    "energy" TEXT,
    "district" TEXT,
    "town" TEXT,
    "area" TEXT,
    "priceFrom" INTEGER,
    "priceTo" INTEGER,
    "currency" TEXT DEFAULT 'EUR',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "unitsTotal" INTEGER NOT NULL DEFAULT 0,
    "unitsAvailable" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "amenities" JSONB,
    "gallery" JSONB,
    "plans" JSONB,
    "extraFacts" JSONB,
    "syncedAt" TIMESTAMP(3),
    "publishStatus" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_units" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "ref" TEXT,
    "name" TEXT,
    "label" TEXT,
    "type" TEXT,
    "status" TEXT DEFAULT 'available',
    "price" INTEGER,
    "currency" TEXT DEFAULT 'EUR',
    "beds" TEXT,
    "baths" TEXT,
    "areaBuilt" TEXT,
    "areaPlot" TEXT,
    "areaVeranda" TEXT,
    "floor" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "attrs" JSONB,
    "photos" JSONB,
    "plans" JSONB,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_overrides" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "alias" TEXT,
    "district" TEXT,
    "town" TEXT,
    "area" TEXT,
    "mainImage" TEXT,
    "heroVideo" TEXT,
    "descriptionEN" TEXT,
    "descriptionDE" TEXT,
    "descriptionPL" TEXT,
    "descriptionRU" TEXT,
    "amenities" JSONB,
    "vatApplies" BOOLEAN,
    "completion" TEXT,
    "energy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_descriptions" (
    "id" TEXT NOT NULL,
    "areaSlug" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "district" TEXT,
    "textEN" TEXT,
    "textDE" TEXT,
    "textPL" TEXT,
    "textRU" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "developments_feedKey_key" ON "developments"("feedKey");

-- CreateIndex
CREATE INDEX "developments_developerAccountId_idx" ON "developments"("developerAccountId");

-- CreateIndex
CREATE INDEX "developments_publishStatus_idx" ON "developments"("publishStatus");

-- CreateIndex
CREATE INDEX "developments_district_area_idx" ON "developments"("district", "area");

-- CreateIndex
CREATE INDEX "development_units_developmentId_idx" ON "development_units"("developmentId");

-- CreateIndex
CREATE UNIQUE INDEX "development_overrides_developmentId_key" ON "development_overrides"("developmentId");

-- CreateIndex
CREATE UNIQUE INDEX "area_descriptions_areaSlug_key" ON "area_descriptions"("areaSlug");

-- AddForeignKey
ALTER TABLE "developments" ADD CONSTRAINT "developments_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_units" ADD CONSTRAINT "development_units_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_overrides" ADD CONSTRAINT "development_overrides_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

