-- Feature Batch A: (1) email becomes optional on Lead (WhatsApp-only leads
-- often have none — every send path already gates on it being set), (2) new
-- countryOfResidence column (ISO 3166-1 alpha-2) for the leads-list flag
-- column, deliberately separate from the existing free-text `nationality`.
-- Both changes are backward compatible: dropping NOT NULL never rejects
-- existing rows, and the new column is nullable with no default.
ALTER TABLE "leads" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "leads" ADD COLUMN     "countryOfResidence" TEXT;
