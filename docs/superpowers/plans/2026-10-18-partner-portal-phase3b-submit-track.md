# Partner Portal Phase 3b (Submit clients, client protection, tracking, notifications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Active partners submit clients (Handover or Fix) from the portal. New contacts become partner leads in the CRM inbox. Already-known contacts go to an operator review without revealing anything. Partners follow each client (stage bar, curated milestones, messages from us, commission per deal, response time) and get localized emails. Staff see partner context in the CRM, review claims, write "messages to partner", and deals on partner leads carry the partner's share automatically.

**Architecture:** One partner-scope module (`src/lib/partner/scope.ts`) is the only place portal pages read lead/claim/deal data. It returns DTOs keyed by **claim id** (the portal never sees lead ids) and filtered by the session's partnerId. Submissions run in one service with the lead row creation, claim and audit in a transaction. Partner notifications use an **outbox**: a cron job scans for unsent events (stage changes on partner leads, partner messages, claim outcomes). It debounces stage flapping and sends localized emails, so every status-change path (new CRM, old CRM, MCP) is covered without touching those callers.

**Tech Stack:** Next.js 14.2 App Router, Prisma 5.22 (additive migration), node:test via tsx, nodemailer (`sendEmail`), existing cron pattern (`?key=$CRON_SECRET` + `withCronLog`).

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` (§2 duplicates/client protection/partner view/notifications, §5.2, §5.3 items 2 and 4, §6.2 items 1–5, §7 portal rows, §8 partner isolation + claim tests, §9 #4 response time).

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production database. Never run `prisma migrate dev/reset/deploy`, `db push`, `next build`, `next dev`, or anything that connects to a DB. `prisma generate`/`validate` only with `DATABASE_URL=postgresql://x:x@localhost:1/x`. Hand-written, additive migration; the controller verifies it on PGlite.
- Never run cron routes locally. Never send email or Telegram from tests or scripts.
- No existing file under `src/app/admin/` may change. Old CRM UI stays untouched; shared libs may gain *new* exports but existing behaviour of `applyLeadStatusChange`, `findDuplicateLead`, `createLeadRecord` must not change.
- Partner-facing copy en/de/pl/ru (never Hebrew), DE Sie / PL Państwo / RU Вы; CRM copy English.
- **Isolation:** every portal read/write goes through `src/lib/partner/scope.ts` with `requirePartner({ active: true })`; filters by the session's partnerId; portal URLs use claim ids; DTOs never include lead email/phone of leads the partner did not submit, never interaction bodies, never notes, never other partners, never our staff's private data beyond the contact card (name, role, email, phone if set).
- **Duplicate check never leaks:** the submission response and the IN_REVIEW list entry show only what the partner typed; nothing about the existing lead (owner, stage, source, dates).
- Visual: the CI from commit 34b6c878 (`portal.css`, `Brand.tsx`): light paper, Fraunces/Mulish, bronze buttons, gold contours; figures in Fraunces bronze. CRM additions use the restyled `crm.css` (e8d96f7e).
- Tests `npm test`; `npx tsc --noEmit` 0; `npm run lint` 0. Commit with explicit paths, never `git add -A`. Don't push, don't deploy.

## Decisions taken while planning

