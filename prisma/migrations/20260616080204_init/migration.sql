-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'de', 'pl', 'ru');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'VIEWING_SCHEDULED', 'OFFER', 'CLOSED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CONTACT_FORM', 'PROJECT_ENQUIRY', 'BLOG_ENQUIRY', 'WHATSAPP', 'PHONE', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadTimeline" AS ENUM ('IMMEDIATE', 'THREE_MONTHS', 'SIX_MONTHS', 'ONE_YEAR', 'JUST_LOOKING');

-- CreateEnum
CREATE TYPE "LeadFinancing" AS ENUM ('CASH', 'MORTGAGE', 'UNDECIDED');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "city" TEXT,
    "propertyType" TEXT,
    "price" INTEGER,
    "bedrooms" TEXT,
    "completionDate" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSold" BOOLEAN NOT NULL DEFAULT false,
    "listingPriority" INTEGER NOT NULL DEFAULT 0,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "developerId" TEXT,
    "previewImage" JSONB,
    "images" JSONB,
    "videoId" TEXT,
    "videoPreview" JSONB,
    "description" JSONB,
    "fullDescription" JSONB,
    "faq" JSONB,
    "keyFeatures" JSONB,
    "distances" JSONB,
    "investmentData" JSONB,
    "seo" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blogs" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "authorId" TEXT,
    "categoryId" TEXT,
    "previewImage" JSONB,
    "seo" JSONB,
    "contentBlocks" JSONB,
    "videoBlock" JSONB,
    "popularProperties" JSONB,
    "relatedArticles" JSONB,
    "readingTime" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "singlepages" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "allowIntroBlock" BOOLEAN NOT NULL DEFAULT false,
    "parentSanityId" TEXT,
    "previewImage" JSONB,
    "seo" JSONB,
    "contentBlocks" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "singlepages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_studies" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fullTitle" TEXT,
    "excerpt" TEXT,
    "category" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "previewImage" JSONB,
    "seo" JSONB,
    "clientOverview" JSONB,
    "caseDetails" JSONB,
    "mainContent" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_study_projects" (
    "caseStudyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "case_study_projects_pkey" PRIMARY KEY ("caseStudyId","projectId")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "price" INTEGER,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "type" TEXT,
    "purpose" TEXT,
    "propertyType" TEXT,
    "marketType" TEXT,
    "floorSize" INTEGER,
    "rooms" INTEGER,
    "hasParking" BOOLEAN,
    "hasPool" BOOLEAN,
    "isActual" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "previewImage" JSONB,
    "images" JSONB,
    "videoId" TEXT,
    "videoPreview" JSONB,
    "description" JSONB,
    "distances" JSONB,
    "seo" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developers" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleFull" TEXT,
    "excerpt" TEXT,
    "logo" JSONB,
    "description" JSONB,
    "seo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "specialization" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "image" JSONB,
    "linkedin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "translationGroupId" TEXT,
    "language" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_files" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "file" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_documents" (
    "id" TEXT NOT NULL,
    "sanityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "language" "Locale" NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "sanityAssetId" TEXT,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "blurDataUrl" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EDITOR',
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'CONTACT_FORM',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "nationality" TEXT,
    "languagePreference" "Locale",
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "timeline" "LeadTimeline",
    "financing" "LeadFinancing",
    "propertyTypeInterest" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message" TEXT,
    "notes" TEXT,
    "assignedToId" TEXT,
    "projectInterestId" TEXT,
    "pageSource" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "telegramNotified" BOOLEAN NOT NULL DEFAULT false,
    "emailNotified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "locale" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetched" TIMESTAMP(3),
    "lastStatus" TEXT,
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "feedSourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsFound" INTEGER,
    "recordsCreated" INTEGER,
    "recordsUpdated" INTEGER,
    "recordsArchived" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_queue" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ai_generation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_sanityId_key" ON "projects"("sanityId");

-- CreateIndex
CREATE INDEX "projects_translationGroupId_idx" ON "projects"("translationGroupId");

-- CreateIndex
CREATE INDEX "projects_language_status_idx" ON "projects"("language", "status");

-- CreateIndex
CREATE INDEX "projects_city_idx" ON "projects"("city");

-- CreateIndex
CREATE INDEX "projects_isFeatured_idx" ON "projects"("isFeatured");

-- CreateIndex
CREATE INDEX "projects_listingPriority_idx" ON "projects"("listingPriority");

-- CreateIndex
CREATE UNIQUE INDEX "projects_language_slug_key" ON "projects"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "blogs_sanityId_key" ON "blogs"("sanityId");

-- CreateIndex
CREATE INDEX "blogs_translationGroupId_idx" ON "blogs"("translationGroupId");

-- CreateIndex
CREATE INDEX "blogs_language_status_idx" ON "blogs"("language", "status");

-- CreateIndex
CREATE INDEX "blogs_publishedAt_idx" ON "blogs"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "blogs_language_slug_key" ON "blogs"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "singlepages_sanityId_key" ON "singlepages"("sanityId");

-- CreateIndex
CREATE INDEX "singlepages_translationGroupId_idx" ON "singlepages"("translationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "singlepages_language_slug_key" ON "singlepages"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "case_studies_sanityId_key" ON "case_studies"("sanityId");

-- CreateIndex
CREATE INDEX "case_studies_translationGroupId_idx" ON "case_studies"("translationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "case_studies_language_slug_key" ON "case_studies"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "properties_sanityId_key" ON "properties"("sanityId");

-- CreateIndex
CREATE INDEX "properties_translationGroupId_idx" ON "properties"("translationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "properties_language_slug_key" ON "properties"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "developers_sanityId_key" ON "developers"("sanityId");

-- CreateIndex
CREATE INDEX "developers_translationGroupId_idx" ON "developers"("translationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "developers_language_slug_key" ON "developers"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "authors_sanityId_key" ON "authors"("sanityId");

-- CreateIndex
CREATE INDEX "authors_translationGroupId_idx" ON "authors"("translationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_sanityId_key" ON "categories"("sanityId");

-- CreateIndex
CREATE INDEX "categories_translationGroupId_idx" ON "categories"("translationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_language_slug_key" ON "categories"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "doc_files_sanityId_key" ON "doc_files"("sanityId");

-- CreateIndex
CREATE UNIQUE INDEX "doc_files_slug_key" ON "doc_files"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "site_documents_sanityId_key" ON "site_documents"("sanityId");

-- CreateIndex
CREATE INDEX "site_documents_type_idx" ON "site_documents"("type");

-- CreateIndex
CREATE UNIQUE INDEX "site_documents_type_language_key" ON "site_documents"("type", "language");

-- CreateIndex
CREATE UNIQUE INDEX "media_sanityAssetId_key" ON "media"("sanityAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "page_views_path_idx" ON "page_views"("path");

-- CreateIndex
CREATE INDEX "page_views_createdAt_idx" ON "page_views"("createdAt");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_study_projects" ADD CONSTRAINT "case_study_projects_caseStudyId_fkey" FOREIGN KEY ("caseStudyId") REFERENCES "case_studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_study_projects" ADD CONSTRAINT "case_study_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_projectInterestId_fkey" FOREIGN KEY ("projectInterestId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_feedSourceId_fkey" FOREIGN KEY ("feedSourceId") REFERENCES "feed_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
