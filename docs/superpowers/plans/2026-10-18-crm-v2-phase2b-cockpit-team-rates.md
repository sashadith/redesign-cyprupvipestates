# CRM v2 Phase 2b (Cockpit, Team rights, Commission rates) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the new CRM self-sufficient for daily work: a lead cockpit at `/crm/leads/[id]`, a team-rights screen, a commission screen (developer/project rates + deal payout stages), the old-CRM gate for restricted employees, and the fixes found in the 2a preview.

**Architecture:** Same pattern as 2a: server pages call `requireCrmUser()` and the Phase 1 access layer; all writes go through `src/app/crm/actions.ts` (or a sibling `"use server"` file per area) that re-check the session and rights; decision logic lives in pure, unit-tested modules in `src/lib/crm/`. The cockpit reuses `logLeadInteraction` and `moveLead`. The old CRM gets exactly one new file: a nested layout that redirects restricted employees (operator decision 2026-10-18, "Sperre einbauen").

**Tech Stack:** Next.js 14.2 App Router, Prisma 5.22, NextAuth v5 beta, Zod, node:test via tsx.

**Spec:** `docs/superpowers/specs/2026-10-17-crm-v2-partner-portal-design.md` (sections 2, 3 rule 3, 5.3, 6.1 screens 4, 6, 7, 7 security). Previous plan: `docs/superpowers/plans/2026-10-17-crm-v2-phase2a-pipeline-inbox.md`.

## Global Constraints

- The local `.env.local` DATABASE_URL is the LIVE production database. Never run `prisma migrate dev/reset/deploy`, `db push`, `next build`, `next dev`, or anything that connects to a DB. `npx prisma generate`/`validate` only with `DATABASE_URL=postgresql://x:x@localhost:1/x`. This plan needs **no** schema change.
- **The old admin CRM UI stays untouched.** The single exception is the new file `src/app/admin/(panel)/crm/layout.tsx` (Task 3). No existing file under `src/app/admin/` may change. The guard test `src/lib/__tests__/crmStatusSitesUseCentralList.test.ts` must keep passing.
- Admin/internal copy is English.
- Visual direction: Limestone in its original colours (tokens in `src/app/crm/crm.css`); no champagne/bronze; tabular numerals; responsive to 375 px; honour `prefers-reduced-motion`.
- Every server action re-checks the session (`requireCrmUser`). Access rules only from `src/lib/crm/access.ts`. Commission numbers only from `src/lib/crm/commission.ts`; Prisma `Decimal` → `.toNumber()` at the DB boundary.
- Every rights change, rate change and commission-stage change writes an `AdminAuditLog` row (`actorId, actorName, actorEmail, action, targetType, targetId, detail`).
- Tests: `npm test` (node:test via tsx; `src/lib/__tests__/`, `src/lib/mcp/__tests__/`, `scripts/qa/__tests__/`), no DB access. `npx tsc --noEmit` 0 errors. `npm run lint` exit 0.
- Commit with explicit paths; never `git add -A`. Do not push. Do not deploy.

## Decisions taken while planning

