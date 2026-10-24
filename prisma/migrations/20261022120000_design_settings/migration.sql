-- Design settings (2026-10-22). Additive only: three new tables, two nullable columns, one partial unique index.
-- Written only by code shipping in the same deploy.
CREATE TABLE "design_themes" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "offeredToStaff" BOOLEAN NOT NULL DEFAULT true,
    "offeredToPartners" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "design_themes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "design_themes_key_key" ON "design_themes"("key");

-- Exactly one default set. Prisma cannot express a partial unique index, so it lives here only.
CREATE UNIQUE INDEX "design_themes_one_default" ON "design_themes"("isDefault") WHERE "isDefault";

CREATE TABLE "design_theme_versions" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "design_theme_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "design_theme_versions_themeId_createdAt_idx" ON "design_theme_versions"("themeId", "createdAt");

CREATE TABLE "design_settings_versions" (
    "id" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "design_settings_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "design_settings_versions_createdAt_idx" ON "design_settings_versions"("createdAt");

ALTER TABLE "design_theme_versions" ADD CONSTRAINT "design_theme_versions_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "design_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "designThemeId" TEXT;
ALTER TABLE "partners" ADD COLUMN "designThemeId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_designThemeId_fkey" FOREIGN KEY ("designThemeId") REFERENCES "design_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partners" ADD CONSTRAINT "partners_designThemeId_fkey" FOREIGN KEY ("designThemeId") REFERENCES "design_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: five built-in/starter sets with fixed ids. Classic is the default. Values mirror src/lib/design/theme.ts (guarded by a test).
INSERT INTO "design_themes" ("id","key","name","values","offeredToStaff","offeredToPartners","isDefault","sort","updatedAt") VALUES
('ds-classic','classic','Classic','{"page":"#F5F1E8","surface":"#EDE7D9","card":"#FBF9F3","text":"#221C15","muted":"#59534C","accent":"#8E6B3D","accentText":"#7A5A30","accentHover":"#6E512B","gold":"#C29A5E","border":"#E4DCCB","onAccent":"#FFFFFF","field":"#FFFFFF"}'::jsonb,true,true,true,1,CURRENT_TIMESTAMP),
('ds-website','website','Live website','{"page":"#081512","surface":"#0C1E1B","card":"#102826","text":"#EFE9DB","muted":"#AEAEA3","accent":"#C29A5E","accentText":"#C29A5E","accentHover":"#D8B268","gold":"#C29A5E","border":"#2D3732","onAccent":"#081512","field":"#0B1A17"}'::jsonb,true,true,false,2,CURRENT_TIMESTAMP),
('ds-stone',NULL,'Stone grey','{"page":"#F2F3F4","surface":"#E6E8EA","card":"#FAFBFB","text":"#1E2124","muted":"#4F555B","accent":"#2F5D62","accentText":"#2A5357","accentHover":"#23464A","gold":"#A9B4B8","border":"#D9DDE0","onAccent":"#FFFFFF","field":"#FFFFFF"}'::jsonb,true,true,false,3,CURRENT_TIMESTAMP),
('ds-navy',NULL,'Navy','{"page":"#F4F6F9","surface":"#E8ECF2","card":"#FBFCFD","text":"#18202B","muted":"#4D5664","accent":"#1F3A5F","accentText":"#1F3A5F","accentHover":"#172C48","gold":"#B89B5E","border":"#DCE1E8","onAccent":"#FFFFFF","field":"#FFFFFF"}'::jsonb,true,true,false,4,CURRENT_TIMESTAMP),
('ds-anthracite',NULL,'Anthracite gold','{"page":"#16181A","surface":"#1D2023","card":"#23272A","text":"#ECE7DD","muted":"#A9A49A","accent":"#C29A5E","accentText":"#C9A46A","accentHover":"#D8B47A","gold":"#C29A5E","border":"#363A3E","onAccent":"#16181A","field":"#1B1E21"}'::jsonb,true,true,false,5,CURRENT_TIMESTAMP);
