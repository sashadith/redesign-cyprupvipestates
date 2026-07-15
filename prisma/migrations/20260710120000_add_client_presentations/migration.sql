-- Client Presentation system: token-protected property selection pages
-- generated from a CRM lead + curated Development matches.
CREATE TABLE IF NOT EXISTS "client_presentations" (
    "id"           TEXT NOT NULL,
    "leadId"       TEXT NOT NULL,
    "token"        TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'active',
    "locale"       "Locale" NOT NULL DEFAULT 'en',
    "greetingName" TEXT NOT NULL,
    "personalNote" TEXT,
    "advisorId"    TEXT,
    "expiresAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_presentations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_presentations_token_key" ON "client_presentations"("token");
CREATE INDEX IF NOT EXISTS "client_presentations_leadId_idx" ON "client_presentations"("leadId");

CREATE TABLE IF NOT EXISTS "client_presentation_items" (
    "id"             TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "developmentId"  TEXT NOT NULL,
    "unitIds"        JSONB,
    "sortIndex"      INTEGER NOT NULL DEFAULT 0,
    "advisorComment" TEXT,
    "isFavorited"    BOOLEAN NOT NULL DEFAULT false,
    "favoritedAt"    TIMESTAMP(3),

    CONSTRAINT "client_presentation_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_presentation_items_presentationId_developmentId_key" ON "client_presentation_items"("presentationId", "developmentId");

CREATE TABLE IF NOT EXISTS "presentation_views" (
    "id"             TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "sessionHash"    TEXT NOT NULL,
    "developmentId"  TEXT,
    "durationSec"    INTEGER,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentation_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "presentation_views_presentationId_idx" ON "presentation_views"("presentationId");
CREATE INDEX IF NOT EXISTS "presentation_views_createdAt_idx" ON "presentation_views"("createdAt");

DO $$ BEGIN
    ALTER TABLE "client_presentations" ADD CONSTRAINT "client_presentations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "client_presentations" ADD CONSTRAINT "client_presentations_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "client_presentation_items" ADD CONSTRAINT "client_presentation_items_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "client_presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "client_presentation_items" ADD CONSTRAINT "client_presentation_items_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "presentation_views" ADD CONSTRAINT "presentation_views_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "client_presentations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