1. **Old-CRM gate = one new nested layout** `src/app/admin/(panel)/crm/layout.tsx` that redirects users who do not see all leads to `/crm/pipeline`. It covers every page under `/admin/crm/*`. Known limitation (documented in the file and the hand-over): old-CRM server actions in `src/app/admin/actions.ts` are not re-scoped; an employee would have to craft requests by hand. Re-scoping them would modify the old CRM, which the operator excluded.
2. **Admins and the owner always see everything**; the rights screen shows them as "Sees everything (admin)" with no switches. Rights switches exist only for EDITORs. "Edit colleagues" implies "See colleagues": turning See off also turns Edit off; turning Edit on also turns See on.
3. **Languages** are chosen from `LOCALES` minus `he` (the operator does not work in Hebrew); **specialties** are free text (towns/regions), max 10 items × 40 chars, matched case-insensitively by the 2a owner suggestion.
4. **Commission rates** are edited per developer account: one default + any number of project overrides; rates are percentages with up to 2 decimals, `0 < rate ≤ 100`.
5. **Commission stages** on the Commissions screen: EARNED → "Developer paid" (date), DEVELOPER_PAID → "Paid out" (date), and "Cancel" for EXPECTED/EARNED/DEVELOPER_PAID — all through `canTransitionCommission`. EXPECTED → EARNED happens only through the pipeline (Sold).
6. **Cockpit scope (MVP):** header, stage control (reusing the 2a move flow and `MoveDialog`), deals panel, timeline (last 100 interactions), log call/note/WhatsApp/email form via `logLeadInteraction`, assignment control for managers (reusing `assignLead`), and a link to the old cockpit for presentations, matching and email compose — shown only to users who see all leads (others are gated out of `/admin/crm`). Board and Inbox links switch from `/admin/crm/<id>` to `/crm/leads/<id>`.
7. **2a preview fixes:** dialog StrictMode ref, Move button covering the language badge on phones, deal dialog keeping the chosen project visible, and a title on the phone move sheet.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/crm/components/MoveDialog.tsx`, `Board.tsx`, `crm.css` | Modify: 2a preview fixes; card links to `/crm/leads/<id>` |
| `src/app/crm/components/InboxList.tsx` | Modify: lead link to `/crm/leads/<id>` |
| `src/lib/crm/teamRights.ts` | Create: pure rights normalisation + patch validation |
| `src/app/crm/team/page.tsx`, `src/app/crm/components/TeamTable.tsx`, `src/app/crm/team/actions.ts` | Create: team screen |
| `src/lib/crm/audit.ts` | Create: `writeAudit(actor, action, targetType, targetId, detail)` |
| `src/app/admin/(panel)/crm/layout.tsx` | Create: old-CRM gate |
| `src/lib/crm/oldCrmGate.ts` | Create: pure `mayUseOldCrm(user)` |
| `src/lib/crm/rateForm.ts` | Create: pure rate parsing/validation |
| `src/lib/crm/commissionActions.ts` | Create: pure "which payout buttons for this deal" |
| `src/app/crm/commissions/page.tsx`, `src/app/crm/commissions/actions.ts`, `src/app/crm/components/RatesEditor.tsx`, `src/app/crm/components/DealsTable.tsx` | Create: commissions screen |
| `src/lib/crm/timeline.ts` | Create: pure interaction → timeline item mapping |
| `src/app/crm/leads/[id]/page.tsx`, `src/app/crm/components/Cockpit*.tsx`, `src/app/crm/leads/actions.ts` | Create: cockpit |
| `src/app/crm/components/Shell.tsx` | Modify: nav items Team, Commissions (managers) |
| Tests in `src/lib/__tests__/`: `crmTeamRights.test.ts`, `crmOldCrmGate.test.ts`, `crmRateForm.test.ts`, `crmCommissionActions.test.ts`, `crmTimeline.test.ts` | Create |

---

### Task 1: 2a preview fixes and links to the new cockpit

**Files:**
- Modify: `src/app/crm/components/MoveDialog.tsx`, `src/app/crm/components/Board.tsx`, `src/app/crm/components/InboxList.tsx`, `src/app/crm/crm.css`
- Test: `scripts/qa/__tests__/crm-board-dialog.test.mjs` (extend)

**Interfaces:**
- Consumes: existing `MoveDialog({ state, busy, onSubmit, onCancel, onClosed })`, `CardView`, `InboxList`.
- Produces: card and inbox anchors point to `/crm/leads/<id>`; MoveDialog shows the chosen project.

- [ ] **Step 1: StrictMode-safe close handling.** In `MoveDialog.tsx` the effect that sets `unmounting.current = true` in its cleanup must set `unmounting.current = false` at the start of its body, so React StrictMode's simulated unmount in `next dev` does not disable `onClosed` permanently.
- [ ] **Step 2: Deal dialog keeps the chosen project.** Track the selected option `{ id, label }`. While a project is selected and the input text equals its label, do not run the search and render a selected row ("✓ Eden Coast · Paphos", class `on`) instead of an empty list; editing the input clears the selection and resumes searching.
- [ ] **Step 3: Phone layout.** At ≤ 720 px: the card's top row reserves space for the Move button (`.crm-card .c-top { padding-right: 52px }`) so the language badge is never covered; the bottom sheet gets a heading line "Move {lead name} to…" (`.crm-menu .sheet-title`, hidden on desktop).
- [ ] **Step 4: Links.** In `Board.tsx` (CardView anchor) and `InboxList.tsx` (name link) replace `/admin/crm/${id}` with `/crm/leads/${id}`. Update any jsdom test assertion that checks the href.
- [ ] **Step 5: Extend the jsdom test** (`scripts/qa/__tests__/crm-board-dialog.test.mjs`): (a) after choosing a project the dialog shows a selected row with that label and "Save deal and move" is enabled; (b) the card anchor href starts with `/crm/leads/`.
- [ ] **Step 6:** Run `npm test && npx tsc --noEmit && npm run lint`; commit:
```bash
git add src/app/crm/components/MoveDialog.tsx src/app/crm/components/Board.tsx src/app/crm/components/InboxList.tsx src/app/crm/crm.css scripts/qa/__tests__/crm-board-dialog.test.mjs
git commit -m "CRM v2: preview fixes (dialog close in dev, chosen project, phone badge, sheet title); links to the new cockpit"
```

---

### Task 2: Team rights screen

**Files:**
- Create: `src/lib/crm/teamRights.ts`, `src/lib/crm/audit.ts`, `src/app/crm/team/page.tsx`, `src/app/crm/team/actions.ts`, `src/app/crm/components/TeamTable.tsx`
- Modify: `src/app/crm/components/Shell.tsx` (nav "Team" for managers), `src/app/crm/layout.tsx` (pass `canAssign` already exists — reuse it for nav)
- Test: `src/lib/__tests__/crmTeamRights.test.ts`

**Interfaces:**
- Produces (`teamRights.ts`, pure):
  - `TEAM_LANGUAGES = ["en", "de", "pl", "ru"] as const`
  - `type TeamPatch = { canSeeColleagues?: boolean; canEditColleagues?: boolean; languages?: string[]; specialties?: string[]; acceptsLeads?: boolean }`
  - `normalizeRights(current: { canSeeColleagues: boolean; canEditColleagues: boolean }, patch: { canSeeColleagues?: boolean; canEditColleagues?: boolean }): { canSeeColleagues: boolean; canEditColleagues: boolean }` — edit on ⇒ see on; see off ⇒ edit off
  - `validateTeamPatch(raw: unknown): { ok: true; patch: TeamPatch } | { ok: false; error: string }` — languages ⊆ TEAM_LANGUAGES (deduped, order kept), specialties trimmed, empty dropped, deduped case-insensitively, ≤ 10 items, each ≤ 40 chars; booleans must be booleans; unknown keys rejected
- Produces (`audit.ts`, server): `writeAudit(actor: { id: string; name: string; email: string }, action: string, targetType: string, targetId: string, detail?: Record<string, unknown>): Promise<void>`
- Produces (`team/actions.ts`): `updateTeamMemberAction(userId: string, raw: unknown): Promise<{ ok: true } | { error: string }>`

- [ ] **Step 1: Failing test** `src/lib/__tests__/crmTeamRights.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRights, validateTeamPatch } from "@/lib/crm/teamRights";

