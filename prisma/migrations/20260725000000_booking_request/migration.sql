-- Phase 3: booking page. Pure additive — two new enum types, one new
-- LeadInteractionType value, one new table. No existing column touched.
ALTER TYPE "LeadInteractionType" ADD VALUE 'BOOKING_EVENT';

CREATE TYPE "BookingRequestStatus" AS ENUM ('PENDING', 'PROPOSED', 'CONFIRMED', 'CANCELLED');

CREATE TYPE "MeetingType" AS ENUM ('ZOOM', 'PHONE');

CREATE TABLE "booking_requests" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "meetingType" "MeetingType" NOT NULL DEFAULT 'ZOOM',
    "proposedSlots" JSONB,
    "leadTimezone" TEXT,
    "confirmedSlotUtc" TIMESTAMP(3),
    "zoomLinkSentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_requests_token_key" ON "booking_requests"("token");

CREATE INDEX "booking_requests_leadId_idx" ON "booking_requests"("leadId");

ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
