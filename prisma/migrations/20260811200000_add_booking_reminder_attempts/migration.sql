-- Failed-attempt counters for booking meeting reminders (see BookingRequest
-- schema comment / booking-reminders/route.ts) — lets the cron distinguish
-- "actually delivered" from "gave up after retries" instead of marking
-- SentAt unconditionally on every attempt.
ALTER TABLE "booking_requests" ADD COLUMN "reminder1hAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_requests" ADD COLUMN "reminder10mAttempts" INTEGER NOT NULL DEFAULT 0;
