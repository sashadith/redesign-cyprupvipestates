# Booking page (Phase 3, 2026-07-25)

A personal, token-based page where a lead proposes meeting times and Sascha
confirms one — the reverse of a typical calendar-booking widget. There is no
external calendar system and no availability sync: the lead never books
directly into a calendar, only suggests times, so Sascha never needs to
commit to availability in advance and double-booking is structurally
impossible.

## Flow

1. **Admin creates the link.** "Booking link" button on the Lead Cockpit
   (`CockpitCard.tsx` → `BookingButton.tsx`) calls
   `createOrGetBookingRequestAction` (`crm/[id]/bookingActions.ts`), which
   dedupes against any already-open (`PENDING`/`PROPOSED`, not expired)
   request for that lead rather than creating a duplicate. No email is sent
   here — Sascha shares the link himself (Compose or manually).
2. **Lead proposes times.** The public `/book/[token]` page
   (`src/app/book/[token]/page.tsx`) shows a slot picker for the next 14
   days (`src/lib/booking/slots.ts`), styled like `/c/[token]` but with its
   own `booking.css`. The lead picks 1-3 times; `proposeSlotAction` (no auth
   — this route is unauthenticated by design) flips the request to
   `PROPOSED`.
3. **Admin confirms.** `BookingPanel.tsx` shows proposed slots in both
   Cyprus time and the lead's detected timezone. One click on
   `confirmBookingSlotAction` sends the localized confirmation email
   (reusing Compose's signature/font/closing apparatus) with a standards-
   compliant `.ics` attachment (`src/lib/booking/ics.ts`, via the `ics` npm
   package) and flips the request to `CONFIRMED`.
4. **Zoom-link reminder.** No static Zoom room exists — the link is sent
   separately, after confirmation. `ZoomLinkReminder.tsx` shows a persistent
   banner on the Cockpit for any `CONFIRMED` + `ZOOM` request until
   `zoomLinkSentAt` is set, so this one manual step can't be forgotten.

## Data model

`BookingRequest` (additive migration
`prisma/migrations/20260725000000_booking_request/`):

- `token` — same random-token pattern as `ClientPresentation`.
- `status` — `PENDING` → `PROPOSED` → `CONFIRMED` (or `CANCELLED`).
- `meetingType` — `ZOOM` | `PHONE`, set by Sascha at creation, not chosen by
  the lead.
- `proposedSlots` (`Json`) — `[{ utc: ISOString }, ...]`, the lead's 1-3
  picks as absolute UTC instants.
- `leadTimezone` — IANA name, detected client-side when the lead submits.
  Display only — never used for availability logic.
- `confirmedSlotUtc` / `confirmedAt` — set once Sascha confirms.
- `zoomLinkSentAt` — drives the Cockpit reminder above.

`LeadInteractionType.BOOKING_EVENT` mirrors `PRESENTATION_EVENT`'s pattern
(`channel: "SYSTEM"`, `metadata.legacyType` distinguishes
`BOOKING_PROPOSED`/`BOOKING_CONFIRMED`) for the lead timeline.

## Timezone handling

`src/lib/booking/timezone.ts` uses only native `Intl.DateTimeFormat` — no
timezone library. The one place an actual UTC-offset calculation happens is
converting a Cyprus wall-clock slot into a UTC instant when generating the
slot list; every other display (Cyprus time to Sascha, the lead's own time
to the lead) is a plain `Intl` render of that same instant. Verified across
Cyprus's EET/EEST DST boundary and against a real Gmail + Apple Mail send
(see the 2026-07-25 commit message for details).

## Routing gotcha

`/book/[token]` sits outside the `[lang]` tree, same as `/c/[token]` — both
need an explicit exclusion in `src/middleware.ts`'s matcher, or next-intl's
i18n middleware rewrites every `/book/<token>` request to
`/en/book/<token>`, which doesn't exist, and every booking link 404s. Caught
during staging verification of this feature; see the middleware comment.
