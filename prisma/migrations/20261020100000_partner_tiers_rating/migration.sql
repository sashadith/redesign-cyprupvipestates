-- Partner portal Phase 4b (2026-10-20). Additive only: new enum value, new tables, new nullable columns on "partners".
-- Written only by code shipping in the same deploy. ADD VALUE stays first and the value is not used in this file.
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'TIER_UP';

CREATE TABLE "partner_tiers" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "minClosedDeals" INTEGER NOT NULL,
    "handoverShare" DECIMAL(5,2) NOT NULL,
    "fixShare" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_tiers_pkey" PRIMARY KEY ("key")
);

-- Seed: existing partners keep tierKey NULL (their own shares stay as they are); no backfill here.
INSERT INTO "partner_tiers" ("key","name","sort","minClosedDeals","handoverShare","fixShare","active","updatedAt") VALUES ('silver','Silver',1,0,30,50,true,CURRENT_TIMESTAMP),('gold','Gold',2,3,35,55,true,CURRENT_TIMESTAMP),('platinum','Platinum',3,6,40,60,true,CURRENT_TIMESTAMP);

ALTER TABLE "partners" ADD COLUMN "tierKey" TEXT;
ALTER TABLE "partners" ADD COLUMN "tierSince" TIMESTAMP(3);
ALTER TABLE "partners" ADD COLUMN "newsSeenAt" TIMESTAMP(3);
ALTER TABLE "partners" ADD CONSTRAINT "partners_tierKey_fkey" FOREIGN KEY ("tierKey") REFERENCES "partner_tiers"("key") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "partner_tier_proposals" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "fromTier" TEXT,
    "toTier" TEXT NOT NULL,
    "closedDeals" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decision" TEXT,

    CONSTRAINT "partner_tier_proposals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "partner_tier_proposals_partnerId_idx" ON "partner_tier_proposals"("partnerId");
-- At most one open (undecided) proposal per partner; Prisma cannot express a partial index.
CREATE UNIQUE INDEX "partner_tier_proposals_one_open_per_partner" ON "partner_tier_proposals"("partnerId") WHERE "decidedAt" IS NULL;
ALTER TABLE "partner_tier_proposals" ADD CONSTRAINT "partner_tier_proposals_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "rating_seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "pointRules" JSONB NOT NULL,
    "prizes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_seasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partner_point_events" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refKey" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_point_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_point_events_refKey_key" ON "partner_point_events"("refKey");
CREATE INDEX "partner_point_events_seasonId_partnerId_idx" ON "partner_point_events"("seasonId", "partnerId");
ALTER TABLE "partner_point_events" ADD CONSTRAINT "partner_point_events_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "rating_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_point_events" ADD CONSTRAINT "partner_point_events_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
