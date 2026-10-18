# Partner Portal Phase 3d (Engagement: calculator, onboarding, materials, digest, notification settings, response time) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give partners the motivation and self-service features the spec lists for Phase 3, none of which need external accounts:
- a commission calculator;
- an onboarding checklist;
- a Materials page;
- a weekly email digest with opt-out;
- an email-notification switch;
- the programme's average response time on the public landing page.

**Architecture:** Mostly read-only views over existing partner-scope data (`src/lib/partner/scope.ts`, `myProjects`, `myCommissions`, the claim rule in `claimState.ts`). One small additive migration adds two Partner preference columns and a digest log for idempotency. The digest is a weekly cron route following the `partner-notify` pattern (key check, `withCronLog`, START env, mark after send). Static texts (guidelines, FAQ) live in the dictionary, en/de/pl/ru.

**Tech Stack:** Next.js 14.2, Prisma 5.22, node:test via tsx, nodemailer via `sendEmail`.

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md`. Relevant sections:
- §6.2 item 8 Materials, item 11 profile notification toggle
- §9 #2 weekly digest, #4 response time on landing, #7 calculator, #8 onboarding (Telegram and presentation steps come in 3e)

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production DB: never run prisma migrate/db push/next build/next dev or anything connecting to a DB. Use `prisma generate`/`validate` with the dummy URL. The controller verifies the additive migration on PGlite.
- Never call cron routes; never send email/Telegram from tests/scripts.
- No `src/app/admin` changes. Partner copy en/de/pl/ru (DE Sie / PL Państwo / RU Вы, never Hebrew). Use the portal CI styles (portal.css). Figures in Fraunces bronze.
- Isolation: every partner read goes through scope functions filtered by the session's partnerId. Never expose ourCommission/ourRatePercent to non-trust partners (effective rates only). The digest only contains the recipient partner's own data.
- Tests `npm test`; `npx tsc --noEmit` 0; `npm run lint` 0. Explicit-path commits, never `git add -A`, don't push, don't deploy.

## Decisions

1. **Migration:**
   - Partner gains `emailNotifications Boolean @default(true)` and `digestOptIn Boolean @default(true)`.
   - New model `PartnerDigestLog { id, partnerId, weekKey String /* ISO week "2026-W43" */, sentAt DateTime?, error String?, createdAt }` with `@@unique([partnerId, weekKey])`.
2. **Notification switch:** when `emailNotifications` is false, the outbox sender marks STAGE and MESSAGE rows sent with error `"opted out"`. CLAIM_OUTCOME and PAYOUT always send, because they concern money and the claim decision.
3. **Calculator** (`/calculator`, active partners):
   - The partner enters a price (whole euros) and picks a project (search), or "all projects".
   - Output per project: handover payout and fix payout, using `effectiveRate` × price via `computeDealAmounts` semantics (whole euros, basis-point rounding). In trust mode the output also shows our rate.
   - A MISSING rate shows "on request".
   - Pure function `calculatePayouts(price, projects)` with tests. The page is a client component that gets only the effective rates (the same props rule as /projects).
4. **Onboarding checklist** (on /home for ACTIVE partners, hidden once all items are done or dismissed via a cookie set in an action). Items, computed server-side:
   - email verified (always true for active partners);
   - agreement accepted (an acceptance exists);
   - bank details complete (`bankDetailsComplete`);
   - first client submitted (any claim);
   - first presentation and Telegram connected come in 3e (not shown now).
   Progress bar "2 of 4". Pure `onboardingSteps(facts)` with tests.
5. **Materials** (`/materials`, active partners):
   - The partner agreement (link to /agreement with version and accepted date);
   - advertising guidelines (dict text: what partners may and may not say: no price promises, no use of our brand as their own, no portals with our listings, GDPR consent);
   - How-it-works/FAQ (dict text, 8–10 Q&As covering handover vs fix, client protection 6 months, when commission is paid, credit notes, bank-details change pause, how to contact the manager);
   - project brochures: for each published project with a slug, a link to the main-site project page and its PDF brochure at `https://cyprusvipestates.com/api/projects/<lang>/<slug>/pdf`. These are absolute main-site URLs, because `/api` is not served on the partner host. Use the partner's language with fallback en. Search box; list capped at 300.
