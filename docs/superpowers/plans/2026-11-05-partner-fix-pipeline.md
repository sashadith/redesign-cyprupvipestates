# Partner Pipeline for FIX Clients — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partners work their FIX clients in their own portal pipeline. Their manager watches it read-only in the CRM, can nudge the partner and can accept a handover. Partner presentations get a partner photo in the footer.

**Architecture:**
- A FIX client stays a normal `Lead`. A new flag `Lead.workedByPartner` says that the partner, not staff, is working it.
- Staff mutations are refused through `canEditLead`, and staff work lists filter the lead out. The partner portal gets its own actions over the same core functions (status move, interaction log, follow-up), driven by a generalised actor that is either staff or partner.
- Handover is a `PartnerHandoverRequest` row that the manager accepts. The commission downgrade and the "keep FIX" override flip `Lead.partnerMode`, which already drives `partnerShareFor`.

**Tech Stack:** Next.js 14 App Router (server actions), Prisma/Postgres, node:test via `npm test`, partner i18n in `src/lib/partner/i18n/{en,de,pl,ru}.ts`.

**Spec:** `docs/superpowers/specs/2026-11-05-partner-fix-pipeline-design.md` (German). Sections 3.2, 7 and 11 override earlier sections where they differ.

## Global Constraints

- Migrations are additive only. Every PR that touches `prisma/` is deployed with `CVP_RUN_MIGRATE=1`. Never deploy unasked.
- No data is deleted and no existing rows are rewritten. The only partner lead in prod is "Katerin Test" (HANDOVER); no backfill.
- The system never sends email or WhatsApp to a partner's client. A "WhatsApp öffnen" `wa.me` link opened on the partner's own device is allowed.
- No Claude/MCP/AI tools for partners.
- Partner-portal copy goes in en/de/pl/ru with no exclamation marks. CRM copy is English. The CRM UI uses no emojis (Telegram may).
- Before handover, staff (including the manager) never change a partner-worked lead: no status, data, presentation or send.
- A LOST FIX client nets 0 points: its points are revoked for every lost reason, whoever set LOST. HANDOVER keeps today's rule (INVALID/UNREACHABLE revoke; NO_RESPONSE keeps points).
- The partner may set every stage of his FIX client, including OFFER/RESERVED/CLOSED. LOST needs a reason.
- A handover from VIEWING_SCHEDULED or later keeps FIX. An earlier one downgrades to HANDOVER, takes effect on acceptance, and only after the partner confirms a warning that shows his real shares.
- The manager may set "keep FIX" per lead at or after acceptance, but not once the lead has a non-cancelled deal.
- Server actions guard themselves: `requirePartner({ active: true })` in the portal, CRM role checks in the CRM, because middleware skips `/admin` and partner routes.
- TS limits: no `u` regex flag and no Set spread (use `Array.from`).
- Times are shown in Europe/Nicosia unless they are the lead's local time.

## Review Focus

1. **Partner acts on a lead that is no longer his.** A stale tab after handover, a claim that expired or was rejected, or another partner's claimId. Every portal action refuses this with a localized "client no longer in your pipeline". Pinned in Task 2 (`partnerMayWork`), used by every Task 4 function.
2. **Staff action paths that bypass `canEditLead`.** The old `/admin/crm` actions, Telegram nag snooze, MCP tools, inbound email/WhatsApp auto-status, and the follow-up cadence. None may change a partner-worked lead's status or follow-up. Inbound messages may still be logged. Pinned in Task 3.
3. **Double submit or race on handover accept vs. a partner move.** Accept and partner moves take the same `FOR UPDATE` lead lock, so there is never an accepted handover with `workedByPartner` still true, nor a downgrade applied twice. Pinned in Task 11.
4. **Partner sets RESERVED with a project that isn't published, or a price ≤ 0.** He gets the same errors as staff, localized. No deal is created. Pinned in Task 7 (error mapping, with a test that each `moveLeadCore` deal error has a `pipeline.err.*` key).
5. **The partner timeline leaks staff-internal rows** (staff NOTE, staff CALL/EMAIL, SYSTEM audit lines). Only the allowed types appear. Pinned in Task 6.

---

## PR 1 — Data model, read-only for staff, partner pipeline

