-- Marks a DevelopmentUnit row as a bulk/parcel listing — multiple physical
-- units (e.g. a whole apartment block) sold to one buyer as a single lot,
-- not a single purchasable apartment. Found on Mandria Gardens (Leptos
-- Estates): two rows ("AP-MAND-10", "A-MAND-11-PRC") carried €1.54M/€1.78M
-- prices for 6-apartment blocks, inflating the project's advertised
-- priceTo far above its real ~€399,000 single-apartment ceiling.
--
-- Purely additive, defaults false — every existing row is unaffected until
-- the next sync re-tags the known Leptos parcel rows.

-- AlterTable
ALTER TABLE "development_units" ADD COLUMN IF NOT EXISTS "isBulkListing" BOOLEAN NOT NULL DEFAULT false;