const off = { canSeeColleagues: false, canEditColleagues: false };

test("turning edit on also turns see on", () => {
  assert.deepEqual(normalizeRights(off, { canEditColleagues: true }), { canSeeColleagues: true, canEditColleagues: true });
});

test("turning see off also turns edit off", () => {
  assert.deepEqual(normalizeRights({ canSeeColleagues: true, canEditColleagues: true }, { canSeeColleagues: false }), off);
});

test("see on alone leaves edit off", () => {
  assert.deepEqual(normalizeRights(off, { canSeeColleagues: true }), { canSeeColleagues: true, canEditColleagues: false });
});

test("languages are limited to the four working languages and deduped", () => {
  const r = validateTeamPatch({ languages: ["de", "en", "de"] });
  assert.deepEqual(r, { ok: true, patch: { languages: ["de", "en"] } });
  assert.equal(validateTeamPatch({ languages: ["he"] }).ok, false);
  assert.equal(validateTeamPatch({ languages: ["fr"] }).ok, false);
});

test("specialties are trimmed, deduped case-insensitively and capped", () => {
  const r = validateTeamPatch({ specialties: [" Paphos ", "paphos", "", "Limassol"] });
  assert.deepEqual(r, { ok: true, patch: { specialties: ["Paphos", "Limassol"] } });
  assert.equal(validateTeamPatch({ specialties: Array.from({ length: 11 }, (_, i) => `Town ${i}`) }).ok, false);
  assert.equal(validateTeamPatch({ specialties: ["x".repeat(41)] }).ok, false);
});

