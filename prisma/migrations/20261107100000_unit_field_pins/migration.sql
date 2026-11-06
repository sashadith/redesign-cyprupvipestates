-- Per-unit field pins: columns the developer's price list owns, which no sync
-- may overwrite (see src/lib/unitPins.ts). Additive and empty by default, so
-- every existing unit keeps following its feed exactly as before.
ALTER TABLE "development_units" ADD COLUMN     "pinnedFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
