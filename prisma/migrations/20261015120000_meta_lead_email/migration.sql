-- Meta lead e-mail notification (2026-10-15). Purely additive: one nullable
-- column, the e-mail counterpart of "telegramSentAt" (null on a DONE row = the
-- e-mail is still owed; the poller re-sends it).
ALTER TABLE "meta_leadgen_events" ADD COLUMN "emailSentAt" TIMESTAMP(3);

-- Every lead imported BEFORE this release was notified by Telegram only, by
-- design. Mark those rows as handled, or the first poll after the deploy would
-- e-mail every DONE lead of the last 7 days at once.
UPDATE "meta_leadgen_events" SET "emailSentAt" = "updatedAt" WHERE "status" = 'DONE';
