-- AlterEnum
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'PROJECT_NEWS';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'WATCH';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'PROTECTION_ENDING';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'CLIENT_QUIET';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'BANK_MISSING';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'TIER_NEAR';

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "notifyClients" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyNewProjects" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyProjectUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quietFrom" INTEGER,
ADD COLUMN     "quietTo" INTEGER;

-- AlterTable
ALTER TABLE "partner_notifications" ADD COLUMN     "notBefore" TIMESTAMP(3);