### Task 1: Schema for partner-worked leads

**Files:**
- Modify: `prisma/schema.prisma`, the `Lead`, `LeadInteraction`, `Deal`, `PartnerUser` and `PartnerNotificationKind` blocks
- Create: `prisma/migrations/20261105090000_partner_worked_leads/migration.sql`

**Interfaces:**
- Produces:
  - `Lead.workedByPartner Boolean @default(false)` plus `@@index([partnerId, workedByPartner])`
  - `LeadInteraction.createdByPartnerUserId String?`, relation `createdByPartnerUser PartnerUser? @relation("PartnerAuthoredInteractions", onDelete: SetNull)`
  - `Deal.createdByPartnerUserId String?`, same pattern, relation name `"PartnerCreatedDeals"`
  - enum value `PartnerNotificationKind.FOLLOW_UP_DUE`, appended last

- [ ] Step 1: Edit the schema. Generate the migration SQL by hand: `ALTER TABLE ... ADD COLUMN`, `ALTER TYPE "PartnerNotificationKind" ADD VALUE 'FOLLOW_UP_DUE'`, the FKs and the index.
- [ ] Step 2: Run `npx prisma validate && npx prisma generate && npx tsc --noEmit -p .`. Expected: clean.
- [ ] Step 3: Commit `"Partner pipeline: schema for partner-worked leads"`.

### Task 2: Which accepted FIX claims the partner works

**Files:**
- Create: `src/lib/partner/pipeline/rules.ts`
- Modify: `src/lib/crm/claimReview.ts` (`acceptClaim`, the `tx.lead.update` call)
- Test: `src/lib/partner/__tests__/pipelineRules.test.ts`

**Interfaces:**
- Produces:
  - `workedByPartnerOnAccept(mode: "HANDOVER" | "FIX", assignedToId: string | null): boolean`
  - `partnerMayWork(lead: { partnerId: string | null; workedByPartner: boolean; deletedAt: Date | null }, partnerId: string): boolean`

- [ ] Step 1: Write the tests:
  - `workedByPartnerOnAccept("FIX", null) === true`
  - `("FIX", "u1") === false`
  - `("HANDOVER", null) === false`
  - `partnerMayWork` is false for another partnerId, for `workedByPartner: false`, and for `deletedAt` set; true otherwise.
- [ ] Step 2: Run `npm test`. Expected: FAIL, module missing.
- [ ] Step 3: Implement both functions. In `acceptClaim`, select `assignedToId` and write `workedByPartner: workedByPartnerOnAccept(claim.mode, lead.assignedToId)`. Extend the SYSTEM row's metadata with `workedByPartner`.
- [ ] Step 4: Run `npm test`. Expected: PASS.
- [ ] Step 5: Commit.

### Task 3: Staff cannot change partner-worked leads; work lists skip them

**Files:**
- Modify:
  - `src/lib/crm/access.ts`: `LeadOwner` becomes `{ assignedToId: string | null; workedByPartner: boolean }` (required, so the compiler finds every caller)
  - every `canEditLead(` caller (15 call sites), adding `workedByPartner: true` to its select
  - `src/lib/crm/leadBucket.ts`
  - `src/lib/crm/pipelineQuery.ts`, `src/lib/crm/inboxWhere.ts`, `src/app/crm/today/page.tsx`, `src/lib/crm/leadNagSend.ts`, `src/app/api/cron/crm-sla/route.ts`, `src/lib/actionCenter/rules/crm.ts`, `src/lib/mcp/tools/worklist.ts`
  - `src/lib/crm/followUpCadence.ts`
  - `src/app/admin/actions.ts` (old CRM lead mutations)
  - `src/lib/emailInbound/` and `src/lib/openwa/trackMessage.ts`, wherever they change status
  - `src/app/crm/components/CockpitHeader.tsx`
- Test: `src/lib/crm/__tests__/partnerWorkedAccess.test.ts`

**Interfaces:**
- Produces:
  - `canEditLead(u, { assignedToId, workedByPartner })`, which returns false when `workedByPartner`
  - `EXCLUDE_PARTNER_WORKED: Prisma.LeadWhereInput = { workedByPartner: false }`
  - `PARTNER_WORKED_READONLY = "This client is worked by the partner — read only until they hand it over."`