test("booleans must be booleans and unknown keys are rejected", () => {
  assert.equal(validateTeamPatch({ acceptsLeads: "yes" }).ok, false);
  assert.equal(validateTeamPatch({ role: "ADMIN" }).ok, false);
  assert.equal(validateTeamPatch(null).ok, false);
  assert.deepEqual(validateTeamPatch({ acceptsLeads: false }), { ok: true, patch: { acceptsLeads: false } });
});
```
- [ ] **Step 2:** Run `node --import tsx --test src/lib/__tests__/crmTeamRights.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement `src/lib/crm/teamRights.ts`:**
```ts
// Employee rights and owner-suggestion inputs for the /crm/team screen (2026-10-18). Pure.
export const TEAM_LANGUAGES = ["en", "de", "pl", "ru"] as const;
export type TeamPatch = { canSeeColleagues?: boolean; canEditColleagues?: boolean; languages?: string[]; specialties?: string[]; acceptsLeads?: boolean };

const KEYS = new Set(["canSeeColleagues", "canEditColleagues", "languages", "specialties", "acceptsLeads"]);

export function normalizeRights(
  current: { canSeeColleagues: boolean; canEditColleagues: boolean },
  patch: { canSeeColleagues?: boolean; canEditColleagues?: boolean },
): { canSeeColleagues: boolean; canEditColleagues: boolean } {
  let see = patch.canSeeColleagues ?? current.canSeeColleagues;
  let edit = patch.canEditColleagues ?? current.canEditColleagues;
  if (patch.canEditColleagues === true) see = true;
  if (patch.canSeeColleagues === false) edit = false;
  if (!see) edit = false;
  return { canSeeColleagues: see, canEditColleagues: edit };
}

export function validateTeamPatch(raw: unknown): { ok: true; patch: TeamPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid input." };
  const patch: TeamPatch = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEYS.has(k)) return { ok: false, error: `Unknown field: ${k}` };
    if (k === "languages") {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return { ok: false, error: "Languages must be a list." };
      const langs = [...new Set(v as string[])];
      if (langs.some((l) => !(TEAM_LANGUAGES as readonly string[]).includes(l))) return { ok: false, error: "Unknown language." };
      patch.languages = langs;
    } else if (k === "specialties") {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return { ok: false, error: "Specialties must be a list." };
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of (v as string[]).map((x) => x.trim()).filter(Boolean)) {
        if (s.length > 40) return { ok: false, error: "A specialty can be at most 40 characters." };
        if (seen.has(s.toLowerCase())) continue;
        seen.add(s.toLowerCase());
        out.push(s);
      }
      if (out.length > 10) return { ok: false, error: "At most 10 specialties." };
      patch.specialties = out;
    } else {
      if (typeof v !== "boolean") return { ok: false, error: `${k} must be true or false.` };
      (patch as Record<string, boolean>)[k] = v;
    }
  }
  return { ok: true, patch };
}
```
- [ ] **Step 4:** Run the test → PASS (6 tests).
- [ ] **Step 5: `src/lib/crm/audit.ts`:**
```ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function writeAudit(
  actor: { id: string; name: string; email: string },
  action: string, targetType: string, targetId: string, detail?: Record<string, unknown>,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: { actorId: actor.id, actorName: actor.name, actorEmail: actor.email, action, targetType, targetId, detail: (detail ?? null) as Prisma.InputJsonValue },
  });
}
```
- [ ] **Step 6: `src/app/crm/team/actions.ts`:**
```ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { normalizeRights, validateTeamPatch } from "@/lib/crm/teamRights";
import { writeAudit } from "@/lib/crm/audit";

export async function updateTeamMemberAction(userId: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
  const actor = await requireCrmUser();
  if (!canAssignLeads(actor)) return { error: "Only admins can change team settings." };
  const v = validateTeamPatch(raw);
  if (!v.ok) return { error: v.error };
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isOwner: true, canSeeColleagues: true, canEditColleagues: true, languages: true, specialties: true, acceptsLeads: true },
  });
  if (!target) return { error: "Employee not found." };
  const touchesRights = v.patch.canSeeColleagues !== undefined || v.patch.canEditColleagues !== undefined;
  if (touchesRights && (target.isOwner || target.role === "ADMIN")) return { error: "Admins always see everything." };
  const rights = normalizeRights(target, v.patch);
  const data = { ...v.patch, ...(touchesRights ? rights : {}) };
  await prisma.user.update({ where: { id: userId }, data });
  await writeAudit(actor, "crm_team_update", "User", userId, {
    before: { canSeeColleagues: target.canSeeColleagues, canEditColleagues: target.canEditColleagues, languages: target.languages, specialties: target.specialties, acceptsLeads: target.acceptsLeads },
    after: data,
  });
  revalidatePath("/crm/team");
  return { ok: true };
}
```
- [ ] **Step 7: `src/app/crm/team/page.tsx`** (server): `requireCrmUser`; non-managers → `redirect("/crm/pipeline")`; load active users ordered by name with `id, name, email, role, isOwner, canSeeColleagues, canEditColleagues, languages, specialties, acceptsLeads` plus the active-lead count per user (same `groupBy` as the inbox); render header "Team" + subtitle "Who sees which leads, and who gets new ones." and `<TeamTable rows={…} />`.
- [ ] **Step 8: `src/app/crm/components/TeamTable.tsx`** (client): one row per employee (card layout on phones): name + email; for admins/owner a muted pill "Sees everything (admin)"; for editors two switches "See colleagues' leads" / "Edit colleagues' leads" (switch = `<button role="switch" aria-checked>`); language chips EN/DE/PL/RU toggle; specialties input (comma-separated, saved on blur/Enter); "Takes new leads" switch; active-lead count. Each change calls `updateTeamMemberAction(id, patch)` optimistically, rolls back and shows the error toast on failure (`useToast`). The see/edit switches mirror `normalizeRights` locally so the UI shows the implied state at once.
- [ ] **Step 9: Nav.** In `Shell.tsx` add `Team` (and in Task 4 `Commissions`) links for managers (`user.canAssign`).
- [ ] **Step 10:** `npm test && npx tsc --noEmit && npm run lint`; commit with explicit paths: `"CRM v2: team screen — rights, languages, specialties, takes-new-leads, audited"`.

---

### Task 3: Old-CRM gate for restricted employees

