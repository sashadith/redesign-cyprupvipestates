# Partner notifications v2 (Telegram + e-mail) — design

Date: 2026-10-30. Operator approved all 11 proposals plus every framework point in chat.

## Why

Partners who link the Telegram bot today get nothing on Telegram: linking leaves `notifyChannel = EMAIL`,
while the bot replies "your notifications arrive here from now on". And the portal only tells partners
about their own clients; it never pushes new projects, protection deadlines or money blockers, which are
the moments a partner would act on.

## Goals

- Linking the bot actually switches Telegram on.
- Eleven new or richer notifications (below), each on the partner's channel(s): EMAIL, TELEGRAM or BOTH.
- Two new profile switches so the broadcast-style messages can be turned off.
- Same privacy line as today: no developer names, nothing about our commission, no lead contact data.

## Non-goals / anti-goals

- No Hebrew copy (partner portal is en/de/pl/ru only).
- No new bot commands; no client submission via the bot.
- Never more than one broadcast message per partner per day (bundle, don't spam).
- Never a reminder that is wrong at send time (re-check state at delivery, like the existing gates).

## Framework

1. **Link → BOTH.** `link()` in `src/lib/partner/telegramWebhook.ts` sets `notifyChannel = BOTH` when it is
   `EMAIL`; an explicit TELEGRAM/BOTH choice stays. Unlink keeps today's reset to EMAIL.
2. **Two switches** on `Partner`, both default `true`:
   - `marketAlerts` — new projects (1) and updates on projects from the partner's presentations (2, 3).
   - `reminders` — protection ending (4) and quiet client (5).
   Everything else (client stages, money, tier) stays always on. Both switches gate every channel.
   Profile page gets two checkboxes next to the existing ones, saved by `settingsActions.ts`.
3. **Delivery** reuses the existing outbox: new `PartnerNotificationKind` values, rows written by planners,
   delivered by the existing `partner-notify` cron through `prepareRow`/`deliverRow` (e-mail and Telegram
   builders per kind, routeNotification, retries, breaker, opt-out gates).
4. **Planner cron** `/api/cron/partner-alerts` (daily, 05:30 UTC ≈ 07:30/08:30 Cyprus), English log,
   advisory lock, gated by `PARTNER_ALERTS_START` (unset → does nothing). Writes rows only; idempotent via
   `refKey` uniqueness (`createMany … skipDuplicates`).
5. Copy: partner-facing en/de/pl/ru in `src/lib/partner/i18n/*.ts`; logs/admin English.

## The notifications

| # | Kind | Trigger (planner) | refKey | Switch |
|---|------|-------------------|--------|--------|
| 1 | `PROJECT_NEWS` | projects `published` in the last 24 h (inventoryChanges) → one row per ACTIVE partner, up to 5 projects | `news:<partnerId>:<cyDate>` | marketAlerts |
| 2+3 | `WATCH` | changes of the last 24 h on developments in the partner's own active, unexpired presentations: `new_units`, `price_from_changed` (decrease), `unit_price_changed` (decrease), `back_on_market`, and `availability_changed` crossing from >3 to 1–3 available ("almost sold out"). One row per partner per day, up to 5 projects | `watch:<partnerId>:<cyDate>` | marketAlerts |
| 4 | `PROTECTION_ENDING` | effectively ACTIVE, not committed claim whose `protectedUntil` is ≤30 days away (and again ≤7) | `protect:<claimId>:<30\|7>:<protectedUntil date>` | reminders |
| 5 | `CLIENT_QUIET` | effectively ACTIVE, not committed claim, lead not KEEP_CONTACT/LOST/CLOSED, no status change, real contact or partner message for 14 days | `quiet:<claimId>:<last-activity date>` | reminders |
| 6 | `STAGE` (richer) | existing stage row to VIEWING_SCHEDULED: add `lead.viewingScheduledAt` when in the future → "Viewing on {date}" | unchanged | — |
| 7 | `STAGE` (richer) | existing stage row to RESERVED: add the partner's commission of the live deal → "Your expected commission: {amount}" | unchanged | — |
| 8 | `BANK_MISSING` | partner without bank details and a live deal of theirs (not CANCELLED/PAID_OUT): once at deal creation, once when the developer has paid (a deal first seen already paid gets only the second) | `bank:<dealId>:created` / `bank:<dealId>:devpaid` | always |
| 9 | approval e-mail (richer) | existing approval mail gains a "Submit a client" button and a line on connecting Telegram | — | — |
| 10 | `TIER_NEAR` | closed deals in 12 months = next tier's `minClosedDeals − 1` | `tiernear:<partnerId>:<tierKey>` | always |
| 11 | weekly digest on Telegram | the Monday digest follows `notifyChannel`: EMAIL → mail, TELEGRAM → short Telegram summary, BOTH → both. `digestOptIn` stays the master switch | existing `PartnerDigestLog` | digestOptIn |

Delivery-time gates (in `prepareRow`): partner ACTIVE (existing), switch on, and for 4/5 the claim is still
effectively ACTIVE and the computed `protectedUntil` / last-activity date still equals the one in the refKey
(otherwise the row is closed as "superseded"). 8 re-checks that bank details are still missing.

**Item 9 — operator's call recorded here:** a PENDING partner cannot link Telegram (link requires ACTIVE),
so "account activated" can only go by e-mail. That mail already exists; it is enriched instead of adding a
Telegram message.

## Message content

- 1: "New on Cyprus VIP Estates" + per project: name, area/district, price from, the partner's
  Handover rate as on the portal's projects page, public project link. Never the developer.
- 2+3: "Updates on projects from your presentations" + per project the change label (existing
  `telegram.changeTypes`, plus a new `low_stock` label "only {n} left"), price from, link.
- 4: "{client}: your client protection ends on {date}. Any real contact from us extends it — tell us if the
  client is still interested." + portal link.
- 5: "{client}: no news for 14 days. If you have heard from your client, message us in the portal." + link.
- 8: "To pay your commission for {client} we need your bank details." + link to the bank page.
- 10: "One more closed deal to reach {tier} ({handover} % Handover · {fix} % Fix)." + portal link.

## Schema change (needs the migrate flag on deploy)

- `PartnerNotificationKind` += PROJECT_NEWS, WATCH, PROTECTION_ENDING, CLIENT_QUIET, BANK_MISSING, TIER_NEAR.
- `Partner` += `marketAlerts Boolean @default(true)`, `reminders Boolean @default(true)`.

## Ops after deploy (operator / me on request)

- Deploy with `CVP_RUN_MIGRATE=1`.
- Set `PARTNER_ALERTS_START` in `/var/www/shared/.env`, add crontab line
  `30 5 * * * curl -s "http://127.0.0.1:3000/api/cron/partner-alerts?key=$CRON_SECRET" >/dev/null`.

## Left to the builder

Exact copy wording within the lines above; file split of the planner (pure planner + DB collector, matching
`matchAlerts.ts`/`matchSend.ts`); test layout (`src/lib/__tests__/partnerAlerts*.test.ts`).