- [ ] Step 1: Write the tests:
  - `canEditLead(owner, { assignedToId: owner.id, workedByPartner: true }) === false`
  - an admin gets false too
  - with `workedByPartner: false`, today's results are unchanged
  - `EXCLUDE_PARTNER_WORKED` deep-equals `{ workedByPartner: false }`
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement the change:
  - `canViewLead` is unchanged, so the lead stays visible in search and detail.
  - Merge `EXCLUDE_PARTNER_WORKED` into the board, side list, inbox, today, nag, SLA, action-center and MCP-worklist queries.
  - `applyFollowUpCadence`: return early when the lead has `workedByPartner`.
  - Old `/admin` mutations and inbound auto-status: skip status/follow-up writes on partner-worked leads, but keep logging the interaction.
  - Mutating actions return `PARTNER_WORKED_READONLY`.
  - The cockpit shows a banner "Worked by partner {name} — read only" and hides the edit, log, move and send controls.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .`. Expected: PASS and clean.
- [ ] Step 5: Commit.

### Task 4: Actor that can be a partner; partner versions of move, log and follow-up

**Files:**
- Create: `src/lib/crm/leadActor.ts`
- Modify:
  - `src/lib/crm/updateLeadStatus.ts` (`applyLeadStatusChange`)
  - `src/lib/crm/logInteraction.ts` (`logLeadInteraction`)
  - `src/lib/crm/followUpCadence.ts` (`setManualFollowUp`)
  - `src/lib/crm/moveLead.ts`
- Create: `src/lib/partner/pipeline/actions.ts`
- Test: `src/lib/crm/__tests__/leadActor.test.ts`, `src/lib/partner/__tests__/pipelineActions.test.ts` (pure parts)

**Interfaces:**
- Produces:
  - `type PartnerActor = { partnerUserId: string; partnerId: string; userName: string }`
  - `type LeadActor = EmailActor | PartnerActor`
  - `isPartnerActor(a: LeadActor): a is PartnerActor`
  - `authorColumns(a: LeadActor): { createdByUserId: string | null; createdByPartnerUserId: string | null; createdByName: string }`
  - `applyLeadStatusChange(actor: LeadActor, …)`, `logLeadInteraction(actor: LeadActor, …)` and `setManualFollowUp(leadId, at, actor: LeadActor)`, all writing the author through `authorColumns`. A partner's NOTE writes no `LeadActivity` row (that table is staff-only).
  - `moveLead` keeps its signature. Its transaction body moves into `moveLeadCore(actor: LeadActor, leadId, to, input, authorize: (lead: { partnerId: string | null; assignedToId: string | null; workedByPartner: boolean; deletedAt: Date | null }) => boolean): Promise<MoveResult>`. The deal's `createdById` / `createdByPartnerUserId` come from the actor.
  - In `src/lib/partner/pipeline/actions.ts`:
    - `movePartnerLead(actor: PartnerActor, claimId: string, to: LeadStatusValue, input: { deal?: DealInput; lostReason?: LostReasonValue; viewingScheduledAt?: Date }): Promise<MoveResult>`
    - `logPartnerInteraction(actor: PartnerActor, claimId: string, input: LogInteractionInput)`
    - `setPartnerFollowUp(actor: PartnerActor, claimId: string, at: Date | null)`
    - `editPartnerClient(actor: PartnerActor, claimId: string, raw: unknown)`, which validates with `validateLeadEdit` and runs the same `emailEditData` as the cockpit.
  - Each resolves `claimId` to the lead of an ACTIVE claim of `actor.partnerId` and authorizes with `partnerMayWork`. Otherwise it returns `{ error: "NOT_IN_PIPELINE" }`, a key the portal localizes.

- [ ] Step 1: Write the tests:
  - `authorColumns({ userId: "u", userName: "A" })` gives `{ createdByUserId: "u", createdByPartnerUserId: null, createdByName: "A" }`.
  - For a partner actor, the reverse.
  - `isPartnerActor` holds for each.
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement. Staff behaviour and tests stay unchanged. `VIEWING_SCHEDULED` requires `viewingScheduledAt` for the partner exactly as `crm_update_lead` does.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .`. Expected: all existing tests and the new ones pass.
- [ ] Step 5: Commit.