**Files:**
- Create: `src/lib/crm/oldCrmGate.ts`, `src/app/admin/(panel)/crm/layout.tsx`
- Test: `src/lib/__tests__/crmOldCrmGate.test.ts`

**Interfaces:**
- Consumes: `seesAllLeads`, `CrmUser` (access.ts), `loadCrmUser` (accessUser.ts), `auth`.
- Produces: `mayUseOldCrm(u: CrmUser | null): boolean` (= `u !== null && seesAllLeads(u)`).

- [ ] **Step 1: Failing test:**
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mayUseOldCrm } from "@/lib/crm/oldCrmGate";
const base = { id: "u", role: "EDITOR" as const, isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };
test("restricted employees are kept out of the old CRM", () => { assert.equal(mayUseOldCrm(base), false); });
test("employees who see all leads, admins and the owner may use it", () => {
  assert.equal(mayUseOldCrm({ ...base, canSeeColleagues: true }), true);
  assert.equal(mayUseOldCrm({ ...base, role: "ADMIN" }), true);
  assert.equal(mayUseOldCrm({ ...base, isOwner: true }), true);
});
test("no user, no access", () => { assert.equal(mayUseOldCrm(null), false); });
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** `src/lib/crm/oldCrmGate.ts`:
```ts
import { seesAllLeads, type CrmUser } from "./access";
// The old /admin/crm does not know per-employee visibility, so only people who
// may see every lead are let in (operator decision 2026-10-18).
export function mayUseOldCrm(u: CrmUser | null): boolean {
  return u !== null && seesAllLeads(u);
}
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: `src/app/admin/(panel)/crm/layout.tsx`** (new file; the only file added under `src/app/admin/`):
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadCrmUser } from "@/lib/crm/accessUser";
import { mayUseOldCrm } from "@/lib/crm/oldCrmGate";

// CRM v2 gate (2026-10-18): employees who may only see their own leads work in
// the new CRM at /crm; the old CRM would show them every lead. Known limit: the
// old CRM's server actions are not re-scoped (that would change the old CRM).
export default async function OldCrmGate({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  const user = id ? await loadCrmUser(id) : null;
  if (!mayUseOldCrm(user)) redirect("/crm/pipeline");
  return <>{children}</>;
}
```
Confirm no `layout.tsx` already exists in `src/app/admin/(panel)/crm/` (if one exists, STOP and report — the plan assumed none).
- [ ] **Step 6:** Extend `crmStatusSitesUseCentralList.test.ts`? No — add to `crmOldCrmGate.test.ts` a check that the layout file exists and imports `mayUseOldCrm` (readFileSync), so a future refactor cannot silently drop the gate.
- [ ] **Step 7:** `npm test && npx tsc --noEmit && npm run lint`; commit: `"CRM v2: keep restricted employees out of the old CRM (gate layout)"`.

---

### Task 4: Commissions screen (rates + deal payout stages)

**Files:**
- Create: `src/lib/crm/rateForm.ts`, `src/lib/crm/commissionActions.ts`, `src/app/crm/commissions/page.tsx`, `src/app/crm/commissions/actions.ts`, `src/app/crm/components/RatesEditor.tsx`, `src/app/crm/components/DealsTable.tsx`
- Modify: `src/app/crm/components/Shell.tsx` (nav "Commissions" for managers)
- Test: `src/lib/__tests__/crmRateForm.test.ts`, `src/lib/__tests__/crmCommissionActions.test.ts`

**Interfaces:**
- Consumes: `canTransitionCommission`, `COMMISSION_STATUSES`, `CommissionStatusValue` (commission.ts); `writeAudit`; `requireCrmUser`; `canAssignLeads`.
- Produces (`rateForm.ts`, pure): `parseRate(input: string): { ok: true; value: number } | { ok: false; error: string }` — accepts "10", "5.5", "5,5", "7.25 %"; rejects ≤ 0, > 100, more than 2 decimals, non-numbers.
- Produces (`commissionActions.ts`, pure): `type PayoutAction = "DEVELOPER_PAID" | "PAID_OUT" | "CANCELLED"`; `payoutActions(status: CommissionStatusValue): PayoutAction[]` — EARNED → [DEVELOPER_PAID, CANCELLED]; DEVELOPER_PAID → [PAID_OUT, CANCELLED]; EXPECTED → [CANCELLED]; PAID_OUT/CANCELLED → []; every returned action must satisfy `canTransitionCommission(status, action)`.
- Produces (`commissions/actions.ts`): `saveRateAction(input: { developerAccountId: string; developmentId: string | null; rate: string }): Promise<{ ok: true } | { error: string }>`; `deleteRateAction(rateId: string)`; `setDealStageAction(dealId: string, to: PayoutAction, onDate: string /* YYYY-MM-DD */): Promise<{ ok: true } | { error: string }>`.

