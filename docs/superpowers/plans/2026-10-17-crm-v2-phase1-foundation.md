# CRM v2 Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the data and logic foundation for CRM v2 and the partner portal (one status source with the new RESERVED stage, lost reasons, per-employee visibility rights, deals and commission rates) without changing how the old CRM behaves for anyone today.

**Architecture:** Additive Prisma schema changes with hand-written SQL migrations; pure, unit-tested logic modules in `src/lib/crm/` (status, access, commission); the old admin CRM and the MCP tools are rewired to read status lists from the single module and to scope leads through the access layer. No new UI in this phase.

**Tech Stack:** Next.js 14.2 App Router, Prisma 5.22 on PostgreSQL, NextAuth v5 beta, Zod, Node's built-in test runner via `tsx` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` (sections 2, 3, 4, 5.3, 8, 10 Phase 1).

## Global Constraints

- **The local `.env.local` DATABASE_URL is the LIVE production database.** Never run `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, `next build` or any script that writes to the DB. `npx prisma generate` and `npx prisma validate` are safe (no DB access). Migrations are written by hand as SQL and applied only by the production deploy.
- Schema changes are **additive only**: new enum values, new nullable or defaulted columns, new tables. Nothing existing is renamed or dropped.
- The deploy that ships this phase must run with `CVP_RUN_MIGRATE=1`. Deploying is the operator's decision; finish with "ready to deploy", never deploy.
- The shared working tree `/Users/sashadith/cvp-analysis` is used by other sessions: work only in this worktree, stage explicit paths, never `git add -A`, push with `git push origin HEAD`.
- Admin and internal copy is English.
- Existing behaviour for current users must not change: every existing user keeps seeing and editing every lead.
- Tests: `npm test` runs `node --import tsx --test` on `src/lib/__tests__/*.test.ts` and `src/lib/mcp/__tests__/*.test.ts`. Tests must not touch the DB; test pure functions.
- Type check with `npx tsc --noEmit` (no `typecheck` script exists).

## Decisions taken while planning (deviations from the spec draft, now reflected in the spec)

1. **RESERVED ships in one deploy, not two.** The September outage happened because the DB held an enum value the *deployed client* did not know. Here the Prisma schema, the migration and every reader ship together; the migration only adds the value; no row can hold RESERVED until the new code (the only writer) is live.
2. **CommissionRate keys on `DeveloperAccount`, not the public `Developer`.** Every `Development` has a required `developerAccountId`; the public developer link (`developerTranslationGroupId`) is optional and missing for some accounts. Rates are admin-only, so the admin label is acceptable here.
3. **`lastRealContactAt` is not a stored column.** It is computed from `LeadInteraction` when the partner claim logic needs it (Phase 3). No write sites to maintain.
4. **Timeline write consolidation (LeadActivity → LeadInteraction) moves to the cutover cleanup.** The old CRM still reads `LeadActivity`; touching 25 write sites now is risk without benefit.
5. **Lost reason is optional server-side in Phase 1.** The old dropdown cannot send one. The new CRM UI (Phase 2) makes it mandatory.
6. **Existing users get `canSeeColleagues = canEditColleagues = true` in the migration**, new users default to `false`.

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Modify: `RESERVED`, `LostReason`, `Lead.lostReason`, User rights fields, `Deal`, `CommissionRate`, `CommissionStatus`, `RateSource` |
| `prisma/migrations/20261018100000_crm_v2_status/migration.sql` | Create: RESERVED + LostReason + lostReason column |
| `prisma/migrations/20261018100100_crm_v2_user_rights/migration.sql` | Create: user rights columns + backfill |
| `prisma/migrations/20261018100200_crm_v2_deals/migration.sql` | Create: Deal, CommissionRate tables and enums |
| `src/lib/crm/leadStatus.ts` | Create: the single source of status order, groups, labels, lost reasons |
| `src/lib/crm/access.ts` | Create: who may see / edit which lead (pure) |
| `src/lib/crm/accessUser.ts` | Create: load a `CrmUser` from the DB by id (thin Prisma wrapper) |
| `src/lib/crm/commission.ts` | Create: rate resolution, deal amounts, commission status transitions, estimate (pure) |
| `src/lib/crm/updateLeadStatus.ts` | Modify: import statuses from leadStatus.ts, accept `lostReason` |
| Old CRM files (list in Task 2) | Modify: import from leadStatus.ts, add RESERVED styling |
| `src/lib/mcp/tools/*.ts` (list in Task 5) | Modify: scope by access layer, `lostReason` on update |
| `src/lib/__tests__/crmLeadStatus.test.ts` | Create |
| `src/lib/__tests__/crmStatusSitesUseCentralList.test.ts` | Create |
| `src/lib/__tests__/crmLostReason.test.ts` | Create |
| `src/lib/__tests__/crmAccess.test.ts` | Create |
| `src/lib/__tests__/crmCommission.test.ts` | Create |

---

### Task 1: Status source of truth + RESERVED and LostReason in the schema

**Files:**
- Modify: `prisma/schema.prisma` (enum `LeadStatus` at ~line 49, model `Lead` at ~line 765)
- Create: `prisma/migrations/20261018100000_crm_v2_status/migration.sql`
- Create: `src/lib/crm/leadStatus.ts`
- Test: `src/lib/__tests__/crmLeadStatus.test.ts`

**Interfaces:**
- Produces:
  - `LEAD_STATUSES: readonly ["NEW","CONTACTED","COMMUNICATING","VIEWING_SCHEDULED","OFFER","RESERVED","KEEP_CONTACT","CLOSED","LOST"]`
  - `type LeadStatusValue = (typeof LEAD_STATUSES)[number]`
  - `FUNNEL_STATUSES` (NEW … RESERVED, CLOSED — the kanban order without KEEP_CONTACT/LOST)
  - `ACTIVE_LEAD_STATUSES` (NEW, CONTACTED, COMMUNICATING, VIEWING_SCHEDULED, OFFER, RESERVED)
  - `ELEVATED_NO_CONTACT_STATUSES` (COMMUNICATING, VIEWING_SCHEDULED, OFFER, RESERVED)
  - `COMMUNICATING_STATUSES` (same members as ELEVATED_NO_CONTACT_STATUSES)
  - `STATUS_LABEL: Record<LeadStatusValue, string>`
  - `LOST_REASONS: readonly ["BUDGET","BOUGHT_ELSEWHERE","UNREACHABLE","NOT_INTERESTED","TIMING","INVALID","OTHER"]`, `type LostReasonValue`, `LOST_REASON_LABEL`
  - `isLeadStatus(x: unknown): x is LeadStatusValue`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmLeadStatus.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEAD_STATUSES, FUNNEL_STATUSES, ACTIVE_LEAD_STATUSES, ELEVATED_NO_CONTACT_STATUSES,
  COMMUNICATING_STATUSES, STATUS_LABEL, LOST_REASONS, LOST_REASON_LABEL, isLeadStatus,
} from "@/lib/crm/leadStatus";

test("RESERVED sits between OFFER and KEEP_CONTACT", () => {
  assert.deepEqual([...LEAD_STATUSES], [
    "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "KEEP_CONTACT", "CLOSED", "LOST",
  ]);
});

test("the funnel is the kanban order and leaves out the parallel and lost states", () => {
  assert.deepEqual([...FUNNEL_STATUSES], ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"]);
});

test("a reserved lead is active and implies prior contact", () => {
  assert.ok(ACTIVE_LEAD_STATUSES.includes("RESERVED"));
  assert.ok(ELEVATED_NO_CONTACT_STATUSES.includes("RESERVED"));
  assert.deepEqual([...COMMUNICATING_STATUSES], [...ELEVATED_NO_CONTACT_STATUSES]);
  assert.equal(ACTIVE_LEAD_STATUSES.includes("KEEP_CONTACT" as never), false);
});

test("every status and lost reason has a label", () => {
  for (const s of LEAD_STATUSES) assert.ok(STATUS_LABEL[s]);
  for (const r of LOST_REASONS) assert.ok(LOST_REASON_LABEL[r]);
  assert.equal(STATUS_LABEL.RESERVED, "Reserved");
});

test("isLeadStatus guards unknown strings", () => {
  assert.equal(isLeadStatus("RESERVED"), true);
  assert.equal(isLeadStatus("QUALIFIED"), false);
  assert.equal(isLeadStatus(undefined), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmLeadStatus.test.ts`
Expected: FAIL, cannot find module `@/lib/crm/leadStatus`.

- [ ] **Step 3: Write `src/lib/crm/leadStatus.ts`**

```ts
// The one list of lead statuses (CRM v2, 2026-10-18). Before this, eight files
// carried their own copy of the array; adding a status meant finding all of
// them. Everything that needs order, grouping or a label imports from here.

export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "KEEP_CONTACT", "CLOSED", "LOST",
] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

// Kanban order. KEEP_CONTACT runs parallel to the funnel and LOST leaves it.
export const FUNNEL_STATUSES = [
  "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED",
] as const satisfies readonly LeadStatusValue[];

// Statuses the stale-follow-up rules nag about (see actionCenter/rules/crm.ts).
export const ACTIVE_LEAD_STATUSES = [
  "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED",
] as const satisfies readonly LeadStatusValue[];

// Statuses that cannot be reached without real contact having happened.
export const ELEVATED_NO_CONTACT_STATUSES = [
  "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED",
] as const satisfies readonly LeadStatusValue[];

// The compose flow treats these as "already in conversation".
export const COMMUNICATING_STATUSES = ELEVATED_NO_CONTACT_STATUSES;

export const STATUS_LABEL: Record<LeadStatusValue, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  COMMUNICATING: "Communicating",
  VIEWING_SCHEDULED: "Viewing scheduled",
  OFFER: "Offer",
  RESERVED: "Reserved",
  KEEP_CONTACT: "Keep contact",
  CLOSED: "Closed",
  LOST: "Lost",
};

export const LOST_REASONS = [
  "BUDGET", "BOUGHT_ELSEWHERE", "UNREACHABLE", "NOT_INTERESTED", "TIMING", "INVALID", "OTHER",
] as const;
export type LostReasonValue = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABEL: Record<LostReasonValue, string> = {
  BUDGET: "Budget does not fit",
  BOUGHT_ELSEWHERE: "Bought elsewhere",
  UNREACHABLE: "Not reachable",
  NOT_INTERESTED: "No longer interested",
  TIMING: "Not the right time",
  INVALID: "Invalid or spam",
  OTHER: "Other",
};

export function isLeadStatus(x: unknown): x is LeadStatusValue {
  return typeof x === "string" && (LEAD_STATUSES as readonly string[]).includes(x);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/crmLeadStatus.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Schema changes**

In `prisma/schema.prisma`, enum `LeadStatus`: insert `RESERVED` after `OFFER` with a comment:
```prisma
  OFFER
  // 2026-10-18 (CRM v2) — reservation fee paid or reservation agreement signed.
  // The deal and its commission are created at this step (src/lib/crm/commission.ts).
  RESERVED
```
Add a new enum after `LeadStatus`:
```prisma
// 2026-10-18 (CRM v2) — why a lead was lost. Optional server-side until the old
// CRM is retired; the new CRM requires it when moving a lead to LOST.
enum LostReason {
  BUDGET
  BOUGHT_ELSEWHERE
  UNREACHABLE
  NOT_INTERESTED
  TIMING
  INVALID
  OTHER
}
```
In `model Lead`, after `viewingScheduledAt`:
```prisma
  // 2026-10-18 (CRM v2) — set together with status LOST, cleared when the lead leaves LOST.
  lostReason           LostReason?
```

- [ ] **Step 6: Migration SQL**

`prisma/migrations/20261018100000_crm_v2_status/migration.sql`:
```sql
-- CRM v2 foundation (2026-10-18). Additive only.
-- RESERVED: written only by code that ships in the same deploy as this
-- migration, so no row can hold it while an older client is running.
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'RESERVED' AFTER 'OFFER';

CREATE TYPE "LostReason" AS ENUM ('BUDGET', 'BOUGHT_ELSEWHERE', 'UNREACHABLE', 'NOT_INTERESTED', 'TIMING', 'INVALID', 'OTHER');
ALTER TABLE "leads" ADD COLUMN "lostReason" "LostReason";
```

- [ ] **Step 7: Validate and generate (no DB access)**

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema at prisma/schema.prisma is valid" and "Generated Prisma Client".

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261018100000_crm_v2_status/migration.sql src/lib/crm/leadStatus.ts src/lib/__tests__/crmLeadStatus.test.ts
git commit -m "CRM v2: single lead-status source, RESERVED stage and lost reasons in the schema"
```

---

### Task 2: Old CRM, Action Center and compose read statuses from the single source

**Files:**
- Modify: `src/app/admin/(panel)/crm/filters.ts:7`
- Modify: `src/app/admin/(panel)/crm/StatusPopover.tsx:25`
- Modify: `src/app/admin/(panel)/crm/create-lead-form.tsx:9`
- Modify: `src/app/admin/(panel)/crm/board/page.tsx:13,21`
- Modify: `src/app/admin/(panel)/page.tsx:10`
- Modify: `src/app/admin/actions.ts:127`
- Modify: `src/app/admin/status-badge.tsx` (STATUS_STYLES)
- Modify: `src/lib/actionCenter/rules/crm.ts:54,121,155-158`
- Modify: `src/lib/crm/compose/leadState.ts:21`
- Modify: `src/lib/crm/createLead.ts:30`
- Modify: `src/lib/crm/updateLeadStatus.ts:8-9`
- Modify: `src/lib/mcp/tools/searchLeads.ts:14`
- Test: `src/lib/__tests__/crmStatusSitesUseCentralList.test.ts`

**Interfaces:**
- Consumes: everything exported by `src/lib/crm/leadStatus.ts` (Task 1).
- Produces: `src/lib/crm/updateLeadStatus.ts` re-exports `LEAD_STATUSES` and `LeadStatusValue` from leadStatus.ts so existing importers (`mcp/tools/updateLead.ts`, `mcp/__tests__/statusChange.test.ts`) keep working unchanged.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmStatusSitesUseCentralList.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
import { LEAD_STATUSES as FILTER_STATUSES } from "@/app/admin/(panel)/crm/filters";
import { LEAD_STATUSES as UPDATE_STATUSES } from "@/lib/crm/updateLeadStatus";
import { ACTIVE_LEAD_STATUSES } from "@/lib/actionCenter/rules/crm";
import { STATUS_STYLES } from "@/app/admin/status-badge";

// No file may carry its own copy of the status array again.
const FILES = [
  "src/app/admin/(panel)/crm/filters.ts",
  "src/app/admin/(panel)/crm/StatusPopover.tsx",
  "src/app/admin/(panel)/crm/create-lead-form.tsx",
  "src/app/admin/(panel)/crm/board/page.tsx",
  "src/app/admin/(panel)/page.tsx",
  "src/app/admin/actions.ts",
  "src/lib/actionCenter/rules/crm.ts",
  "src/lib/crm/compose/leadState.ts",
  "src/lib/crm/createLead.ts",
  "src/lib/crm/updateLeadStatus.ts",
  "src/lib/mcp/tools/searchLeads.ts",
];

test("no file hard-codes the status list", () => {
  for (const f of FILES) {
    const src = readFileSync(f, "utf8");
    assert.equal(/\["NEW",\s*"CONTACTED"/.test(src), false, `${f} still has its own status array`);
  }
});

test("re-exported lists are the central list", () => {
  assert.deepEqual([...FILTER_STATUSES], [...LEAD_STATUSES]);
  assert.deepEqual([...UPDATE_STATUSES], [...LEAD_STATUSES]);
  assert.ok(ACTIVE_LEAD_STATUSES.includes("RESERVED"));
});

test("every status has a badge style", () => {
  for (const s of LEAD_STATUSES) assert.ok(STATUS_STYLES[s], `missing style for ${s}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmStatusSitesUseCentralList.test.ts`
Expected: FAIL on "no file hard-codes the status list" (first offender `filters.ts`) and on the RESERVED badge style.

- [ ] **Step 3: Rewire each file**

Apply exactly these replacements (keep surrounding comments; add the import at the top of each file next to the other `@/lib` imports):

`src/app/admin/(panel)/crm/filters.ts` line 7:
```ts
import { LEAD_STATUSES as CENTRAL_LEAD_STATUSES } from "@/lib/crm/leadStatus";
export const LEAD_STATUSES: string[] = [...CENTRAL_LEAD_STATUSES];
```

`src/app/admin/(panel)/crm/StatusPopover.tsx` line 25 (`"use client"` file; leadStatus.ts has no server imports, so it is safe to import):
```ts
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
const STATUSES: string[] = [...LEAD_STATUSES];
```

`src/app/admin/(panel)/crm/create-lead-form.tsx` line 9:
```ts
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
const STATUSES: string[] = [...LEAD_STATUSES];
```

`src/app/admin/(panel)/crm/board/page.tsx` line 13, and add RESERVED to the colour map at line 21:
```ts
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
const PIPELINE: string[] = [...LEAD_STATUSES];
```
```ts
  VIEWING_SCHEDULED: "border-t-orange-400", OFFER: "border-t-indigo-400", RESERVED: "border-t-amber-500", KEEP_CONTACT: "border-t-purple-400",
```

`src/app/admin/(panel)/page.tsx` line 10:
```ts
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
const PIPELINE: string[] = [...LEAD_STATUSES];
```

`src/app/admin/actions.ts` line 127:
```ts
import { LEAD_STATUSES as CENTRAL_LEAD_STATUSES } from "@/lib/crm/leadStatus";
const STATUSES: string[] = [...CENTRAL_LEAD_STATUSES];
```

`src/app/admin/status-badge.tsx`, inside `STATUS_STYLES` after `OFFER`:
```ts
  // 2026-10-18 (CRM v2) — reservation; amber, between offer (indigo) and closed (green).
  RESERVED: "bg-amber-100 text-amber-800",
```

`src/lib/actionCenter/rules/crm.ts`: replace the two `export const … = [...] as const;` lines (54 and 121) with re-exports, and the `STATUS_LABEL` object (155-158) with the central one:
```ts
import { ACTIVE_LEAD_STATUSES, ELEVATED_NO_CONTACT_STATUSES, STATUS_LABEL as CENTRAL_STATUS_LABEL } from "@/lib/crm/leadStatus";
export { ACTIVE_LEAD_STATUSES, ELEVATED_NO_CONTACT_STATUSES };
```
```ts
const STATUS_LABEL: Record<string, string> = CENTRAL_STATUS_LABEL;
```

`src/lib/crm/compose/leadState.ts` line 21:
```ts
import { COMMUNICATING_STATUSES as CENTRAL_COMMUNICATING } from "@/lib/crm/leadStatus";
const COMMUNICATING_STATUSES: string[] = [...CENTRAL_COMMUNICATING];
```

`src/lib/crm/createLead.ts` line 30:
```ts
import type { LeadStatusValue } from "@/lib/crm/leadStatus";
```
```ts
  status?: LeadStatusValue;
```

`src/lib/crm/updateLeadStatus.ts` lines 8-9:
```ts
export { LEAD_STATUSES, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { LEAD_STATUSES, type LeadStatusValue } from "@/lib/crm/leadStatus";
```

`src/lib/mcp/tools/searchLeads.ts` line 14:
```ts
import { LEAD_STATUSES } from "@/lib/crm/leadStatus";
const STATUSES = LEAD_STATUSES;
```

- [ ] **Step 4: Run the new test and the full suite**

Run: `node --import tsx --test src/lib/__tests__/crmStatusSitesUseCentralList.test.ts && npm test`
Expected: all PASS. If `crmPartnerBucket.test.ts` or `mcp/__tests__/statusChange.test.ts` fail, the re-export in `updateLeadStatus.ts` or `filters.ts` is wrong; fix the export, never the test.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: no errors. A `Type '"RESERVED"' is not assignable` error means `npx prisma generate` was not run after Task 1.

- [ ] **Step 6: Check the board renders a RESERVED column header label**

Run: `grep -n "replace(/_/g" "src/app/admin/(panel)/crm/board/page.tsx"`
Expected: the column header derives its text from the status string, so RESERVED shows as "RESERVED"/"reserved" without further change. If the board has its own label map, add `RESERVED: "Reserved"` to it.

- [ ] **Step 7: Commit**

```bash
git add "src/app/admin/(panel)/crm/filters.ts" "src/app/admin/(panel)/crm/StatusPopover.tsx" "src/app/admin/(panel)/crm/create-lead-form.tsx" "src/app/admin/(panel)/crm/board/page.tsx" "src/app/admin/(panel)/page.tsx" src/app/admin/actions.ts src/app/admin/status-badge.tsx src/lib/actionCenter/rules/crm.ts src/lib/crm/compose/leadState.ts src/lib/crm/createLead.ts src/lib/crm/updateLeadStatus.ts src/lib/mcp/tools/searchLeads.ts src/lib/__tests__/crmStatusSitesUseCentralList.test.ts
git commit -m "CRM v2: old CRM, Action Center and MCP read statuses from one list; RESERVED styled"
```

---

### Task 3: Lost reason on status changes (central function + MCP)

**Files:**
- Modify: `src/lib/crm/updateLeadStatus.ts`
- Modify: `src/lib/mcp/tools/updateLead.ts` (Input schema, description, call to `applyLeadStatusChange`)
- Test: `src/lib/__tests__/crmLostReason.test.ts`

**Interfaces:**
- Consumes: `LOST_REASONS`, `LostReasonValue`, `LeadStatusValue` (Task 1).
- Produces:
  - `lostReasonUpdate(status: LeadStatusValue, lostReason: LostReasonValue | null | undefined): { lostReason: LostReasonValue | null } | Record<string, never>` — pure; throws `Error("lostReason is only allowed with status LOST")` when a reason is passed with another status.
  - `applyLeadStatusChange(actor, leadId, status, opts: { viewingScheduledAt?: Date | null; via?: "mcp"; lostReason?: LostReasonValue | null })`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmLostReason.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { lostReasonUpdate } from "@/lib/crm/updateLeadStatus";

test("LOST with a reason stores it", () => {
  assert.deepEqual(lostReasonUpdate("LOST", "BUDGET"), { lostReason: "BUDGET" });
});

test("LOST without a reason leaves the column untouched (old CRM dropdown)", () => {
  assert.deepEqual(lostReasonUpdate("LOST", undefined), {});
});

test("leaving LOST clears a stale reason", () => {
  assert.deepEqual(lostReasonUpdate("CONTACTED", undefined), { lostReason: null });
});

test("a reason with any other status is rejected", () => {
  assert.throws(() => lostReasonUpdate("OFFER", "BUDGET"), /only allowed with status LOST/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmLostReason.test.ts`
Expected: FAIL, `lostReasonUpdate` is not exported.

- [ ] **Step 3: Implement in `src/lib/crm/updateLeadStatus.ts`**

Add below the imports:
```ts
import type { LostReasonValue } from "@/lib/crm/leadStatus";

// Pure: the lostReason part of the lead update for a status change.
export function lostReasonUpdate(
  status: LeadStatusValue,
  lostReason: LostReasonValue | null | undefined,
): { lostReason: LostReasonValue | null } | Record<string, never> {
  if (status !== "LOST") {
    if (lostReason) throw new Error("lostReason is only allowed with status LOST");
    return { lostReason: null };
  }
  return lostReason === undefined ? {} : { lostReason };
}
```
Change the `opts` type and the `prisma.lead.update` data in `applyLeadStatusChange`:
```ts
  opts: { viewingScheduledAt?: Date | null; via?: "mcp"; lostReason?: LostReasonValue | null } = {},
): Promise<void> {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Invalid status");
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      ...(opts.viewingScheduledAt !== undefined ? { viewingScheduledAt: opts.viewingScheduledAt } : {}),
      ...lostReasonUpdate(status, opts.lostReason),
    },
  });
```
Add the reason to the STATUS_CHANGE interaction metadata:
```ts
      metadata: { toStatus: status, ...(opts.lostReason ? { lostReason: opts.lostReason } : {}), ...(opts.via ? { via: opts.via } : {}) },
```

- [ ] **Step 4: MCP `crm_update_lead` accepts `lostReason`**

In `src/lib/mcp/tools/updateLead.ts`:
- import: `import { LOST_REASONS } from "@/lib/crm/leadStatus";`
- add to `Input` after `status`:
```ts
  lostReason: z.enum([...LOST_REASONS]).optional().describe("Why the lead was lost; only with status LOST"),
```
- append to the tool description string: `" With status LOST, pass lostReason (BUDGET, BOUGHT_ELSEWHERE, UNREACHABLE, NOT_INTERESTED, TIMING, INVALID, OTHER)."`
- find the existing `applyLeadStatusChange(` call in the handler and add `lostReason: input.lostReason` to its options object. If `input.lostReason` is set and `input.status !== "LOST"`, throw `new ToolError("lostReason is only allowed together with status LOST")` before any write.

- [ ] **Step 5: Run tests and type check**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/updateLeadStatus.ts src/lib/mcp/tools/updateLead.ts src/lib/__tests__/crmLostReason.test.ts
git commit -m "CRM v2: lost reason on status changes, settable from the MCP connector"
```

---

### Task 4: Employee rights and the central access layer

**Files:**
- Modify: `prisma/schema.prisma` (model `User`)
- Create: `prisma/migrations/20261018100100_crm_v2_user_rights/migration.sql`
- Create: `src/lib/crm/access.ts`
- Create: `src/lib/crm/accessUser.ts`
- Test: `src/lib/__tests__/crmAccess.test.ts`

**Interfaces:**
- Produces (`src/lib/crm/access.ts`, pure, no Prisma import except types):
  - `type CrmUser = { id: string; role: "ADMIN" | "EDITOR"; isOwner: boolean; isActive: boolean; canSeeColleagues: boolean; canEditColleagues: boolean }`
  - `seesAllLeads(u: CrmUser): boolean` — owner, ADMIN, or EDITOR with `canSeeColleagues`
  - `leadAccessWhere(u: CrmUser): Prisma.LeadWhereInput` — `{}` when `seesAllLeads`, otherwise `{ assignedToId: u.id }`; inactive users get `{ id: "__no_access__" }`
  - `canViewLead(u: CrmUser, lead: { assignedToId: string | null }): boolean`
  - `canEditLead(u: CrmUser, lead: { assignedToId: string | null }): boolean` — owner/ADMIN always; EDITOR on own leads, or on any lead with `canEditColleagues` (which also requires `canSeeColleagues`)
  - `canAssignLeads(u: CrmUser): boolean` — owner or ADMIN (the inbox)
- Produces (`src/lib/crm/accessUser.ts`): `loadCrmUser(userId: string): Promise<CrmUser | null>`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmAccess.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { leadAccessWhere, canViewLead, canEditLead, canAssignLeads, seesAllLeads, type CrmUser } from "@/lib/crm/access";

const base: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };
const own = { assignedToId: "u1" };
const colleague = { assignedToId: "u2" };
const unassigned = { assignedToId: null };

test("an employee without rights sees and edits only own leads", () => {
  assert.deepEqual(leadAccessWhere(base), { assignedToId: "u1" });
  assert.equal(canViewLead(base, own), true);
  assert.equal(canViewLead(base, colleague), false);
  assert.equal(canViewLead(base, unassigned), false);
  assert.equal(canEditLead(base, own), true);
  assert.equal(canEditLead(base, colleague), false);
  assert.equal(canAssignLeads(base), false);
});

test("see-colleagues grants viewing but not editing", () => {
  const u = { ...base, canSeeColleagues: true };
  assert.deepEqual(leadAccessWhere(u), {});
  assert.equal(canViewLead(u, colleague), true);
  assert.equal(canEditLead(u, colleague), false);
});

test("edit-colleagues without see-colleagues grants nothing extra", () => {
  const u = { ...base, canEditColleagues: true };
  assert.equal(canEditLead(u, colleague), false);
  assert.equal(seesAllLeads(u), false);
});

test("see + edit colleagues edits everyone's leads", () => {
  const u = { ...base, canSeeColleagues: true, canEditColleagues: true };
  assert.equal(canEditLead(u, colleague), true);
  assert.equal(canEditLead(u, unassigned), true);
});

test("admins and the owner see, edit and assign everything", () => {
  for (const u of [{ ...base, role: "ADMIN" as const }, { ...base, isOwner: true }]) {
    assert.deepEqual(leadAccessWhere(u), {});
    assert.equal(canEditLead(u, colleague), true);
    assert.equal(canAssignLeads(u), true);
  }
});

test("a deactivated user sees nothing", () => {
  const u = { ...base, role: "ADMIN" as const, isActive: false };
  assert.deepEqual(leadAccessWhere(u), { id: "__no_access__" });
  assert.equal(canViewLead(u, own), false);
  assert.equal(canEditLead(u, own), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmAccess.test.ts`
Expected: FAIL, cannot find module `@/lib/crm/access`.

- [ ] **Step 3: Write `src/lib/crm/access.ts`**

```ts
import type { Prisma } from "@prisma/client";

// Who may see and edit which lead (CRM v2, 2026-10-18). The ONE place this is
// decided: the new CRM, exports, search and the MCP tools all go through it.
// The old /admin/crm does not; restricted employees are kept out of it (Phase 2).

export type CrmUser = {
  id: string;
  role: "ADMIN" | "EDITOR";
  isOwner: boolean;
  isActive: boolean;
  canSeeColleagues: boolean;
  canEditColleagues: boolean;
};

type LeadOwner = { assignedToId: string | null };

const isManager = (u: CrmUser) => u.isOwner || u.role === "ADMIN";

export function seesAllLeads(u: CrmUser): boolean {
  return u.isActive && (isManager(u) || u.canSeeColleagues);
}

export function leadAccessWhere(u: CrmUser): Prisma.LeadWhereInput {
  if (!u.isActive) return { id: "__no_access__" };
  return seesAllLeads(u) ? {} : { assignedToId: u.id };
}

export function canViewLead(u: CrmUser, lead: LeadOwner): boolean {
  if (!u.isActive) return false;
  return seesAllLeads(u) || lead.assignedToId === u.id;
}

export function canEditLead(u: CrmUser, lead: LeadOwner): boolean {
  if (!u.isActive) return false;
  if (isManager(u)) return true;
  if (lead.assignedToId === u.id) return true;
  return u.canSeeColleagues && u.canEditColleagues;
}

export function canAssignLeads(u: CrmUser): boolean {
  return u.isActive && isManager(u);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/crmAccess.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Schema + migration**

`prisma/schema.prisma`, model `User`, after `isActive`:
```prisma
  // CRM v2 (2026-10-18) — visibility rights, see src/lib/crm/access.ts. Existing
  // users were backfilled to true so nobody lost access; new users start false.
  canSeeColleagues       Boolean              @default(false)
  canEditColleagues      Boolean              @default(false)
  // Owner suggestion inputs for the inbox (Phase 2): spoken locales, regions or
  // development ids, and whether the employee takes new leads right now.
  languages              String[]             @default([])
  specialties            String[]             @default([])
  acceptsLeads           Boolean              @default(true)
```
`prisma/migrations/20261018100100_crm_v2_user_rights/migration.sql`:
```sql
-- CRM v2 foundation (2026-10-18). Additive only.
ALTER TABLE "users" ADD COLUMN "canSeeColleagues" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "canEditColleagues" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "acceptsLeads" BOOLEAN NOT NULL DEFAULT true;

-- Everyone who exists today sees and edits every lead; keep it that way.
UPDATE "users" SET "canSeeColleagues" = true, "canEditColleagues" = true;
```

- [ ] **Step 6: Write `src/lib/crm/accessUser.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { CrmUser } from "./access";

export async function loadCrmUser(userId: string): Promise<CrmUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isOwner: true, isActive: true, canSeeColleagues: true, canEditColleagues: true },
  });
  return u ? { ...u, role: u.role as CrmUser["role"] } : null;
}
```

- [ ] **Step 7: Validate, generate, test, type check**

Run: `npx prisma validate && npx prisma generate && npm test && npx tsc --noEmit`
Expected: valid schema, all tests PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261018100100_crm_v2_user_rights/migration.sql src/lib/crm/access.ts src/lib/crm/accessUser.ts src/lib/__tests__/crmAccess.test.ts
git commit -m "CRM v2: per-employee visibility rights and the central lead access layer"
```

---

### Task 5: MCP tools go through the access layer

**Files:**
- Create: `src/lib/mcp/leadScope.ts`
- Modify: every file in `src/lib/mcp/tools/` that queries `prisma.lead` (list produced in Step 1)
- Test: `src/lib/mcp/__tests__/leadScope.test.ts`

**Interfaces:**
- Consumes: `CrmUser`, `leadAccessWhere`, `canEditLead` (Task 4), `loadCrmUser` (Task 4), `McpCallContext` from `src/lib/mcp/context.ts`, `ToolError` from `src/lib/mcp/toolWrapper.ts`.
- Produces (`src/lib/mcp/leadScope.ts`):
  - `scopeFor(user: CrmUser | null): Prisma.LeadWhereInput` — pure; `null` user → `{ id: "__no_access__" }`
  - `loadScope(ctx: McpCallContext): Promise<{ user: CrmUser; where: Prisma.LeadWhereInput }>` — throws `ToolError("Your account cannot access leads")` when the user is missing or inactive
  - `assertCanEdit(user: CrmUser, lead: { assignedToId: string | null }): void` — throws `ToolError("You can view this lead but not change it")`

- [ ] **Step 1: List the call sites**

Run: `grep -n "prisma.lead\.\(findFirst\|findMany\|findUnique\|findUniqueOrThrow\|count\|update\)\|lead: {" src/lib/mcp/tools/*.ts`
Expected: hits in at least `getLead.ts`, `searchLeads.ts`, `updateLead.ts`, `worklist.ts`, plus any of `logInteraction.ts`, `draftEmail.ts`, `whatsappSend.ts`, `whatsappThread.ts`, `deleteLead.ts`, `restoreLead.ts`, `listDrafts.ts`, `createLead.ts`. Write the list into the commit message body.

- [ ] **Step 2: Write the failing test**

`src/lib/mcp/__tests__/leadScope.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeFor, assertCanEdit } from "@/lib/mcp/leadScope";
import type { CrmUser } from "@/lib/crm/access";

const editor: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };

test("a missing user gets a where-clause that matches nothing", () => {
  assert.deepEqual(scopeFor(null), { id: "__no_access__" });
});

test("a restricted employee is scoped to own leads", () => {
  assert.deepEqual(scopeFor(editor), { assignedToId: "u1" });
});

test("viewing a colleague's lead is fine, changing it is refused", () => {
  const viewer = { ...editor, canSeeColleagues: true };
  assert.deepEqual(scopeFor(viewer), {});
  assert.throws(() => assertCanEdit(viewer, { assignedToId: "u2" }), /view this lead but not change it/);
  assert.doesNotThrow(() => assertCanEdit(viewer, { assignedToId: "u1" }));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --import tsx --test src/lib/mcp/__tests__/leadScope.test.ts`
Expected: FAIL, cannot find module `@/lib/mcp/leadScope`.

- [ ] **Step 4: Write `src/lib/mcp/leadScope.ts`**

```ts
import type { Prisma } from "@prisma/client";
import { canEditLead, leadAccessWhere, type CrmUser } from "@/lib/crm/access";
import { loadCrmUser } from "@/lib/crm/accessUser";
import type { McpCallContext } from "./context";
import { ToolError } from "./toolWrapper";

// MCP tools see exactly the leads the connected user sees in the CRM.
export function scopeFor(user: CrmUser | null): Prisma.LeadWhereInput {
  return user ? leadAccessWhere(user) : { id: "__no_access__" };
}

export async function loadScope(ctx: McpCallContext): Promise<{ user: CrmUser; where: Prisma.LeadWhereInput }> {
  const user = await loadCrmUser(ctx.userId);
  if (!user || !user.isActive) throw new ToolError("Your account cannot access leads");
  return { user, where: scopeFor(user) };
}

export function assertCanEdit(user: CrmUser, lead: { assignedToId: string | null }): void {
  if (!canEditLead(user, lead)) throw new ToolError("You can view this lead but not change it");
}
```
If `ToolError`'s constructor signature differs (check `src/lib/mcp/toolWrapper.ts`), match it.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --import tsx --test src/lib/mcp/__tests__/leadScope.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Apply the scope in every tool from Step 1**

Pattern for **reads** (each handler already has `ctx` from `contextFromAuthInfo`; call `loadScope` once at the top of the handler, after the existing ctx null check):
```ts
const { user, where: scope } = await loadScope(ctx);
```
then spread `...scope` into every lead where-clause, e.g. in `getLead.ts`:
```ts
where: { id: leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER, ...scope },
```
and for relation filters (`lead: { … }`, e.g. presentations in `worklist.ts`):
```ts
where: { id: { in: presentationIds }, lead: { deletedAt: null, ...EXCLUDE_NEWSLETTER, ...scope } },
```
Pattern for **writes** (`updateLead`, `logInteraction`, `draftEmail`, `sendEmail`, `whatsappSend`, `deleteLead`, `restoreLead`): load the lead with `...scope` in its where-clause and `assignedToId: true` in its select, return the existing "not found" error when it is null, then call `assertCanEdit(user, lead)` before the first write.
`createLead.ts` needs no scope (it creates and auto-assigns to the caller) — leave it.
A lead outside the scope must produce the same "not found" message as a non-existent id (no existence leak).

- [ ] **Step 7: Full suite and type check**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS. Existing MCP tests that construct tool handlers with a fake context may need `loadCrmUser` to be reachable; if a test calls a handler end-to-end against Prisma, it is not a pure test and was already DB-dependent — report it instead of mocking Prisma globally.

- [ ] **Step 8: Commit**

```bash
git add src/lib/mcp/leadScope.ts src/lib/mcp/__tests__/leadScope.test.ts src/lib/mcp/tools/
git commit -m "CRM v2: MCP tools see and change only the leads the connected user may"
```
(`git add src/lib/mcp/tools/` is an explicit directory you changed in this task, not `-A`; check `git status` first that nothing unrelated is in it.)

---

### Task 6: Deals and commission rates

**Files:**
- Modify: `prisma/schema.prisma` (new enums `CommissionStatus`, `RateSource`; new models `Deal`, `CommissionRate`; back-relations on `Lead`, `Development`, `DeveloperAccount`, `User`)
- Create: `prisma/migrations/20261018100200_crm_v2_deals/migration.sql`
- Create: `src/lib/crm/commission.ts`
- Test: `src/lib/__tests__/crmCommission.test.ts`

**Interfaces:**
- Produces (`src/lib/crm/commission.ts`, pure):
  - `type RateRow = { developerAccountId: string; developmentId: string | null; ratePercent: number }`
  - `resolveRate(rows: RateRow[], developerAccountId: string, developmentId: string): { ratePercent: number | null; source: "PROJECT" | "DEVELOPER" | "MISSING" }`
  - `computeDealAmounts(input: { price: number; ourRatePercent: number | null; partnerSharePercent: number | null; ourCommissionOverride?: number | null; partnerCommissionOverride?: number | null }): { ourCommission: number | null; partnerCommission: number | null }` — euros, rounded to whole euros
  - `COMMISSION_STATUSES = ["EXPECTED","EARNED","DEVELOPER_PAID","PAID_OUT","CANCELLED"] as const`, `type CommissionStatusValue`
  - `canTransitionCommission(from: CommissionStatusValue, to: CommissionStatusValue): boolean`
  - `commissionStatusForLeadStatus(leadStatus: LeadStatusValue): CommissionStatusValue | null` — RESERVED → EXPECTED, CLOSED → EARNED, else null
  - `estimatePartnerCommission(input: { budget: number | null; ourRatePercent: number | null; partnerSharePercent: number }): number | null`
  - `DEFAULT_HANDOVER_SHARE = 30`, `DEFAULT_FIX_SHARE = 50`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/crmCommission.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveRate, computeDealAmounts, canTransitionCommission, commissionStatusForLeadStatus,
  estimatePartnerCommission, DEFAULT_HANDOVER_SHARE, DEFAULT_FIX_SHARE, type RateRow,
} from "@/lib/crm/commission";

const rows: RateRow[] = [
  { developerAccountId: "bbf", developmentId: null, ratePercent: 10 },
  { developerAccountId: "bbf", developmentId: "eden-coast", ratePercent: 5 },
];

test("a project rate beats the developer rate", () => {
  assert.deepEqual(resolveRate(rows, "bbf", "eden-coast"), { ratePercent: 5, source: "PROJECT" });
});

test("other projects of the developer inherit the developer rate", () => {
  assert.deepEqual(resolveRate(rows, "bbf", "marina"), { ratePercent: 10, source: "DEVELOPER" });
});

test("no rate at all is reported as missing, never as zero", () => {
  assert.deepEqual(resolveRate(rows, "aristo", "x"), { ratePercent: null, source: "MISSING" });
});

test("the spec's worked example: 400,000 at 5 % with a 30 % partner share", () => {
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: 30 }),
    { ourCommission: 20_000, partnerCommission: 6_000 },
  );
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: DEFAULT_FIX_SHARE }),
    { ourCommission: 20_000, partnerCommission: 10_000 },
  );
});

test("overrides win and the partner share applies to the overridden amount", () => {
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: 30, ourCommissionOverride: 18_000 }),
    { ourCommission: 18_000, partnerCommission: 5_400 },
  );
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: 30, partnerCommissionOverride: 7_000 }),
    { ourCommission: 20_000, partnerCommission: 7_000 },
  );
});

test("a missing rate yields no numbers, and no partner means no partner commission", () => {
  assert.deepEqual(computeDealAmounts({ price: 400_000, ourRatePercent: null, partnerSharePercent: 30 }), { ourCommission: null, partnerCommission: null });
  assert.deepEqual(computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: null }), { ourCommission: 20_000, partnerCommission: null });
});

test("amounts are whole euros", () => {
  assert.deepEqual(computeDealAmounts({ price: 333_333, ourRatePercent: 5, partnerSharePercent: 30 }), { ourCommission: 16_667, partnerCommission: 5_000 });
});

test("commission moves forward only, and can be cancelled until paid out", () => {
  assert.equal(canTransitionCommission("EXPECTED", "EARNED"), true);
  assert.equal(canTransitionCommission("EARNED", "DEVELOPER_PAID"), true);
  assert.equal(canTransitionCommission("DEVELOPER_PAID", "PAID_OUT"), true);
  assert.equal(canTransitionCommission("EARNED", "EXPECTED"), false);
  assert.equal(canTransitionCommission("EXPECTED", "PAID_OUT"), false);
  assert.equal(canTransitionCommission("DEVELOPER_PAID", "CANCELLED"), true);
  assert.equal(canTransitionCommission("PAID_OUT", "CANCELLED"), false);
  assert.equal(canTransitionCommission("CANCELLED", "EXPECTED"), false);
});

test("lead stages drive the first two commission stages", () => {
  assert.equal(commissionStatusForLeadStatus("RESERVED"), "EXPECTED");
  assert.equal(commissionStatusForLeadStatus("CLOSED"), "EARNED");
  assert.equal(commissionStatusForLeadStatus("OFFER"), null);
});

test("the estimate uses the budget and is absent without a budget or rate", () => {
  assert.equal(estimatePartnerCommission({ budget: 400_000, ourRatePercent: 5, partnerSharePercent: DEFAULT_HANDOVER_SHARE }), 6_000);
  assert.equal(estimatePartnerCommission({ budget: null, ourRatePercent: 5, partnerSharePercent: 30 }), null);
  assert.equal(estimatePartnerCommission({ budget: 400_000, ourRatePercent: null, partnerSharePercent: 30 }), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/__tests__/crmCommission.test.ts`
Expected: FAIL, cannot find module `@/lib/crm/commission`.

- [ ] **Step 3: Write `src/lib/crm/commission.ts`**

```ts
import type { LeadStatusValue } from "./leadStatus";

// Commission maths for CRM v2 deals (2026-10-18). Pure; the deal form, the
// Commissions screen and the partner portal all compute through here so a
// partner never sees a number the CRM would not.

export const DEFAULT_HANDOVER_SHARE = 30;
export const DEFAULT_FIX_SHARE = 50;

export type RateRow = { developerAccountId: string; developmentId: string | null; ratePercent: number };

export function resolveRate(
  rows: RateRow[],
  developerAccountId: string,
  developmentId: string,
): { ratePercent: number | null; source: "PROJECT" | "DEVELOPER" | "MISSING" } {
  const project = rows.find((r) => r.developmentId === developmentId);
  if (project) return { ratePercent: project.ratePercent, source: "PROJECT" };
  const developer = rows.find((r) => r.developerAccountId === developerAccountId && r.developmentId === null);
  if (developer) return { ratePercent: developer.ratePercent, source: "DEVELOPER" };
  return { ratePercent: null, source: "MISSING" };
}

const euros = (x: number) => Math.round(x);

export function computeDealAmounts(input: {
  price: number;
  ourRatePercent: number | null;
  partnerSharePercent: number | null;
  ourCommissionOverride?: number | null;
  partnerCommissionOverride?: number | null;
}): { ourCommission: number | null; partnerCommission: number | null } {
  const ourCommission =
    input.ourCommissionOverride ?? (input.ourRatePercent == null ? null : euros((input.price * input.ourRatePercent) / 100));
  if (ourCommission == null) return { ourCommission: null, partnerCommission: null };
  const partnerCommission =
    input.partnerCommissionOverride ??
    (input.partnerSharePercent == null ? null : euros((ourCommission * input.partnerSharePercent) / 100));
  return { ourCommission, partnerCommission };
}

export const COMMISSION_STATUSES = ["EXPECTED", "EARNED", "DEVELOPER_PAID", "PAID_OUT", "CANCELLED"] as const;
export type CommissionStatusValue = (typeof COMMISSION_STATUSES)[number];

const NEXT: Record<CommissionStatusValue, CommissionStatusValue[]> = {
  EXPECTED: ["EARNED", "CANCELLED"],
  EARNED: ["DEVELOPER_PAID", "CANCELLED"],
  DEVELOPER_PAID: ["PAID_OUT", "CANCELLED"],
  PAID_OUT: [],
  CANCELLED: [],
};

export function canTransitionCommission(from: CommissionStatusValue, to: CommissionStatusValue): boolean {
  return NEXT[from].includes(to);
}

export function commissionStatusForLeadStatus(leadStatus: LeadStatusValue): CommissionStatusValue | null {
  if (leadStatus === "RESERVED") return "EXPECTED";
  if (leadStatus === "CLOSED") return "EARNED";
  return null;
}

export function estimatePartnerCommission(input: {
  budget: number | null;
  ourRatePercent: number | null;
  partnerSharePercent: number;
}): number | null {
  if (input.budget == null || input.ourRatePercent == null) return null;
  return computeDealAmounts({ price: input.budget, ourRatePercent: input.ourRatePercent, partnerSharePercent: input.partnerSharePercent }).partnerCommission;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/crmCommission.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Schema**

Add to `prisma/schema.prisma` (near the CRM models):
```prisma
// CRM v2 (2026-10-18) — commission lifecycle of one deal; transitions in src/lib/crm/commission.ts.
enum CommissionStatus {
  EXPECTED
  EARNED
  DEVELOPER_PAID
  PAID_OUT
  CANCELLED
}

enum RateSource {
  PROJECT
  DEVELOPER
  MANUAL
  MISSING
}

// One purchase by a lead (a lead can buy several units). Amounts are whole euros.
model Deal {
  id                     String           @id @default(uuid())
  leadId                 String
  lead                   Lead             @relation(fields: [leadId], references: [id], onDelete: Cascade)
  developmentId          String?
  development            Development?     @relation(fields: [developmentId], references: [id], onDelete: SetNull)
  unitLabel              String?
  price                  Int
  ourRatePercent         Decimal?         @db.Decimal(5, 2)
  rateSource             RateSource       @default(MISSING)
  ourCommission          Int?
  partnerSharePercent    Decimal?         @db.Decimal(5, 2)
  partnerCommission      Int?
  commissionStatus       CommissionStatus @default(EXPECTED)
  expectedAt             DateTime         @default(now())
  earnedAt               DateTime?
  developerPaidAt        DateTime?
  paidOutAt              DateTime?
  cancelledAt            DateTime?
  createdById            String?
  createdBy              User?            @relation("DealsCreated", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt

  @@index([leadId])
  @@index([commissionStatus])
  @@map("deals")
}

// Our contractual commission with a developer: developmentId null = the
// developer-wide default; set = a project override that wins (resolveRate()).
model CommissionRate {
  id                 String           @id @default(uuid())
  developerAccountId String
  developerAccount   DeveloperAccount @relation(fields: [developerAccountId], references: [id], onDelete: Cascade)
  developmentId      String?          @unique
  development        Development?     @relation(fields: [developmentId], references: [id], onDelete: Cascade)
  ratePercent        Decimal          @db.Decimal(5, 2)
  note               String?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([developerAccountId])
  @@map("commission_rates")
}
```
Back-relations:
- `model Lead`: `deals Deal[]`
- `model Development`: `deals Deal[]` and `commissionRate CommissionRate?`
- `model DeveloperAccount`: `commissionRates CommissionRate[]`
- `model User`: `dealsCreated Deal[] @relation("DealsCreated")`

The "one developer-wide default per account" rule cannot be a plain unique index because `developmentId` is NULL there; it is enforced by a partial unique index in the migration.

- [ ] **Step 6: Migration SQL**

`prisma/migrations/20261018100200_crm_v2_deals/migration.sql`:
```sql
-- CRM v2 foundation (2026-10-18). Additive only: two new tables.
CREATE TYPE "CommissionStatus" AS ENUM ('EXPECTED', 'EARNED', 'DEVELOPER_PAID', 'PAID_OUT', 'CANCELLED');
CREATE TYPE "RateSource" AS ENUM ('PROJECT', 'DEVELOPER', 'MANUAL', 'MISSING');

CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "developmentId" TEXT,
    "unitLabel" TEXT,
    "price" INTEGER NOT NULL,
    "ourRatePercent" DECIMAL(5,2),
    "rateSource" "RateSource" NOT NULL DEFAULT 'MISSING',
    "ourCommission" INTEGER,
    "partnerSharePercent" DECIMAL(5,2),
    "partnerCommission" INTEGER,
    "commissionStatus" "CommissionStatus" NOT NULL DEFAULT 'EXPECTED',
    "expectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earnedAt" TIMESTAMP(3),
    "developerPaidAt" TIMESTAMP(3),
    "paidOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "deals_leadId_idx" ON "deals"("leadId");
CREATE INDEX "deals_commissionStatus_idx" ON "deals"("commissionStatus");
ALTER TABLE "deals" ADD CONSTRAINT "deals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "commission_rates" (
    "id" TEXT NOT NULL,
    "developerAccountId" TEXT NOT NULL,
    "developmentId" TEXT,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commission_rates_developmentId_key" ON "commission_rates"("developmentId");
CREATE INDEX "commission_rates_developerAccountId_idx" ON "commission_rates"("developerAccountId");
-- At most one developer-wide default per account (developmentId IS NULL).
CREATE UNIQUE INDEX "commission_rates_one_default_per_account" ON "commission_rates"("developerAccountId") WHERE "developmentId" IS NULL;
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_developerAccountId_fkey" FOREIGN KEY ("developerAccountId") REFERENCES "developer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 7: Check the SQL against Prisma's own diff (no DB access)**

Run: `npx prisma validate && npx prisma generate && npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script` **only if** a disposable local shadow database is available (see memory note `testbed-enum-owner-gap` for `db-testbed-up.sh`). Expected output: empty, or only the partial unique index (Prisma cannot express it). If no disposable database is available, skip this step and say so in the task report; never point a shadow URL at the production database.

- [ ] **Step 8: Tests and type check**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261018100200_crm_v2_deals/migration.sql src/lib/crm/commission.ts src/lib/__tests__/crmCommission.test.ts
git commit -m "CRM v2: deals and developer/project commission rates with tested commission maths"
```

---

### Task 7: Phase 1 wrap-up

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` (only if anything in this plan's "Decisions taken while planning" is not yet reflected there)

- [ ] **Step 1: Full verification**

Run: `npm test && npx tsc --noEmit && npx prisma validate && npm run lint`
Expected: all green. Report the test count from the `npm test` summary.

- [ ] **Step 2: Migration order check**

Run: `ls prisma/migrations | tail -5`
Expected: the three `20261018100…_crm_v2_*` folders sort after every existing migration. If origin/main gained a later-dated migration in the meantime, rename these folders to a later timestamp before merging.

- [ ] **Step 3: Independent review**

Dispatch the `code-reviewer` agent over the branch diff against origin/main. Fix findings that are real; list any you reject with a reason.

- [ ] **Step 4: Push and hand over**

```bash
git push origin HEAD
```
Report to the operator: what shipped, test count, the three migrations, and the deploy instruction "deploy with `CVP_RUN_MIGRATE=1`; after deploy, open /admin/crm/board and confirm a Reserved column exists and the dashboard loads". Do not deploy.