### Task 5: Points — a LOST FIX client nets 0

**Files:**
- Modify: `src/lib/partner/ratingFlow.ts` (`isRevokedClaim`), its callers in `src/lib/partner/ratingStore.ts` (select `mode`)
- Test: extend the existing ratingFlow tests in `src/lib/partner/__tests__/`

**Interfaces:**
- Produces: `isRevokedClaim(c: { state; mode: "HANDOVER" | "FIX"; lead: {…} | null } | null): boolean`

- [ ] Step 1: Write the tests:
  - FIX + LOST + `NO_RESPONSE` → true
  - FIX + LOST + `BUDGET` → true
  - HANDOVER + LOST + `NO_RESPONSE` → false
  - HANDOVER + LOST + `UNREACHABLE` → true
  - FIX + CONTACTED → false
  - Revival: a FIX claim that was revoked while LOST and is now CONTACTED is granted again by the grant pass. Assert through the pure grant planner, the function that filters with `isRevokedClaim` before planning events.
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement. If the revival test fails because revoked refKeys are kept somewhere, fix that path so points come back.
- [ ] Step 4: Run `npm test`. Expected: PASS.
- [ ] Step 5: Commit.

### Task 6: Partner pipeline — data

**Files:**
- Create: `src/lib/partner/pipeline/store.ts`, `src/lib/partner/pipeline/timeline.ts` (pure)
- Test: `src/lib/partner/__tests__/pipelineTimeline.test.ts`

**Interfaces:**
- Produces:
  - `type PipelineCard = { claimId: string; leadId: string; name: string; status: LeadStatusValue; since: Date; nextFollowUpAt: Date | null; overdue: boolean; localTime: LeadTimeSummary; handedOver: boolean; lastEntryAt: Date | null }`
  - `listPipeline(partnerId: string, now: Date): Promise<PipelineCard[]>`: ACTIVE FIX claims of the partner. Rows with `workedByPartner: false` come back with `handedOver: true`.
  - `getPipelineClient(partnerId: string, claimId: string, now: Date): Promise<PipelineClient | null>`, with the lead fields from Task 4's edit plus `hints` (`leadHints`), `localTime`, presentations (`myClientPresentations`), the timeline and `canWork`.
  - `partnerTimeline(rows: { type; createdByUserId; createdByPartnerUserId; metadata; … }[], messages: RawMessage[]): TimelineEntry[]`. It keeps rows authored by a partner user, `STATUS_CHANGE`, `PRESENTATION_EVENT` and partner messages. Everything else, including staff NOTE/CALL/EMAIL/WHATSAPP and SYSTEM, is dropped.
- Also covered: Review Focus 4. The deal input is validated by `moveLeadCore`, and the portal maps its English errors to i18n keys `pipeline.err.*`.

- [ ] Step 1: Write the tests. Given one row of each type (staff NOTE, partner NOTE, STATUS_CHANGE, SYSTEM, PRESENTATION_EVENT, staff CALL) plus one message, `partnerTimeline` returns exactly the partner NOTE, STATUS_CHANGE, PRESENTATION_EVENT and the message, newest first.
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement the store over Prisma (`listPipeline` caps at 500 rows) and the pure timeline.
- [ ] Step 4: Run `npm test`. Expected: PASS.
- [ ] Step 5: Commit.

### Task 7: Partner pipeline — portal pages and actions

**Files:**
- Create:
  - `src/app/partner-portal/pipeline/page.tsx` (board on desktop: one column per stage plus "handed over"; on mobile a list with a stage filter)
  - `src/app/partner-portal/pipeline/[claimId]/page.tsx`
  - `src/app/partner-portal/pipelineActions.ts`
  - `src/app/partner-portal/components/pipelineBits.tsx`
- Modify:
  - `src/app/partner-portal/components/PortalShell.tsx` (nav item "Pipeline", only when the partner has ≥1 FIX claim)
  - `src/lib/partner/i18n/{en,de,pl,ru}.ts` (`pipeline.*` keys)
  - `src/app/partner-portal/portal.css`
- Test: `src/lib/partner/__tests__/pipelineI18n.test.ts`

