# Partner Portal Phase 4b (Partner tiers, rating seasons with prizes, automatic news) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motivate partners with three features:
- **Tiers:** Silver, Gold and Platinum, each with a higher share. The system proposes an upgrade and the operator confirms it.
- **Rating seasons:** a ranking where the other partners are anonymised, with points, a countdown and prizes.
- **Automatic news:** new projects, price drops and "nearly sold out", with an unread counter.

**Architecture:**
- **Tiers:** configuration is a small table (seeded defaults, editable in the CRM). Tier proposals are computed by a daily cron and also on demand on the CRM partners page. Confirming a proposal sets the partner's tier and shares, audited.
- **Rating:** seasons and their point rules live in the DB. Points are an idempotent ledger (`refKey` unique) filled by a daily cron from existing facts: claims accepted, viewings, reservations, closings.
- **News:** derived at request time from the existing `inventoryChanges()` engine (last 30 days). No news table; only `Partner.newsSeenAt` for the unread count.
- Everything partner-facing is localized en/de/pl/ru. The CRM side is English.

**Tech Stack:** Next.js 14.2, Prisma 5.22 (additive migration), node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md`. Relevant sections:
- §6.2 items 9 (News) and 10 (Rating)
- §9 #5 (tiers: e.g. Silver 30 % / Gold 35 % / Platinum 40 % by closed deals per year; thresholds and shares configurable; the system proposes, the operator confirms; combinable with seasonal rating)
- §4 Rating model (Season, point rules, PointEvent ledger)

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production DB: never run migrate/db push/next build/next dev or anything connecting to a DB. The controller verifies the additive migration on PGlite. Never call cron routes; never send email/Telegram.
- No `src/app/admin` changes. Partner copy en/de/pl/ru (DE Sie / PL Państwo / RU Вы, never Hebrew). CRM English. CI styles.
- **Isolation:**
  - A partner sees their own tier, points and position.
  - Other partners appear only anonymised: rank, points, country flag or name, and "Partner" plus a stable pseudonym number. Never another partner's name, company or clients.
  - News contains only public catalogue information (no unit-level data beyond what public pages show, no our-rate).
- Tier changes never touch existing deals; the new shares apply to deals created afterwards.
- Tests `npm test`; `npx tsc --noEmit` 0; `npm run lint` 0. Explicit-path commits, never `git add -A`, don't push, don't deploy.

## Decisions

1. **Schema (additive):**
   - `PartnerTier { key String @id, name String, sort Int, minClosedDeals Int, handoverShare Decimal(5,2), fixShare Decimal(5,2), active Boolean @default(true), updatedAt }`.
     Seeded in the migration with these defaults:

     | key | minClosedDeals (rolling 12 months) | handover | fix |
     |---|---|---|---|
     | silver | 0 | 30 | 50 |
     | gold | 3 | 35 | 55 |
     | platinum | 6 | 40 | 60 |

   - Partner gains `tierKey String? (FK PartnerTier, SetNull)`, `tierSince DateTime?`, `newsSeenAt DateTime?`.
   - `PartnerTierProposal { id, partnerId, fromTier String?, toTier String, closedDeals Int, createdAt, decidedAt?, decidedById?, decision "ACCEPTED" | "DECLINED" | null }`. Unique open proposal per partner: a partial unique index `WHERE "decidedAt" IS NULL` in SQL.
   - `RatingSeason { id, name, startsAt, endsAt, pointRules Json, prizes Json /* {en,de?,pl?,ru?} text */, createdAt, updatedAt }`.
   - `PartnerPointEvent { id, seasonId, partnerId, kind String, refKey String @unique, points Int, createdAt }` with `@@index([seasonId, partnerId])`.
2. **Tier logic** (pure):
   - `closedDealsLast12Months(deals)` counts deals with status EARNED, DEVELOPER_PAID or PAID_OUT and `earnedAt` within 365 days, on leads with the partner's effectively committed claim.
   - `proposeTier(current, closedDeals, tiers)` returns the highest active tier whose `minClosedDeals` ≤ closedDeals. A proposal is made only when that tier is higher than the current one. **No automatic downgrades:** the operator can change tiers manually.
   - A partner with no tier counts as silver for display. Existing partners get silver on first confirmation; until then they are shown as "Silver" without a share change.
   - Confirming sets `tierKey`, `tierSince`, `handoverShare` and `fixShare` from the tier, closes the proposal, audits, and sends a localized email/Telegram notice through the outbox (new kind `TIER_UP`).
   - Declining closes the proposal and records it. The next proposal can appear only after the closed-deal count grows.
3. **Tier cron** (`/api/cron/partner-tiers`, daily `0 3 * * *` UTC):
   - Computes proposals for ACTIVE partners and inserts an open proposal if none exists.
   - Sends one English office Telegram listing the new proposals.
   - Env `PARTNER_TIERS_START` gate. Advisory lock.
4. **CRM tiers:**
   - A tiers settings card on /crm/partners (owner/manager): edit name, threshold, shares and active per tier.
   - Validation: thresholds strictly increasing by sort; shares 0–100. Audited.
   - "Open proposals" list with Accept/Decline. Each partner row shows the tier badge and the closed deals in the last 12 months.
5. **Portal tiers:** on /home and /commissions: the current tier, shares, and "{n} more closed deals to {next tier}" with a progress bar. Platinum shows "Highest tier".
6. **Rating:**
   - **Seasons:** the operator creates seasons in the CRM (`/crm/partners` → "Rating seasons"): name, start, end, prizes text (EN required, DE/PL/RU optional, falling back to EN), point rules.
   - **Point rules** (default; editable per season):

     | Event | Points |
     |---|---|
     | `claim_accepted` (client accepted) | 10 |
     | `viewing` (lead reached VIEWING_SCHEDULED) | 20 |
     | `reserved` | 50 |
     | `closed` | 100 |

     One event per claim and kind (refKey `<kind>:<claimId>:<seasonId>`). Events count only if their date falls within the season and the claim was effectively active at that time (use activeSince).
   - **Points cron** (`/api/cron/partner-points`, daily `30 3 * * *` UTC): for every season active today (and up to 3 days after its end, for late data), scan claims and status history and insert missing events (skipDuplicates). Env `PARTNER_POINTS_START`.
   - **Portal `/rating`:**
     - the current season name, countdown (days/hours), prizes, the partner's own points and rank with a breakdown by kind;
     - a ranking table of the top 20 with the partner's own row always shown. Others are shown as "Partner #<stable pseudonym number derived from a hash of partnerId+seasonId>" with country (ISO-2 flag emoji).
     - Ties are broken by earliest last point time.
     - Past seasons are shown with final ranks.
   - **CRM:** a full ranking with names per season, plus a CSV export.
7. **Automatic news** (`/news`, active partners, nav with an unread badge):
   - Items from `inventoryChanges({ days: 30 })`:
     - `published` → "New project";
     - `price_from_changed` decrease → "Price reduced from € X to € Y";
     - `back_on_market`;
     - "nearly sold out" when the available units ÷ total units ≤ 10 % and available ≥ 1 (computed from the current units with a status field; reuse the existing availability helper if present).
   - Per item: date, project name (the alias rule), town, the partner's handover rate or "on request", and a link to the public page (locale prefix).
   - Sorted newest first, max 50.
   - Unread = items newer than `newsSeenAt`. Visiting /news sets `newsSeenAt` via a server action fired on mount, not during render.
   - The nav badge count comes from a cached query (`unstable_cache`, 1 h, tag `partner-news`) plus the per-partner `newsSeenAt`.
8. **Outbox:** add kind `TIER_UP` with email and Telegram builders, 4 locales, sent like the others; channel routing from Phase 3e applies.

## Tasks

### Task 1: Migration
- [ ] Schema per Decision 1. SQL `prisma/migrations/20261020100000_partner_tiers_rating/migration.sql`:
  - `ALTER TYPE "PartnerNotificationKind" ADD VALUE 'TIER_UP'` first;
  - tables;
  - partial unique index;
  - seed INSERT of the 3 tiers.
- [ ] tsc may require the new outbox kind in the sender as an explicit skip, the same as in 3e Task 1.
- [ ] The controller runs the PGlite check.

### Task 2: Pure logic + dictionary
- [ ] `src/lib/partner/tiers.ts`: closed-deal count, `proposeTier`, `tierProgress`, `validateTierConfig`.
- [ ] `src/lib/partner/rating.ts`: `DEFAULT_POINT_RULES`, `validateSeason`, `pointEventsFor(claimFacts, season)`, `rankPartners(totals)` with tie-break, `pseudonym(partnerId, seasonId)`, `countdown(endsAt, now)`.
- [ ] `src/lib/partner/news.ts`: `newsItems(changes, availability, rates, locale)`, `unreadCount(items, seenAt)`.
- [ ] Dictionary sections tiers, rating, news, mail.tierUp in 4 locales.
- [ ] Tests for every boundary: thresholds, no downgrade, progress at the top tier, season window, active-claim gate, idempotent refKeys, ranking ties, pseudonym stability and no collisions within a season (resolve by suffix), countdown, news decrease-only, the nearly-sold-out rule, unread count.

### Task 3: Tiers end to end
- [ ] CRM settings card, proposals list, row badges, Accept/Decline actions (audited, row-locked, guarded update on the open proposal).
- [ ] The cron route + office Telegram.
- [ ] The TIER_UP outbox sender.
- [ ] The portal tier card on /home and /commissions.
- [ ] Tests for the glue.

### Task 4: Rating end to end
- [ ] CRM seasons UI (create/edit, point rules form, prizes per locale), the ranking with names, CSV export.
- [ ] The points cron.
- [ ] Portal `/rating` (current + past seasons).
- [ ] Nav entry.
- [ ] Tests for the glue.

### Task 5: News
- [ ] Portal `/news`, the unread badge in the nav, the seen action, the cached query.
- [ ] Tests for the glue.

### Task 6: Wrap-up
- [ ] Full checks, PGlite check, demo smoke (tiers proposal on demo data via tsx, the /rating and /news pages render).
- [ ] Final review, fix wave, push.
- [ ] Hand-over:
  - crontab lines for partner-tiers and partner-points;
  - env `PARTNER_TIERS_START` and `PARTNER_POINTS_START`;
  - `CVP_RUN_MIGRATE=1`;
  - create the first season in the CRM.
