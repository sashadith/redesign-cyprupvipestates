-- Snapshot of the bedroom/location filters selected in the admin matching
-- panel at presentation-generation time, so the public page can show them
-- back to the client as "your preferences" alongside budget/property type.
ALTER TABLE "client_presentations" ADD COLUMN IF NOT EXISTS "filterBedrooms" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "client_presentations" ADD COLUMN IF NOT EXISTS "filterLocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