**Interfaces:**
- Consumes: Task 4 functions, Task 6 store
- Produces: server actions `movePipelineAction`, `logPipelineAction`, `followUpPipelineAction`, `editPipelineClientAction`. Each calls `requirePartner({ active: true })` and builds a `PartnerActor` from the session.
- Detail page:
  - **Data and hints:** client data form; hints (landline, currency, zone); the lead's local clock with the call light.
  - **Stage move:** LOST requires a reason from `LOST_REASONS` with partner labels. VIEWING_SCHEDULED requires a date. RESERVED/CLOSED ask for project, unit and price.
  - **Logging:** log form with call outcomes.
  - **Follow-up:** date/time with the lead's local time and `weekLabel`.
  - **Selections:** the client's presentations, a "new selection" link to the existing presentation flow, link copy and a `wa.me` open.
  - **Timeline.**
  - **Handed-over clients:** read-only header and no forms.
- On RESERVED/CLOSED by the partner: Telegram to the manager via `sendOfficeMessage(manager.telegramChatId, …)` (fallback: owner): "Partner {name} set {client} to {stage}: {project}, {price} €. Please check the deal." with a CRM link.

- [ ] Step 1: Write the tests:
  - Every `pipeline.*` key in `en` exists in `de`, `pl` and `ru`, and no value contains "!".
  - `pipelineErrorKey(msg)` maps each deal/lost-reason error string of `moveLeadCore` ("Enter the deal: project, unit and price.", "Enter a valid price in whole euros.", "Project not found.", "Choose why the lead was lost.") to a `pipeline.err.*` key, and anything unknown to `pipeline.err.generic`.
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement the pages, actions, copy and CSS.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .` and lint the changed files. Expected: clean.
- [ ] Step 5: Verify on the testbed (`testbed-ui-verification` memory): log in as a throwaway partner with one FIX claim, move NEW → CONTACTED, log a call, set a follow-up, then hand-craft `workedByPartner=false` and see the read-only view. Never use the prod DB for this.
- [ ] Step 6: Commit.

### Task 8: Follow-up-due reminders to the partner

**Files:**
- Modify:
  - `src/lib/partner/alerts.ts`
  - `src/app/api/cron/partner-alerts/route.ts`
  - `src/lib/partner/notifySend.ts` and the i18n files (rendering `FOLLOW_UP_DUE`)
  - `src/lib/partner/notifyPrefs.ts` (gate on `notifyReminders`)
- Test: extend the alerts tests

**Interfaces:**
- Produces:
  - `type DueFollowUp = { claimId: string; partnerId: string; leadId: string; nextFollowUpAt: Date }`
  - `planFollowUpDue(input: { leads: DueFollowUp[]; now: Date }): PlannedAlert[]`, which emits for `nextFollowUpAt <= now`, kind `FOLLOW_UP_DUE`, `refKey = followup:${leadId}:${cyDate(now)}` (so at most one per client per day), and payload `{ nextFollowUpAt }`.
- Sending uses the existing partner-notify path, so quiet hours and the channel choice apply unchanged.

- [ ] Step 1: Write the tests:
  - a due item → one alert with that refKey
  - a future one → none
  - the same lead twice on one day → the same refKey
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement. The cron query selects the partner's FIX leads with `workedByPartner: true`.
- [ ] Step 4: Run `npm test`. Expected: PASS.
- [ ] Step 5: Commit, then open PR 1.

## PR 2 — Handover to the manager

### Task 9: Handover schema and rules

**Files:**
- Modify: `prisma/schema.prisma`
- Create:
  - `prisma/migrations/20261106090000_partner_handover/migration.sql`
  - `src/lib/partner/pipeline/handoverRules.ts`
- Test: `src/lib/partner/__tests__/handoverRules.test.ts`

**Interfaces:**
- Produces:
  - Model `PartnerHandoverRequest`:
    - `id`; `leadId` (FK Cascade); `claimId` (FK Cascade); `partnerId`; `partnerUserId`
    - `state` enum `HandoverState { OPEN ACCEPTED WITHDRAWN }`
    - `note String?`; `stageAtRequest LeadStatus`; `downgrade Boolean`
    - `keepFix Boolean @default(false)`; `keepFixById String?`; `keepFixAt DateTime?`
    - `acceptedById String?`; `acceptedAt DateTime?`; `withdrawnAt DateTime?`
    - `remindedAt DateTime?`; `escalatedAt DateTime?`; `createdAt`
    - partial unique index: one OPEN per lead, in raw SQL in the migration
  - `HANDOVER_KEEPS_FIX_FROM: LeadStatusValue = "VIEWING_SCHEDULED"`
  - `handoverPlan(lead: { status: LeadStatusValue; partnerMode: "HANDOVER" | "FIX" | null; hasLiveDeal: boolean }): { downgrade: boolean; noDowngradeBecauseDeal: boolean }`
    - `downgrade` is true iff `partnerMode === "FIX"`, the status ranks before VIEWING_SCHEDULED (NEW, CONTACTED, COMMUNICATING, KEEP_CONTACT), and there is no live deal.
  - `mayKeepFix(hasLiveDeal: boolean): boolean`

- [ ] Step 1: Write the tests:
  - CONTACTED/FIX/no deal → `{ downgrade: true, noDowngradeBecauseDeal: false }`
  - VIEWING_SCHEDULED → no downgrade
  - CLOSED → no downgrade
  - CONTACTED with a deal → `{ downgrade: false, noDowngradeBecauseDeal: true }`
  - `mayKeepFix(true) === false`
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement the schema, migration and rules.
- [ ] Step 4: Run `npm test && npx prisma validate`. Expected: PASS.
- [ ] Step 5: Commit.

### Task 10: Partner requests and withdraws a handover

**Files:**
- Create: `src/lib/partner/pipeline/handover.ts`
- Modify: `src/app/partner-portal/pipelineActions.ts`, `src/app/partner-portal/pipeline/[claimId]/page.tsx`, the i18n files
- Test: `src/lib/partner/__tests__/handoverWarning.test.ts`

**Interfaces:**
- Produces:
  - `requestHandover(actor: PartnerActor, claimId: string, note: string | null, confirmedDowngrade: boolean): Promise<{ ok: true } | { error: string; need?: "confirmDowngrade"; fixShare?: number; handoverShare?: number }>`
    - Under the lead lock it computes `handoverPlan`. If a downgrade is due and `confirmedDowngrade` is false, it returns `need: "confirmDowngrade"` with the partner's real shares.
    - Otherwise it creates an OPEN request, writes a SYSTEM interaction "Handover requested by partner {name}" (with `createdByPartnerUserId`), and sends the manager a Telegram: name, stage, note and "(downgrade to Handover on acceptance)" when applicable.
  - `withdrawHandover(actor: PartnerActor, requestId: string)`: OPEN → WITHDRAWN.
  - `handoverWarning(locale: PartnerLocale, fixShare: number, handoverShare: number): string`. The en copy is: "Do you really want to hand this client over now? They are not at the viewing stage yet. Once you confirm, the client moves from Fix to Handover and your commission drops from {fix} % to {handover} %." The de copy is: "Willst du den Kunden wirklich jetzt übergeben? Er ist noch nicht bei der Besichtigung. Nach der Bestätigung wird er von Fix auf Handover umgestellt, deine Provision sinkt von {fix} % auf {handover} %." Write pl and ru in the same meaning. No "!".

- [ ] Step 1: Write the test: `handoverWarning("de", 50, 30)` contains "50 %" and "30 %" and no "!"; the same for all four locales.
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement. The UI flow is the button, then (if needed) a confirm dialog with the warning, then a resubmit with `confirmedDowngrade=1`. An OPEN request shows "Waiting for your manager" and a withdraw button.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .`. Expected: PASS.
- [ ] Step 5: Commit.

