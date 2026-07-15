-- AlterTable
ALTER TABLE "development_units" ADD COLUMN     "amenities" JSONB,
ADD COLUMN     "areaInternal" TEXT,
ADD COLUMN     "areaVerandaOpen" TEXT,
ADD COLUMN     "guestWc" TEXT,
ADD COLUMN     "orientation" TEXT,
ADD COLUMN     "storage" TEXT,
ADD COLUMN     "unitNumber" TEXT;

