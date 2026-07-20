-- AlterTable
ALTER TABLE "page_views" ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrefetch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;