### Task 11: Manager accepts the handover; keep-FIX override; escalation

**Files:**
- Create: `src/lib/crm/handoverReview.ts`, `src/app/crm/partners/handoverActions.ts`
- Modify:
  - `src/app/crm/today/page.tsx` and `src/app/crm/inbox/page.tsx` (section "Handover requests")
  - `src/app/crm/components/CockpitPartner.tsx` (the keep-FIX toggle)
  - `src/app/api/cron/crm-sla/route.ts` (escalation)
- Test: `src/lib/crm/__tests__/handoverReview.test.ts` (pure decision parts)

**Interfaces:**
- Produces:
  - `acceptHandover(actor: SessionCrmUser, requestId: string, keepFix: boolean): Promise<ReviewResult>`
    - Allowed for admins and for the partner's `managerUserId`; if the partner has no manager, any admin.
    - Runs in one transaction with `SELECT … FOR UPDATE` on the lead. It re-checks state OPEN and recomputes the plan on fresh data.
    - Sets the request ACCEPTED, `lead.workedByPartner = false`, `assignedToId = actor.id`, and `partnerMode = "HANDOVER"` iff `downgrade && !keepFix`.
    - Writes a SYSTEM interaction and an audit entry, plus a `PartnerNotification` kind `STAGE` with payload `{ handover: "accepted", keepFix, downgraded }`.
  - `setKeepFix(actor: SessionCrmUser, leadId: string, keep: boolean): Promise<ReviewResult>`
    - Refused when `!mayKeepFix(hasLiveDeal)` with "The deal already exists — its commission share is fixed."
    - Flips `partnerMode` (keep → FIX; un-keep → HANDOVER, only if the accepted request had `downgrade`).
    - Records `keepFixById` and `keepFixAt`; writes a SYSTEM row and a partner notification.
  - `escalationDue(req: { createdAt: Date; remindedAt: Date | null; escalatedAt: Date | null }, now: Date): "remind" | "escalate" | null`: "remind" at 24 h, "escalate" (all admins) at 48 h. Each fires once and is stamped on the row.