6. **Weekly digest** (`/api/cron/partner-digest`, Mondays 07:00 Cyprus time; env `PARTNER_DIGEST_START` required, else skipped):
   - Recipients: ACTIVE partners with `digestOptIn` and a verified user email.
   - Per partner, one email for the ISO week (weekKey of the run date in Asia/Nicosia).
   - Content:
     - client updates in the last 7 days: milestones via the existing scope/milestone helpers, effectively active claims only, max 10;
     - commission totals per stage, including expected;
     - up to 5 projects published in the last 7 days (name, town, the partner's handover rate or "on request", link).
   - Skip the email when all three are empty (log row with error `"nothing new"`).
   - Idempotent: insert the PartnerDigestLog row first (unique). On send success set sentAt; on failure set error, which is retried on the next run of the same week. Cap 200 partners per run. Advisory lock like partner-notify.
   - A footer link opens /profile to switch the digest off.
7. **Profile settings:** two toggles (email notifications, weekly digest) with one server action (requirePartner active; update own row only).
8. **Response time on landing:**
   - Average minutes from claim creation to first outbound contact (CALL, EMAIL_OUT, WHATSAPP_OUT) over claims created in the last 90 days that have such a contact.
   - Shown on the public landing ("Our team contacts referred clients within N minutes on average") only when ≥ 5 samples. Format: minutes under 120, else hours.
   - Pure `averageResponse(samples)` with tests. The server query is bounded (500 claims) and cached via `unstable_cache` with a 1 h revalidate (tag `partner-response-avg`).
9. **Nav:** "Calculator" and "Materials" are added for ACTIVE partners. If the header gets crowded on phones, keep them in the scrollable nav like the CRM does.

## Tasks

### Task 1: Migration
- [ ] Schema per Decision 1. SQL in `prisma/migrations/20261019130000_partner_engagement/migration.sql`, in the style of the previous partner migrations.
- [ ] Validate and generate (dummy URL); run tsc and npm test; commit.
- [ ] The controller runs the PGlite check.

### Task 2: Pure logic + dictionary
- [ ] `src/lib/partner/calculator.ts` (`calculatePayouts`).
- [ ] `src/lib/partner/onboarding.ts` (`onboardingSteps`).
- [ ] `src/lib/partner/responseAverage.ts` (`averageResponse`, `formatResponse`).
- [ ] `src/lib/partner/digest.ts` (`isoWeekKey(date, tz)`, `digestContent(...)` → null when empty, `buildDigestEmail(locale, content)`).
- [ ] Dictionary: calculator, onboarding, materials (guidelines + FAQ texts), digest email, profile toggles, landing response line, all 4 locales.
- [ ] Tests: rounding; trust mode only adds ourRate when allowed; onboarding counting; average/format thresholds; ISO week across year boundary in Asia/Nicosia; digest null when empty; the email lists only the given partner's items, escapes, has the opt-out link, and has no internal fields.

### Task 3: Portal pages and settings
- [ ] /calculator, /materials, the onboarding card on /home, profile toggles + action, nav entries, the landing response line (with the cached query).
- [ ] The notify sender respects `emailNotifications` (Decision 2) with a test of the gate.
- [ ] Bounded queries; isolation preserved.

### Task 4: Weekly digest cron
- [ ] `src/lib/partner/digestSend.ts` + `src/app/api/cron/partner-digest/route.ts` per Decision 6.
- [ ] Header comment with the crontab line `0 5 * * 1 curl -s "http://127.0.0.1:3000/api/cron/partner-digest?key=$CRON_SECRET" >/dev/null` (05:00 UTC ≈ 07:00/08:00 Cyprus).
- [ ] Tests for the pure planning parts: recipient filter, week key, log idempotency decisions.

### Task 5: Wrap-up
- [ ] Full checks, PGlite migration check, demo smoke (calculator, materials, onboarding, toggles).
- [ ] Final whole-branch review, fix wave, push.
- [ ] Hand-over: crontab line, env `PARTNER_DIGEST_START`, `CVP_RUN_MIGRATE=1`.