- [ ] **Step 1: Failing tests:**
```ts
// src/lib/__tests__/crmRateForm.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRate } from "@/lib/crm/rateForm";
test("plain, decimal-comma and percent-sign inputs parse", () => {
  assert.deepEqual(parseRate("10"), { ok: true, value: 10 });
  assert.deepEqual(parseRate("5,5"), { ok: true, value: 5.5 });
  assert.deepEqual(parseRate(" 7.25 % "), { ok: true, value: 7.25 });
});
test("out-of-range and over-precise rates are rejected", () => {
  for (const bad of ["0", "-1", "100.01", "5.555", "abc", ""]) assert.equal(parseRate(bad).ok, false, bad);
  assert.deepEqual(parseRate("100"), { ok: true, value: 100 });
});
```
```ts
// src/lib/__tests__/crmCommissionActions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { payoutActions } from "@/lib/crm/commissionActions";
import { canTransitionCommission, COMMISSION_STATUSES } from "@/lib/crm/commission";
test("payout buttons per stage", () => {
  assert.deepEqual(payoutActions("EXPECTED"), ["CANCELLED"]);
  assert.deepEqual(payoutActions("EARNED"), ["DEVELOPER_PAID", "CANCELLED"]);
  assert.deepEqual(payoutActions("DEVELOPER_PAID"), ["PAID_OUT", "CANCELLED"]);
  assert.deepEqual(payoutActions("PAID_OUT"), []);
  assert.deepEqual(payoutActions("CANCELLED"), []);
});
test("every offered action is an allowed transition", () => {
  for (const s of COMMISSION_STATUSES) for (const a of payoutActions(s)) assert.ok(canTransitionCommission(s, a), `${s}→${a}`);
});
```
- [ ] **Step 2:** Run both → FAIL.
- [ ] **Step 3: Implement:**
```ts
// src/lib/crm/rateForm.ts — parse an operator-typed commission rate (2026-10-18). Pure.
export function parseRate(input: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = input.trim().replace(/%$/, "").trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return { ok: false, error: "Enter a percentage like 10 or 5.5 (max. 2 decimals)." };
  const value = Number(s);
  if (!(value > 0 && value <= 100)) return { ok: false, error: "The rate must be above 0 and at most 100 %." };
  return { ok: true, value };
}
```
```ts
// src/lib/crm/commissionActions.ts — which payout buttons a deal offers (2026-10-18). Pure.
import { canTransitionCommission, type CommissionStatusValue } from "./commission";
export type PayoutAction = "DEVELOPER_PAID" | "PAID_OUT" | "CANCELLED";
const ORDER: PayoutAction[] = ["DEVELOPER_PAID", "PAID_OUT", "CANCELLED"];
export function payoutActions(status: CommissionStatusValue): PayoutAction[] {
  return ORDER.filter((a) => canTransitionCommission(status, a) && !(status === "EXPECTED" && a !== "CANCELLED"));
}
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: `src/app/crm/commissions/actions.ts`** (`"use server"`): every action `requireCrmUser()` + `canAssignLeads` (else `{ error: "Only admins can change commissions." }`).
  - `saveRateAction`: `parseRate`; developer account must exist; if `developmentId` set, the development must belong to that account; upsert — default row: `findFirst({ developerAccountId, developmentId: null })` then update or create; override row: `upsert` on `developmentId` (unique); `writeAudit(actor, "crm_rate_save", "CommissionRate", id, { developerAccountId, developmentId, before, after })`; `revalidatePath("/crm/commissions")`. **Existing deals keep their stored rate** (no recalculation) — state this in the UI copy.
  - `deleteRateAction`: delete by id; audit `crm_rate_delete` with the deleted row.
  - `setDealStageAction`: validate `to` ∈ payout actions of the current status (read inside `prisma.$transaction(async tx => …)` with `SELECT … FOR UPDATE` on the deal row: `` tx.$queryRaw`SELECT id FROM deals WHERE id = ${dealId} FOR UPDATE` ``); parse `onDate` (`/^\d{4}-\d{2}-\d{2}$/`, not in the future); update `commissionStatus` + `developerPaidAt`/`paidOutAt`/`cancelledAt` = that date at 12:00 UTC; audit `crm_deal_stage` with from/to/date; revalidate.
- [ ] **Step 6: `src/app/crm/commissions/page.tsx`** (server, managers only, else redirect): two sections.
  - **Rates:** for each developer account (name = admin label `DeveloperAccount.name`, fine for internal use): default rate (or "No default rate"), and overrides with project name; plus a "+ Project override" row whose project select lists that account's developments (published first). Load with `developerAccount.findMany({ orderBy: { name: "asc" }, select: { id, name, commissionRates: { select: { id, developmentId, ratePercent, development: { select: { publicName } } } }, developments: { select: { id, publicName, publishStatus }, orderBy: { publicName: "asc" } } } })`; convert `ratePercent.toNumber()`.
  - **Deals:** all deals not CANCELLED, newest first (take 300): lead name (link to `/crm/leads/<id>`), project, unit, price, our rate + source (show "rate missing" when `rateSource === "MISSING"`), our commission, partner commission (if any), status pill, stage dates, and the payout buttons from `payoutActions` (date input defaulting to today). Totals row per status (sum of `ourCommission`).
- [ ] **Step 7: `RatesEditor.tsx` / `DealsTable.tsx`** (client) call the actions, show errors via `useToast`, and refresh. Rate input uses `inputMode="decimal"`; save on Enter/blur; delete with an inline confirm ("Remove override?" Yes/No — no `window.confirm`).
- [ ] **Step 8:** Nav item "Commissions" for managers in `Shell.tsx`.
- [ ] **Step 9:** `npm test && npx tsc --noEmit && npm run lint`; commit: `"CRM v2: commissions screen — developer/project rates and deal payout stages, audited"`.

---

### Task 5: Lead cockpit `/crm/leads/[id]`

**Files:**
- Create: `src/lib/crm/timeline.ts`, `src/app/crm/leads/[id]/page.tsx`, `src/app/crm/leads/actions.ts`, `src/app/crm/components/CockpitHeader.tsx`, `src/app/crm/components/CockpitTimeline.tsx`, `src/app/crm/components/CockpitLogForm.tsx`, `src/app/crm/components/CockpitDeals.tsx`, `src/app/crm/components/CockpitStage.tsx`
- Test: `src/lib/__tests__/crmTimeline.test.ts`

**Interfaces:**
- Consumes: `canViewLead`, `canEditLead`, `canAssignLeads`, `seesAllLeads` (access.ts); `logLeadInteraction(actor: EmailActor, leadId, input)` and `bodyRequirement` (logInteraction.ts); `LOGGABLE_TYPES` (src/lib/mcp/tools/logInteractionInput.ts); `moveLeadAction`, `assignLeadAction` (src/app/crm/actions.ts); `MoveDialog` (components); `STATUS_LABEL`, `LOST_REASON_LABEL` (leadStatus.ts).
- Produces (`timeline.ts`, pure):
  - `type TimelineInput = { id: string; type: string; direction: string | null; channel: string | null; subject: string | null; body: string | null; occurredAt: Date; createdByName: string | null; metadata: unknown }`
  - `type TimelineItem = { id: string; kind: "call" | "note" | "whatsapp" | "email" | "status" | "presentation" | "booking" | "system"; inbound: boolean; title: string; text: string | null; at: string /* ISO */; by: string | null }`
  - `toTimeline(rows: TimelineInput[]): TimelineItem[]` — sorted newest first; titles: CALL "Call", NOTE "Note", WHATSAPP_IN "WhatsApp received", WHATSAPP_OUT "WhatsApp sent", EMAIL_IN "Email received" (+ subject), EMAIL_OUT "Email sent" (+ subject), STATUS_CHANGE "Moved to {label}" from `metadata.toStatus` (+ " · {lost reason label}" when `metadata.lostReason`), PRESENTATION_EVENT / BOOKING_EVENT use the body as title, SYSTEM uses the body; text truncated to 600 chars with "…".
- Produces (`leads/actions.ts`): `logInteractionAction(leadId: string, raw: unknown): Promise<{ ok: true } | { error: string }>` — validates with `LogInteractionInput` (zod) merged with the leadId, requires `canEditLead`, calls `logLeadInteraction`.

- [ ] **Step 1: Failing test** `src/lib/__tests__/crmTimeline.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toTimeline, type TimelineInput } from "@/lib/crm/timeline";
const row = (o: Partial<TimelineInput>): TimelineInput => ({ id: "i", type: "NOTE", direction: null, channel: null, subject: null, body: "x", occurredAt: new Date("2026-10-18T10:00:00Z"), createdByName: "Sophie", metadata: null, ...o });
test("newest first, with readable titles", () => {
  const t = toTimeline([row({ id: "a", type: "CALL", occurredAt: new Date("2026-10-17T10:00:00Z") }), row({ id: "b", type: "EMAIL_IN", subject: "Re: Eden Coast" })]);
  assert.deepEqual(t.map((x) => x.id), ["b", "a"]);
  assert.equal(t[0].title, "Email received · Re: Eden Coast");
  assert.equal(t[0].inbound, true);
  assert.equal(t[1].kind, "call");
});
test("status changes name the stage and the lost reason", () => {
  const t = toTimeline([row({ type: "STATUS_CHANGE", body: "Status changed to LOST", metadata: { toStatus: "LOST", lostReason: "BUDGET" } })]);
  assert.equal(t[0].kind, "status");
  assert.equal(t[0].title, "Moved to Lost · Budget does not fit");
});
test("long texts are cut at 600 characters", () => {
  const t = toTimeline([row({ body: "y".repeat(700) })]);
  assert.equal(t[0].text!.length, 601);
  assert.ok(t[0].text!.endsWith("…"));
});
test("WhatsApp direction comes from the type", () => {
  const t = toTimeline([row({ type: "WHATSAPP_OUT" }), row({ id: "j", type: "WHATSAPP_IN", occurredAt: new Date("2026-10-19T00:00:00Z") })]);
  assert.equal(t[0].title, "WhatsApp received");
  assert.equal(t[1].title, "WhatsApp sent");
});
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** implement `timeline.ts` per the interface (use `STATUS_LABEL`, `LOST_REASON_LABEL`, `isLeadStatus`; unknown status values fall back to the raw string). **Step 4:** Run → PASS.
- [ ] **Step 5: `src/app/crm/leads/actions.ts`** (`"use server"`):
```ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canEditLead } from "@/lib/crm/access";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { LogInteractionInput } from "@/lib/mcp/tools/logInteractionInput";

export async function logInteractionAction(leadId: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
  const user = await requireCrmUser();
  const parsed = LogInteractionInput.safeParse({ ...(raw && typeof raw === "object" ? raw : {}), leadId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
  if (!lead || !canEditLead(user, lead)) return { error: "Lead not found." };
  const { occurredAt, ...rest } = parsed.data;
  await logLeadInteraction({ userId: user.id, userName: user.name }, leadId, { ...rest, occurredAt: occurredAt ? new Date(occurredAt) : undefined });
  revalidatePath(`/crm/leads/${leadId}`);
  return { ok: true };
}
```
Match `logLeadInteraction`'s real `LogInteractionInput` parameter type (check `src/lib/crm/logInteraction.ts`): pass exactly the fields it expects.
- [ ] **Step 6: `src/app/crm/leads/[id]/page.tsx`** (server): `requireCrmUser`; load lead (`deletedAt: null`) with contact fields, status, lostReason, source, languagePreference, budget, timeline, financing, message, notes, createdAt, assignedTo, projectInterest title, attributionRef, utm fields, deals (+ development publicName), interactions (last 100, the TimelineInput fields); if missing or `!canViewLead(user, lead)` → `notFound()`. Also load active employees for the assignment select when `canAssignLeads`. Layout (two columns ≥ 1024 px, one column below):
  - **Header** (`CockpitHeader`): name (display font), language badge, source chip (partner chip styled), status chip in its stage colour, owner, "created 3 d ago"; contact block with phone/email as selectable text plus `tel:`/`mailto:`/WhatsApp `https://wa.me/<digits>` links; budget/timeline/financing; enquiry message (quoted, muted); attribution (utm/ref) collapsed.
  - **Stage** (`CockpitStage`, client): a stage stepper of `FUNNEL_STATUSES` plus "Keep contact" / "Lost" buttons; clicking calls `moveLeadAction` and reuses `MoveDialog` for deal / lost reason / cancel confirmation (same answer-merging rules as the board: accumulate answers in a ref per move). Disabled when `!canEditLead`.
  - **Deals** (`CockpitDeals`): each deal with project, unit, price, our rate (or "rate missing"), our commission, partner commission, status pill and stage dates; managers see the payout buttons from Task 4 (`setDealStageAction`).
  - **Log** (`CockpitLogForm`, client): type selector (Call, Note, WhatsApp sent/received, Email sent/received), body textarea, subject for email types, optional date/time (default now), "The lead replied" checkbox → `logInteractionAction`; disabled when `!canEditLead`.
  - **Timeline** (`CockpitTimeline`): `toTimeline` items with a kind icon (inline SVG, no emoji), title, text (pre-wrap), relative time with absolute date in `title`, author.
  - **Assignment** (managers): owner select + "Assign" → `assignLeadAction`, toast from its result.
  - **Old cockpit link** "Presentations, matching, email →" to `/admin/crm/<id>`, rendered only when `seesAllLeads(user)`.
- [ ] **Step 7:** Styles in `crm.css` under `.crm-cockpit` using existing tokens only.
- [ ] **Step 8:** `npm test && npx tsc --noEmit && npm run lint`; commit: `"CRM v2: lead cockpit — header, stage control, deals, log form, timeline, assignment"`.

---

### Task 6: Phase 2b wrap-up

- [ ] **Step 1:** `npm test && npx tsc --noEmit && npm run lint` — report counts. Confirm `git diff --stat <2b-base>..HEAD -- src/app/admin` lists only `src/app/admin/(panel)/crm/layout.tsx` (added).
- [ ] **Step 2:** Final whole-branch review of the 2b range (most capable model), one fix wave, scoped re-review.
- [ ] **Step 3:** Push. Hand-over: what is new under `/crm`, the gate and its known limit, that no migration is added in 2b (Phase 1 migrations still pending deploy), and an offer to preview on the throwaway demo DB (`scratchpad/pgscripts/serve-demo.mjs`, config `crm-v2-demo`) — browser use only on the operator's go.