- Covers Review Focus 3: the same lock as `movePartnerLead`. A partner move that arrives after acceptance fails `partnerMayWork` and returns NOT_IN_PIPELINE.

- [ ] Step 1: Write the tests:
  - `escalationDue` at 23 h → null; at 25 h → "remind"; at 25 h with `remindedAt` set → null; at 49 h → "escalate"
  - a decision helper `acceptOutcome({ downgrade, keepFix })` maps the four combinations to the target `partnerMode`
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .`. Expected: PASS.
- [ ] Step 5: Testbed check: request (with downgrade) → accept without keepFix → `partnerMode` HANDOVER; toggle keep-FIX → FIX; create a deal → the toggle is refused.
- [ ] Step 6: Commit, then open PR 2.

## PR 3 — Manager view and hints

### Task 12: Partner pipelines view in the CRM

**Files:**
- Create:
  - `src/lib/crm/partnerPipelines.ts` (query + pure light)
  - `src/app/crm/partner-pipelines/page.tsx`
- Modify: `src/app/crm/components/Shell.tsx` (nav "Partner pipelines" for admins and for users who manage ≥1 partner)
- Test: `src/lib/crm/__tests__/partnerPipelineLight.test.ts`

**Interfaces:**
- Produces:
  - `type LightThresholds = { amberOverdueDays: number; amberQuietDays: number; redOverdueDays: number; redQuietDays: number }`
  - `thresholdsFromEnv(): LightThresholds`, from env `PARTNER_PIPELINE_AMBER="1,7"` and `PARTNER_PIPELINE_RED="3,14"` (overdue days, quiet days; these are also the defaults)
  - `partnerLeadLight(l: { nextFollowUpAt: Date | null; lastEntryAt: Date | null; createdAt: Date }, now: Date, t: LightThresholds): "green" | "amber" | "red"`
    - Red if follow-up overdue ≥ 3 days or quiet ≥ 14 days; amber if overdue ≥ 1 day or quiet ≥ 7 days; else green.
    - "Quiet" counts from the last partner-authored interaction, or from `createdAt` if there is none.
  - `loadPartnerPipelines(user: SessionCrmUser, filter: { partnerId?: string }): Promise<{ partner: { id; name }; cards: (PipelineCard & { light; lastPartnerEntry: string | null; presentationViews: number; lastOpenedAt: Date | null })[] }[]>`. Non-admins see only partners where they are `managerUserId`; admins see all, with a "no manager" group.
- Page: grouped by partner, columns per stage, read-only cards linking to the lead detail (read-only banner from Task 3).
- Partner approval (`src/app/crm/partners/actions.ts`, the ACTIVE update): when the partner has no `managerUserId`, set it to the approving user. The terms editor can still change it (spec section 2).

- [ ] Step 1: Write the tests for `partnerLeadLight`:
  - overdue 2 days → amber
  - overdue 3 days → red
  - quiet 8 days → amber
  - quiet 14 days → red
  - fresh → green
  - `thresholdsFromEnv` with junk env → defaults
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .`. Expected: PASS.
- [ ] Step 5: Commit.

