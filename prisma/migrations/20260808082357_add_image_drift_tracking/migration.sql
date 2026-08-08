-- AlterTable
ALTER TABLE "developments" ADD COLUMN     "imageDriftDetectedAt" TIMESTAMP(3),
ADD COLUMN     "newFromFeed" JSONB;

