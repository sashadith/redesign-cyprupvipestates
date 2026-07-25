-- Batch C part 3 (2026-07-25): Telegram meeting reminders for confirmed
-- bookings. Purely additive — two nullable timestamp columns, no default,
-- no existing row is affected. NULL means "not yet sent/skipped"; the
-- booking-reminders cron and confirmBookingSlotAction are the only writers.
ALTER TABLE "booking_requests" ADD COLUMN     "reminder1hSentAt" TIMESTAMP(3);
ALTER TABLE "booking_requests" ADD COLUMN     "reminder10mSentAt" TIMESTAMP(3);