### Task 13: "Hint to partner" and the Monday summary

**Files:**
- Modify:
  - `src/lib/crm/claimReview.ts` (`sendPartnerMessage`: allow the partner's manager and admins on a partner-worked lead; today it requires `canEditLead`, which Task 3 makes false)
  - `src/app/crm/partner-pipelines/page.tsx` (hint form with templates)
  - `src/app/api/cron/crm-sla/route.ts`
- Create: `src/lib/crm/partnerPipelineDigest.ts`
- Test: `src/lib/crm/__tests__/partnerPipelineDigest.test.ts`

**Interfaces:**
- Produces:
  - `HINT_TEMPLATES` (English in the CRM; the text is sent as written): `["Your follow-up with this client is overdue.", "The client opened your selection — a good moment to call."]`
  - `mayHintPartner(user: { id: string; isOwner: boolean; role: string }, partner: { managerUserId: string | null }): boolean`
  - `managerDigest(cards: { partnerName: string; light: "green" | "amber" | "red"; handedOverThisWeek: boolean; newThisWeek: boolean }[]): string | null`. Per partner it prints one line, e.g. "Anna Muster: 3 overdue · 1 handed over · 2 new". It returns null when every count is zero.
  - Sent Mondays in the 09:00 Nicosia crm-sla run to each manager's `telegramChatId` via `sendOfficeMessage`, once per ISO week (dedupe key in the existing SLA log/state).

- [ ] Step 1: Write the tests:
  - `mayHintPartner` is true for the manager and for admins, false for another editor
  - `managerDigest` formats two partners and returns null for all-green with no events
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .`. Expected: PASS.
- [ ] Step 5: Commit, then open PR 3.

## PR 4 — Partner photo in the presentation footer

### Task 14: Partner photo

**Files:**
- Modify:
  - `prisma/schema.prisma` (`Partner.brandPhoto Bytes?`, `brandPhotoType String?`, `brandPhotoUpdatedAt DateTime?`)
  - `src/app/partner-portal/brandActions.ts` (upload/remove, same limits and type checks as the logo)
  - `src/app/partner-portal/profile/page.tsx`
  - `src/lib/partner/presentationBranding.ts` (`hasPhoto`, `photoUpdatedAt`, `initials`)
  - `src/app/c/[token]/page.tsx`
  - `src/app/c/[token]/PartnerClosing.tsx`
  - the i18n files
- Create:
  - `prisma/migrations/20261107090000_partner_brand_photo/migration.sql`
  - `src/app/c/[token]/photo/route.ts` (mirror of `logo/route.ts`)
- Test: extend the `presentationBranding` tests

**Interfaces:**
- Produces:
  - `brandInitials(p: Pick<PresentationBrandPartner, "brandName" | "company" | "firstName" | "lastName">): string`, two letters from `brandDisplayName`
  - Branding gains `photoUrl: string | null` (`/c/{token}/photo?v={updatedAt}` when a photo is stored)
  - `PartnerClosing` renders the photo (or an initials circle), then name, phone, email and website. The logo stays at the top as today. This applies to all partner presentations, Handover too.

- [ ] Step 1: Write the tests:
  - `brandInitials({ brandName: "Anna Muster" })` → "AM"; a company-only name gives its first two words' initials
  - branding with `hasPhoto: false` → `photoUrl: null`
- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npm test && npx tsc --noEmit -p .`. Expected: PASS.
- [ ] Step 5: Check on the testbed: upload a photo, open the `/c/{token}` page, see the footer photo; remove it and see the initials.
- [ ] Step 6: Commit, then open PR 4.

## Deploy notes

- PR 1, PR 2 and PR 4 carry migrations, so deploy them with `CVP_RUN_MIGRATE=1`. PR 3 has none.
- Deploy in order 1 → 2 → 3; PR 4 is independent.
- Optional env: `PARTNER_PIPELINE_AMBER`, `PARTNER_PIPELINE_RED`.
