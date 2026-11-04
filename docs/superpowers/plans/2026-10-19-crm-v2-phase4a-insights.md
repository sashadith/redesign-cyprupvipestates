# CRM v2 Phase 4a (Insights: lead temperature, channel performance, commission outlook, partner quality) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the data the CRM already collects into decisions:
- a hot/warm/cold temperature on every lead (pipeline card, cockpit, Today);
- a manager-only Insights screen with channel performance, a commission outlook, and partner quality per partner.

**Architecture:**
- Read-only and computed at request time from existing tables. **No migration.**
- Pure scoring and aggregation functions live in `src/lib/crm/insights/*`. The server side runs bounded, batched Prisma queries.
- The Insights page is a server component at `/crm/insights` (managers only), with a period filter in query params. All copy is English (internal).

**Tech Stack:** Next.js 14.2, Prisma 5.22, node:test via tsx, the CRM CI styles (`crm.css`).

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` §9 #11 (lead temperature), #14 (partner quality), #15 (commission forecast), #16 (channel performance); §10 Phase 4. Phase 4b (automatic news, rating seasons with prizes, partner tiers) is a separate plan.

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production DB: never run migrate/db push/next build/next dev or anything connecting to a DB. Tests are pure (no DB).
- No `src/app/admin` changes. Respect the access layer: lead temperature shows only on leads the user can see. The Insights page is limited to `canAssignLeads` (managers) and aggregates across all leads; it never lists lead contact data.
- Queries are bounded and batched (no N+1). The board/Today extra queries are one batched query per signal for the visible lead ids.
- Tests `npm test`; `npx tsc --noEmit` 0; `npm run lint` 0. Explicit-path commits, never `git add -A`, don't push, don't deploy.

## Decisions

1. **Lead temperature** (pure `leadTemperature(input, now)` → `{ level: "hot" | "warm" | "cold"; score: number; reasons: string[] }`). Signals and points:

   | Signal | Points |
   |---|---|
   | Stage VIEWING_SCHEDULED | +3 |
   | Stage OFFER | +4 |
   | Stage RESERVED | +5 |
   | Stage COMMUNICATING | +1 |
   | Timeline IMMEDIATE | +2 |
   | Timeline THREE_MONTHS | +1 |
   | Timeline JUST_LOOKING | −1 |
   | Budget given (budgetMin or budgetMax) | +1 |
   | Inbound reply (EMAIL_IN / WHATSAPP_IN) ≤ 7 days | +3 |
   | Inbound reply ≤ 30 days | +1 |
   | Presentation opened ≤ 14 days | +2 |
   | Any favorite ≤ 14 days | +1 |
   | Last real contact (CALL, EMAIL_*, WHATSAPP_*) > 30 days ago (or never and lead older than 7 days) | −2 |
   | Lead older than 90 days without stage beyond CONTACTED | −2 |

   - Thresholds: score ≥ 5 → hot, 2–4 → warm, ≤ 1 → cold.
   - CLOSED, LOST and KEEP_CONTACT leads get no temperature (null).
   - Reasons are short English chips, e.g. "Replied 2 days ago", "Viewing scheduled", "No contact for 41 days".
   - All weights live in one exported constant so they can be tuned.
2. **Where temperature shows:**
   - Pipeline cards: a coloured dot with a tooltip of reasons.
   - Cockpit header: a chip with the reasons.
   - Today: list items show the dot, and the "Your leads" block sorts hot first.
   - Server helper `temperaturesFor(leadIds, now)`: three batched queries (latest inbound per lead, latest real contact per lead, latest presentation view + favorite per lead via ClientPresentation), then the pure scorer.
3. **Insights page** `/crm/insights` (nav "Insights" for managers, after Commissions):
   - **Period:** presets this month / last 3 months / this year / last 12 months; custom from–to. Cyprus time.
   - **Channel performance:** one row per LeadSource (PARTNER also split into Handover / Fix by `partnerMode`). Columns:
     - leads created in the period;
     - % contacted (first real outbound contact exists);
     - median first-response time (minutes/hours, from createdAt to first outbound contact);
     - viewings (reached VIEWING_SCHEDULED or later, per STATUS_CHANGE metadata or current status);
     - reserved+closed;
     - won rate (closed ÷ leads);
     - earned commission (sum of `ourCommission` of deals with status EARNED, DEVELOPER_PAID or PAID_OUT whose lead belongs to the cohort).

     Cohort = leads created in the period. Excludes NEWSLETTER and trashed leads.
   - **Commission outlook:**
     - totals by commission stage now: EXPECTED (reserved, not yet earned), EARNED (awaiting developer payment), DEVELOPER_PAID (awaiting partner payout, if any), PAID_OUT this period;
     - a 12-month history bar chart (stacked earned / developer-paid per month, by `earnedAt` / `developerPaidAt`);
     - a simple outlook line: "Expected in pipeline: € X (weighted € Y at 70 %)". The weight is a constant, labelled as an estimate (no invented contract dates).
     - Partner commissions owed: the sum of `partnerCommission` for deals EARNED or DEVELOPER_PAID with a partner share.
   - **Partner quality:** per partner (ACTIVE + SUSPENDED), over the period's claims.
     - Columns: submitted (claims created), accepted (ACTIVE or committed), in review, rejected; valid = accepted claims whose lead is not LOST with reason UNREACHABLE or INVALID; reached viewing; closed deals; conversion = closed ÷ accepted; median response time to their clients.
     - Flags:
       - "Low quality" when submitted ≥ 5 and valid ÷ submitted < 40 %;
       - "Top partner" when closed ≥ 2 in the period.
     - Sortable by column (client component over server data). Links to /crm/partners.
   - Charts: inline SVG (no chart library), CI colours (bronze, champagne lines, muted stage colours), accessible labels. Read the `dataviz` skill guidance for chart choices (bar for monthly history, plain table + inline bars for channel comparison).
4. **Performance:** Insights queries are aggregated in SQL where practical (groupBy / raw SQL with parameters). Caps: cohort ≤ 20,000 leads; partner list ≤ 500. Cached per request only.

## Tasks

### Task 1: Pure insights logic
- [ ] `src/lib/crm/insights/temperature.ts` (Decision 1 + weights constant).
- [ ] `src/lib/crm/insights/channels.ts`: `channelRows(leads, firstContacts, viewings, deals)` with median helper.
- [ ] `src/lib/crm/insights/outlook.ts`: totals, monthly buckets in Cyprus time, weighted outlook.
- [ ] `src/lib/crm/insights/partnerQuality.ts`: per-partner rows + flags.
- [ ] `src/lib/crm/insights/period.ts`: presets → from/to in Cyprus time.
- [ ] Tests for each, covering boundaries: thresholds, 7/30-day windows, closed/lost null, median of even/odd, empty cohorts, month bucketing at month end in Cyprus time, flags, weighted outlook rounding.

### Task 2: Temperature in pipeline, cockpit, Today
- [ ] `src/lib/crm/insights/temperatureQuery.ts` `temperaturesFor(leadIds, now)` (batched).
- [ ] Wire into the pipeline query/board cards, the cockpit header, and the Today lists (sort hot first in "your leads").
- [ ] CSS dots/chips in crm.css (CI colours: hot = bronze #8E6B3D filled, warm = champagne outline, cold = muted grey). Accessible text ("Hot lead").
- [ ] Tests for the wiring helpers (pure mapping).

### Task 3: Insights page
- [ ] `/crm/insights` page + components (period filter, channel table, outlook cards + monthly SVG bars, partner quality table with sort), nav entry for managers, server queries `src/lib/crm/insights/queries.ts`.
- [ ] Non-managers are redirected to /crm/today.
- [ ] Tests for query-shaping helpers (pure).

### Task 4: Wrap-up
- [ ] Full checks, demo smoke (page renders on the demo DB with numbers), final review, fixes, push.