1. **Claim data model:** `PartnerClaim` gains `mode PartnerMode`, `contactMode ContactMode`, `submission Json` (what the partner typed: firstName, lastName, email, phone, language, budgetMin/Max, projects[] + free text, contact rep name/phone, comment), `outcomeNote String?` (internal, never shown). A partial unique index allows **one ACTIVE claim per lead** (`CREATE UNIQUE INDEX … ON partner_claims("leadId") WHERE state = 'ACTIVE'`; Prisma can't express it — keep it in SQL, document in schema comment).
2. **Submission decision** (pure `decideSubmission`): duplicate = `findDuplicateLead(email, phone)` (existing shared implementation; metaLeadgen consolidation is out of scope). No duplicate → **CREATE**: Lead (source PARTNER, status NEW, unassigned, partnerId, partnerMode, contactMode, rep fields, languagePreference, budget, message = comment + projects text) + claim ACTIVE + SYSTEM interaction "Submitted by partner {company/name} ({mode})". Duplicate → **REVIEW**: no new lead; claim IN_REVIEW on the existing lead with the submission JSON. The same partner re-submitting a client they already hold ACTIVE → **ALREADY_YOURS** (no new row; response: "This client is already in your list").
3. **Review (CRM):** `/crm/inbox` gets a "Partner claims" section above the leads (managers): shows the submission vs the existing lead's name/owner/stage/last contact/existing claims (computed protection status per §2). Actions: **Accept** (claim ACTIVE; lead.partnerId/partnerMode/contactMode set; fails if another ACTIVE claim exists; that one must be expired or rejected first) or **Reject** (claim REJECTED). Audited. Partner sees only "Accepted — in progress" or "Not accepted" (neutral, localized).
4. **Protection expiry** (pure `claimProtection(claimCreatedAt, lastRealContactAt, now)`): protected until max(claimCreatedAt, lastRealContactAt) + 6 months; "real contact" = interactions CALL, EMAIL_OUT, EMAIL_IN, WHATSAPP_OUT, WHATSAPP_IN. Computed, never stored; an expired ACTIVE claim is shown to staff as "expired" and no longer blocks Accept of another claim (Accept then marks the old claim EXPIRED in the same transaction).
5. **Fix leads** land in the inbox like handover leads but flagged FIX; the owner suggestion is hidden for them (spec §5.1.5 "skip sales suggestion"); the operator assigns.
6. **Partner-facing stages (7-step bar):** NEW → CONTACTED → COMMUNICATING → VIEWING_SCHEDULED → OFFER → RESERVED → CLOSED with localized partner labels (Submitted, Contacted, In talks, Viewing, Offer, Reserved, Sold); KEEP_CONTACT shown as "On hold", LOST as "Closed — not proceeding" + neutral reason category (budget / timing / chose other / unreachable / other — mapped from LostReason; never the free text).
7. **Curated milestones** (pure `milestonesFor`): from interactions — STATUS_CHANGE (stage label + date), first real contact ("First contact"), BOOKING/viewing confirmed ("Viewing scheduled"), deal created/earned/cancelled (from deals), partner messages (with body — the only free text shown), claim events. Never bodies of calls/emails/WhatsApps/notes.
8. **Response time** (pure): minutes from claim creation to first real contact after it; shown on client detail ("Contacted 42 min after submission") once present.
9. **Partner share on deals:** a new helper `partnerShareFor({ partnerMode, handoverShare, fixShare })` and `moveLead` sets `partnerSharePercent`/`partnerCommission` when the lead has an ACTIVE-claim partner (rate MISSING → partner sees "being calculated", per spec §5.3.4). Existing deals are not back-filled.
10. **Notifications outbox:** model `PartnerNotification { id, partnerId, kind STAGE|MESSAGE|CLAIM_OUTCOME, refKey String @unique, leadId?, claimId?, payload Json, createdAt, sentAt?, failedAt?, error? }`. Producers: (a) the cron scans `lead_interactions` STATUS_CHANGE rows on leads with an ACTIVE claim, newer than the claim and not yet in the outbox (`refKey = "stage:"+interactionId`), skipping rows younger than 10 min and collapsing several changes of the same lead into one email with the latest stage; (b) `PartnerMessage` creation writes `refKey = "msg:"+messageId`; (c) claim Accept/Reject writes `refKey = "claim:"+claimId+":"+state`. Sender: `/api/cron/partner-notify` (every 10 min, operator crontab, needs env `PARTNER_NOTIFY_START` like the SLA cron so history isn't mailed) sends at most 50 per run, marks `sentAt` after a successful send, `failedAt`+`error` otherwise (retry next run up to 3 attempts via a counter field `attempts Int @default(0)`). Suspended partners are skipped (marked sent with error "suspended").
11. **Submission limits:** 20 per partner per hour, 60 per IP per hour (throttle module); fields capped like registration.
12. **Projects for the form & the projects page:** published Developments (`publishStatus: "published"`) with name + town; the partner's rate per project = `resolveRate` × partner share (handover share; fix share shown alongside). Trust mode also shows our rate. MISSING rate → "on request". Estimate on submit: optional, when exactly one project + budget: `estimatePartnerCommission` labelled "approx.".
13. **Office notice:** Telegram (HTML-escaped) on every submission: "Partner client: {client name} from {partner} ({mode}) → {CREATED: /crm/inbox | REVIEW: needs review in /crm/inbox}".
14. **Portal navigation (active partners):** Overview (/home), Submit client (/submit), My clients (/clients), Projects (/projects), Profile. Pending partners keep the 3a home/profile only.

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261019110000_partner_portal_submissions/migration.sql` | Claim fields + partial unique, PartnerMessage, PartnerNotification |
| `src/lib/partner/claims.ts` | Pure: `decideSubmission`, `claimProtection`, `REAL_CONTACT_TYPES` |
| `src/lib/partner/milestones.ts` | Pure: partner stage mapping, lost-reason categories, `milestonesFor`, `responseMinutes` |
| `src/lib/partner/submission.ts` | Pure `validateSubmission`; server `submitClient(partnerSession, input)` |
| `src/lib/partner/scope.ts` | Server: `listMyClients`, `getMyClient(claimId)`, `myOverview`, `myProjects` → DTOs |
| `src/lib/partner/share.ts` | Pure `partnerShareFor` |
| `src/lib/partner/notify.ts` | Pure email builders (stage / message / claim outcome) + server `collectStageEvents`, `sendPendingNotifications` |
| `src/app/api/cron/partner-notify/route.ts` | Cron entry |
| `src/app/partner-portal/{submit,clients,clients/[id],projects}/page.tsx`, home KPIs, components | Portal UI |
| `src/lib/crm/claimReview.ts`, `src/app/crm/inbox/*`, `src/app/crm/components/{ClaimReview,CockpitPartner}.tsx`, cockpit page | CRM side |
| `src/lib/crm/moveLead.ts` | Partner share on deal creation |
| Tests: `partnerClaims`, `partnerMilestones`, `partnerSubmission`, `partnerShare`, `partnerNotify`, `partnerScopeIsolation` (pure DTO mappers + where-builders) | |

---

### Task 1: Schema and migration

**Files:** `prisma/schema.prisma`; `prisma/migrations/20261019110000_partner_portal_submissions/migration.sql`.

```prisma
// PartnerClaim — add:
  mode         PartnerMode
  contactMode  ContactMode
  submission   Json
  outcomeNote  String?
// (one ACTIVE claim per lead: partial unique index in SQL, see migration)

enum PartnerNotificationKind { STAGE MESSAGE CLAIM_OUTCOME }

model PartnerMessage {
  id           String   @id @default(uuid())
  leadId       String
  lead         Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  partnerId    String
  partner      Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  authorUserId String?
  author       User?    @relation("PartnerMessagesAuthored", fields: [authorUserId], references: [id], onDelete: SetNull)
  body         String
  createdAt    DateTime @default(now())
  @@index([leadId, createdAt])
  @@map("partner_messages")
}

model PartnerNotification {
  id        String                  @id @default(uuid())
  partnerId String
  partner   Partner                 @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  kind      PartnerNotificationKind
  refKey    String                  @unique
  leadId    String?
  claimId   String?
  payload   Json
  attempts  Int                     @default(0)
  createdAt DateTime                @default(now())
  sentAt    DateTime?
  failedAt  DateTime?
  error     String?
  @@index([sentAt, createdAt])
  @@map("partner_notifications")
}
```
Back-relations on Lead (`partnerMessages`), Partner (`messages`, `notifications`), User (`partnerMessagesAuthored`). Existing claim rows: none in production (3a not deployed) — still write the ALTER with the new NOT NULL columns guarded: `ADD COLUMN "mode" "PartnerMode" NOT NULL DEFAULT 'HANDOVER'`, then `ALTER … DROP DEFAULT` (same for contactMode `'DIRECT'`, submission `'{}'::jsonb`), so the migration is safe even if rows exist.

- [ ] Step 1: schema edits (no reformatting of unrelated models). Step 2: SQL incl. `CREATE UNIQUE INDEX "partner_claims_one_active_per_lead" ON "partner_claims"("leadId") WHERE "state" = 'ACTIVE';` with a comment. Step 3: validate/generate with the dummy URL; tsc; npm test. Step 4: commit `"Partner portal: claim submission data, one active claim per lead, partner messages, notification outbox (additive)"`. Controller: PGlite apply + `migrate diff` (the partial index will show as drift only if Prisma tries to drop it — Prisma ignores indexes it doesn't know only if declared… verify; if diff wants to drop it, the controller rules).

---

### Task 2: Pure domain logic — claims, milestones, share, submission validation

**Files:** `src/lib/partner/{claims,milestones,share}.ts`, `validateSubmission` in `src/lib/partner/submission.ts`; tests `src/lib/__tests__/partner{Claims,Milestones,Share,Submission}.test.ts`; dictionary keys for stages/milestones/lost categories/submit form/errors in all four locales.

**Interfaces:**
- `REAL_CONTACT_TYPES = ["CALL","EMAIL_OUT","EMAIL_IN","WHATSAPP_OUT","WHATSAPP_IN"] as const`.
- `decideSubmission(input: { duplicate: { leadId: string } | null; myActiveClaimLeadIds: string[] }): { kind: "CREATE" } | { kind: "REVIEW"; leadId: string } | { kind: "ALREADY_YOURS"; leadId: string }`.
- `claimProtection(input: { claimCreatedAt: Date; lastRealContactAt: Date | null; now: Date }): { protectedUntil: Date; expired: boolean }` — 6 calendar months via UTC month arithmetic (clamp day-of-month: 31 Aug + 6 mo = 28/29 Feb).
- `partnerStage(status: LeadStatusValue): { step: 1..7 | null; key: string }` and `PARTNER_STEPS` (7 keys); `lostCategory(reason: LostReasonValue | null): "budget"|"timing"|"other_choice"|"unreachable"|"other"` (map every LostReason value; test exhaustiveness).
- `milestonesFor(input: { claimCreatedAt: Date; interactions: { type: string; occurredAt: Date; metadata: unknown }[]; deals: { createdAt: Date; earnedAt: Date|null; cancelledAt: Date|null; commissionStatus: string }[]; messages: { createdAt: Date; body: string }[] }): Milestone[]` where `Milestone = { at: Date; key: string; vars?: Record<string,string>; body?: string }` — only events at/after claimCreatedAt; first real contact once; STATUS_CHANGE uses `metadata.toStatus`; sorted newest first. Bodies only for messages.
- `responseMinutes(claimCreatedAt, interactions): number | null`.
- `partnerShareFor(p: { mode: "HANDOVER"|"FIX"; handoverShare: number; fixShare: number }): number`.
- `validateSubmission(raw: unknown): { ok: true; data: SubmissionInput } | { ok: false; field: string; code: string }` — firstName (req, ≤80), lastName (≤80), email (optional but email OR phone required), phone (6–20 digits, ≤40 raw), language (en/de/pl/ru, optional), budgetMin/Max (optional whole euros 0–100,000,000, min ≤ max), mode HANDOVER|FIX, projectIds (≤10 uuids; FIX requires exactly 1), projectsText (≤300), contactMode (DIRECT|VIA_PARTNER|VIA_PARTNER_REP|VIA_CLIENT_REP; REP modes require repName ≤80 and repPhone), comment (≤2000), consent === true ("I have the client's consent to share their data" — GDPR, per agreement). Unknown keys rejected; codes are dict keys.

- [ ] Failing tests first (each function, edge cases above, lostCategory exhaustive over LOST_REASONS, Feb clamp, milestones never include non-message bodies, FIX with 2 projects rejected, REP mode without phone rejected, Hebrew never in dict) → implement → green → `npm test && tsc && lint` → commit.

---

### Task 3: Submission service, partner scope, portal Submit page

**Files:** `src/lib/partner/submission.ts` (server part), `src/lib/partner/scope.ts` (start: `myProjects`), `src/app/partner-portal/submit/page.tsx` + `components/SubmitForm.tsx` + action in `actions.ts` (or `submitActions.ts`), nav entries in PortalShell for ACTIVE partners.

Behaviour: `submitClientAction(prev, formData)` → `requirePartner({active:true})` → throttles (decision 11) → `validateSubmission` → `findDuplicateLead(email, phone)` + my ACTIVE claims → `decideSubmission` → transaction:
- CREATE: lead create (fields per decision 2; `createLeadRecord` is MANUAL-specific — write a dedicated create with source PARTNER, keeping its conventions: lower-cased email, trimmed names, CREATED LeadActivity + SYSTEM interaction), claim ACTIVE.
- REVIEW: claim IN_REVIEW (submission JSON). If an IN_REVIEW claim by the same partner for the same lead exists, don't add another (return ALREADY_YOURS-like neutral "already received").
- Afterwards: office Telegram (decision 13, background, escaped). Response: success panel ("Thank you — we have received {name}") with link to My clients; never mention review vs created.
Submit page: tabs Handover / Fix (both shares shown side by side: "Handover — you receive {handoverShare} % of our commission" / "Fix — {fixShare} %"), project multi-select (searchable list from `myProjects`), contact mode radio with conditional rep fields, consent checkbox, optional estimate line when exactly one project + budget.

- [ ] Tests for any extracted pure helpers (e.g. lead-create data mapper `leadDataFromSubmission`, Telegram notice builder). `npm test && tsc && lint`; commit.

---

### Task 4: My clients, client detail, overview KPIs, projects page

**Files:** `src/lib/partner/scope.ts` (`listMyClients`, `getMyClient`, `myOverview`), pure DTO mappers in `src/lib/partner/clientDto.ts` (+ tests), `src/app/partner-portal/{clients/page.tsx, clients/[id]/page.tsx, projects/page.tsx}`, `home/page.tsx` (active KPIs), components.

- `listMyClients(partnerId, { filter: "active"|"closed"|"lost"|"all", q?: string })`: claims of this partner (all states) newest first; ACTIVE claims show lead stage chip, CVE contact name, last milestone date, sum of partner commission by deal status; IN_REVIEW → name from submission, chip "Being checked"; REJECTED → "Not accepted"; EXPIRED → "Protection ended". Search on the partner-visible name only. Filter "remember" via cookie.
- `getMyClient(partnerId, claimId)`: 404 unless `claim.partnerId === partnerId`. ACTIVE → stage bar, milestones, messages, contact card (owner User name, email, phone if field exists), deals (project name, unit, price, partner commission or "being calculated", commission stage with dates), lost category, response time. Non-ACTIVE → only submission data + state message.
- `myOverview(partnerId)`: counts (active clients, viewings upcoming/done, in review), commission totals per stage (EXPECTED/EARNED/DEVELOPER_PAID/PAID_OUT), 5 latest milestones across clients.
- Projects page: decision 12, search by name/town, link to the public project page (`https://cyprusvipestates.com/projects/<slug>` in the partner's locale prefix if not en).
- Isolation tests (`partnerScopeIsolation.test.ts`): the where-builders always include `partnerId`; the DTO mapper drops lead email/phone/notes/interaction bodies and other partners' claims (construct objects with those fields and assert they are absent from the DTO).

- [ ] Tests → implement → `npm test && tsc && lint` → commit.

---

### Task 5: CRM side — claim review, partner card, messages, partner share on deals

**Files:** `src/lib/crm/claimReview.ts` (+ pure helpers tested), `src/app/crm/inbox/page.tsx` (claims section), `src/app/crm/components/ClaimReview.tsx`, `src/app/crm/components/CockpitPartner.tsx` + cockpit page wiring, `src/app/crm/components/InboxList.tsx` (PARTNER/FIX badge, hide suggestion for FIX), `src/lib/crm/moveLead.ts`, actions file `src/app/crm/partners/claimActions.ts` (or inbox actions).

- Claims section (managers): IN_REVIEW claims oldest first; each shows submission vs existing lead (name, owner, stage, last real contact, other claims with computed protection). Accept/Reject per decision 3 (transaction: re-check states with guarded `updateMany`, set lead partner fields on Accept, mark an expired ACTIVE claim EXPIRED, write audit, write outbox row `claim:<id>:<state>`).
- Cockpit partner card (only when lead has a claim): partner company/name, type, mode (HANDOVER/FIX), contact mode + rep, claim state + protection until, link to /crm/partners. "Message to partner" composer (≤2000 chars; visible to users who can edit the lead) → `PartnerMessage` + outbox row `msg:<id>`; list of previous messages. Copy makes clear the partner sees this text.
- `moveLead`: when creating a deal, load the lead's ACTIVE claim partner (`partnerMode` + shares) → `partnerSharePercent = partnerShareFor(...)`, `partnerCommission` via `computeDealAmounts`; add a focused test for the share selection helper.

- [ ] Tests → implement → `npm test && tsc && lint` → commit.

---

### Task 6: Notifications outbox and cron

**Files:** `src/lib/partner/notify.ts` (+ `partnerNotify.test.ts`), `src/app/api/cron/partner-notify/route.ts`, dictionary mail keys.

- Pure builders: `buildStageEmail(locale, { partnerFirstName, clientName, stageKey, link })`, `buildMessageEmail(locale, { …, body })` (body escaped, newlines → <br>), `buildClaimOutcomeEmail(locale, { …, accepted })`. CI mail layout from 3a (logo, paper card). Link = `${partnerBaseUrl()}/clients/<claimId>`.
- `collectStageEvents(now)`: STATUS_CHANGE interactions on leads with an ACTIVE claim, `occurredAt ≥ claim.createdAt`, `occurredAt ≥ PARTNER_NOTIFY_START`, `occurredAt ≤ now − 10 min`, not yet in outbox → for each lead keep only the newest; insert outbox rows for all scanned interaction ids (older ones of the same lead with `sentAt = now`, `error = "collapsed"`) so they're never reconsidered.
- `sendPendingNotifications(now, limit = 50)`: unsent, attempts < 3, partner ACTIVE (else mark sent with error "suspended"); build + `sendEmail({ to: partner user email, … })`; mark `sentAt` or increment attempts + `failedAt/error`.
- Route: `withCronLog`, `?key=$CRON_SECRET` check identical to `/api/cron/crm-sla`; skip with a logged reason when `PARTNER_NOTIFY_START` is unset.

- [ ] Tests for builders (4 locales, escaping, link, no internal fields) and for the collapse logic (pure part extracted: `planStageNotifications(rows, existingRefKeys, now, start)`). `npm test && tsc && lint`; commit.

---

### Task 7: Wrap-up

- [ ] Full checks; nothing under `src/app/admin` changed; PGlite migration check.
- [ ] Extend `scratchpad/pgscripts/serve-demo.mjs` (controller) with demo claims/messages; node smoke via hidden `$ACTION_*` fields: submit (new + known contact), list, detail, isolation (partner B can't open partner A's claim id → 404).
- [ ] Final whole-branch review (most capable model) focused on isolation, leak-free duplicate handling, outbox correctness, deal share; one fix wave; re-review; push.
- [ ] Hand-over: crontab line `*/10 * * * * curl -s "http://127.0.0.1:3000/api/cron/partner-notify?key=$CRON_SECRET" >/dev/null`, env `PARTNER_NOTIFY_START`, `CVP_RUN_MIGRATE=1`.
