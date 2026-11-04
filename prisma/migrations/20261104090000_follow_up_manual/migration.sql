-- A follow-up date set by a person; the automatic cadence does not overwrite it while it is in the future.
ALTER TABLE "leads" ADD COLUMN "followUpManual" BOOLEAN NOT NULL DEFAULT false;
