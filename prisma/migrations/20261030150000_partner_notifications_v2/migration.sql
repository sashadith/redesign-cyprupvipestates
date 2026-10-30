-- AlterEnum
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'PROJECT_NEWS';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'WATCH';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'PROTECTION_ENDING';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'CLIENT_QUIET';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'BANK_MISSING';
ALTER TYPE "PartnerNotificationKind" ADD VALUE 'TIER_NEAR';

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "marketAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminders" BOOLEAN NOT NULL DEFAULT true;
