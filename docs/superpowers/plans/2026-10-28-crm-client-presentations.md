# Client Presentations in the new CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Client Presentations" block in the new CRM cockpit (list + New/Edit modal with the full Property Matching incl. map), plus "already sent" labels, "New from favorites", and a "Hot selections" Today card.

**Architecture:** The old CRM's create / edit-save / revoke / extend / delete logic moves out of the API routes and `presentationActions.ts` into `src/lib/crm/presentations/` (pure helpers + thin Prisma functions). Old routes/actions call it with unchanged checks; new-CRM server actions call it behind `requireCrmUser` + `canEditLead` (delete: `isOwner`). New UI components live in `src/app/crm/components/`, styled with `crm.css`; `MatchingMap.tsx` is reused as-is.

**Tech Stack:** Next.js 14 app router, server actions, Prisma/Postgres, node:test + tsx (`node --import tsx --test`), MapLibre.

**Spec:** `docs/superpowers/specs/2026-10-28-crm-client-presentations-design.md`

## Global Constraints

- All CRM copy English; client-facing texts (greeting, WhatsApp/email templates, `/c/[token]`) unchanged and localized as today.
- Old CRM behaviour unchanged: `/api/admin/presentations` POST, `/api/admin/presentations/[id]` PUT and `src/app/admin/(panel)/crm/[id]/presentationActions.ts` keep their current auth checks and responses.
- Every new server action: `requireCrmUser()` then `canEditLead(user, lead)`; delete additionally `user.isOwner`.
- tsconfig has no `target`: no spread/for-of over Map/Set (use `Array.from`), no `u` regex flag.
- No Prisma migration.
- Never run anything against `.env.local`'s DATABASE_URL (it is production). UI checks use the demo DB at 127.0.0.1:55440 via a `.claude/launch.json` entry; never run `prisma migrate`/`db push`/shadow commands against it.
- Never run cron routes locally; never send Telegram.
- Commit only inside the worktree; never `git add -A`.

## Review Focus

1. Modal closed by Esc / backdrop / Cancel with unsaved picks → must confirm before discarding (Task 8 test `confirmDiscard`).
2. A presentation whose lead the user may not edit (restricted employee, colleague's lead) → every new action refuses, including revoke/extend/edit via a guessed id (Task 6 test).
3. Selection listed as "active" but past `expiresAt` → shown as expired everywhere (list, I-2 label, hot card) (Task 2 test).
4. "New from favorites" on a selection whose favorited development is unpublished/without prices → still pre-selected; budget filter left empty instead of NaN/0 (Task 4 test).
5. Creating a selection in the new CRM → Developer registrations block on the same page shows the new developers without a manual reload (Task 6: action calls `revalidatePath('/crm/leads/'+leadId)`; Task 8 calls `router.refresh()` after success).

---

### Task 1: Shared presentation core (extract from old routes)

**Files:**
- Create: `src/lib/crm/presentations/core.ts`
- Modify: `src/app/api/admin/presentations/route.ts`, `src/app/api/admin/presentations/[id]/route.ts`, `src/app/admin/(panel)/crm/[id]/presentationActions.ts`
- Test: `src/lib/__tests__/crmPresentationsCore.test.ts`

**Interfaces:**
- Produces:
  - `type Actor = { id: string | null; name: string }`
  - `type PresentationItemInput = { developmentId: string; unitRefs?: string[] | null; unitIds?: string[] | null; sortIndex?: number; advisorComment?: string | null; aliasName?: string | null }`
  - `type PresentationInput = { items: PresentationItemInput[]; locale: Locale; greetingName: string; personalNote: string | null; advisorId: string | null; criteria: Record<string, unknown> | undefined; expiresAt?: Date | null }`
  - `cleanPresentationInput(body: unknown, opts: { defaultAdvisorId: string | null }): { ok: true; input: PresentationInput } | { ok: false; error: string }` — the exact normalisation the routes do today (greeting ≤120 → "there", note ≤2000, comment ≤300, alias ≤120, locale via `isPublicLocale` else "en", items required).
  - `editSummary(existing: { developmentId: string; aliasName: string | null; advisorComment: string | null }[], incoming: PresentationItemInput[]): { toRemoveDevIds: string[]; added: number; removed: number; summary: string }` — summary string exactly as today ("2 added, 1 removed, 1 alias changed, 1 comment changed" / "details updated").
  - `createPresentation(actor: Actor, leadId: string, input: PresentationInput, origin: string): Promise<{ id: string; token: string; url: string; qrSvg: string; whatsappUrl: string | null } | { error: "not_found" }>` — create + LeadActivity + LeadInteraction (`PRESENTATION_CREATED`) + `applyFollowUpCadence(leadId,"presentation_sent")` + QR + WhatsApp, as in POST today.
  - `savePresentationEdit(actor: Actor, id: string, input: PresentationInput, origin: string): Promise<{ leadId: string; url: string; whatsappUrl: string | null; summary: string } | { error: "not_found" }>` — the PUT transaction, unchanged semantics (new items `isNew: true, newAddedAt: now`).
  - `revokePresentation(actor, id)`, `extendPresentation(actor, id, days: number)`, `deletePresentation(actor, id)`: each `Promise<{ leadId: string } | null>`, same rows as today.
  - `presentationLeadId(id: string): Promise<{ leadId: string; assignedToId: string | null } | null>` (for guards).

- [ ] **Step 1: Write failing tests** for the pure parts:
```ts
test("cleanPresentationInput normalises like the old routes", () => {
  const r = cleanPresentationInput({ items: [{ developmentId: "d1", advisorComment: " x ".padEnd(400, "y") }], greetingName: "  ", locale: "xx", personalNote: "" }, { defaultAdvisorId: "u1" });
  assert.ok(r.ok);
  assert.equal(r.input.greetingName, "there"); assert.equal(r.input.locale, "en");
  assert.equal(r.input.personalNote, null); assert.equal(r.input.advisorId, "u1");
  assert.equal(r.input.items[0].advisorComment!.length, 300);
  assert.deepEqual(cleanPresentationInput({ items: [] }, { defaultAdvisorId: null }), { ok: false, error: "At least one item is required" });
});
test("editSummary counts like the PUT route", () => {
  const s = editSummary([{ developmentId: "a", aliasName: null, advisorComment: "c" }, { developmentId: "b", aliasName: null, advisorComment: null }],
    [{ developmentId: "a", advisorComment: "new", aliasName: "A" }, { developmentId: "c" }]);
  assert.deepEqual(s, { toRemoveDevIds: ["b"], added: 1, removed: 1, summary: "1 added, 1 removed, 1 alias changed, 1 comment changed" });
  assert.equal(editSummary([{ developmentId: "a", aliasName: null, advisorComment: null }], [{ developmentId: "a" }]).summary, "details updated");
});
```
- [ ] **Step 2:** `node --import tsx --test src/lib/__tests__/crmPresentationsCore.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `core.ts`; rewrite the two routes and the old actions to call it. Routes keep `requireSession()`, their status codes and JSON bodies; old actions keep `revalidatePath('/admin/crm/'+leadId)`. `core.ts` additionally revalidates `/crm/leads/${leadId}`.
- [ ] **Step 4:** Tests PASS; `npx tsc --noEmit -p .` shows no new errors in touched files; `npm test` no new failures (one pre-existing locale-plumbing failure is known).
- [ ] **Step 5:** Commit `Presentations: shared core for create/edit/revoke/extend/delete`.

### Task 2: Presentation rows for the list

**Files:**
- Create: `src/lib/crm/presentations/rows.ts`
- Modify: `src/app/admin/(panel)/crm/[id]/page.tsx` (use `buildPresentationRows` instead of its inline mapping; `ExistingPresentations` keeps its `PresentationRow` type — make it an alias of `PresentationListRow`'s compatible subset or map)
- Test: `src/lib/__tests__/crmPresentationsRows.test.ts`

**Interfaces:**
- Produces:
  - `type RawPresentation` = the Prisma shape loaded by `loadLeadPresentations` (below).
  - `type PresentationListRow = { id; token; status: string; effectiveStatus: "active" | "expired" | "revoked"; createdAt: Date; expiresAt: Date | null; advisorName: string | null; partnerName: string | null; viewCount: number; uniqueDays: number; favoritedCount: number; lastViewedAt: Date | null; items: { developmentId: string; developerAccountId: string | null; name: string; isFavorited: boolean; views: number; durationSec: number }[] }`
  - `buildPresentationRows(raw: RawPresentation[], now: Date): PresentationListRow[]` — name = item `aliasName` || override alias || publicName; effectiveStatus = "expired" when status "active" and `expiresAt <= now`.
  - `loadLeadPresentations(leadId: string): Promise<RawPresentation[]>` (newest first; includes views, items+development name/override alias/developerAccountId, advisor name, partner name).
- [ ] **Step 1: Failing tests:** expired-by-date → `effectiveStatus "expired"`; per-item views/duration summed only from views with that `developmentId`; `uniqueDays` counts distinct UTC dates; `partnerName` passed through; alias precedence.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement; switch old page to it (rendering unchanged). **Step 4:** PASS + tsc. **Step 5:** commit.

### Task 3: "Already sent" history (I-2)

**Files:** Create `src/lib/crm/presentations/sentHistory.ts`; Test `src/lib/__tests__/crmPresentationsSent.test.ts`

**Interfaces:**
- Consumes: `PresentationListRow` (Task 2).
- Produces:
  - `type SentInfo = { lastSentAt: Date; views: number; favorited: boolean; times: number }`
  - `sentHistory(rows: PresentationListRow[], excludeId?: string): Record<string, SentInfo>` keyed by developmentId; revoked selections still count; `excludeId` skips the selection being edited.
  - `sentLabel(s: SentInfo): string` → `"sent 12.10. · 3 views · ♥"` (date `dd.mm.` Europe/Nicosia; views part omitted at 0; `♥` only when favorited; `"sent 2× · last 12.10."` prefix when times > 1).
- [ ] Steps 1–5 as above with tests for: two selections → newest date + summed views + times 2; partner selection counts; excludeId; label variants (0 views, favorited, times>1).

### Task 4: Filters from favorites (I-3) and initial filters (I-5)

**Files:** Create `src/lib/crm/presentations/seedFilters.ts`; Test `src/lib/__tests__/crmPresentationsSeed.test.ts`

**Interfaces:**
- Consumes: `MatchFilters` from `src/lib/crm/matching.ts`.
- Produces:
  - `initialFilters(lead: { budgetMin: number | null; budgetMax: number | null; propertyTypeInterest: string[]; lastMatchFilters: unknown }): MatchFilters` — exactly the old panel's init (`PropertyMatching.tsx:63-68`): defaults `{budgetMin, budgetMax, bedrooms: [], districts: [], areas: [], propertyTypes: propertyTypeInterest, includeReady: false, onlyAvailable: true}` overlaid by `lastMatchFilters` when it is a plain object. Ruling: the Lead model has no bedroom or location fields, so I-5's profile fallback is budget + property types only.
  - `filtersFromFavorites(favs: { district: string | null; area: string | null; prices: number[]; beds: (number | null)[]; type: string | null }[]): MatchFilters` — districts/areas = distinct non-empty values; budgetMin = round(min(prices) × 0.85), budgetMax = round(max(prices) × 1.15), both `null` when no prices; bedrooms = distinct non-null beds (≥5 → 5); propertyTypes = distinct non-null types; `onlyAvailable: true, includeReady: false`.
- [ ] Steps 1–5; tests: lastMatchFilters wins over profile; non-object lastMatchFilters ignored; favorites with prices [200000, 300000] → 170000/345000; no prices → nulls (Review Focus 4); beds 6 → 5; duplicates removed.

### Task 5: Hot selections (I-4)

**Files:** Create `src/lib/crm/presentations/hot.ts`; Test `src/lib/__tests__/crmPresentationsHot.test.ts`

**Interfaces:**
- Produces:
  - `HOT_WINDOW_MS = 48 * 3_600_000`, `HOT_MIN_PROJECT_SEC = 60`, `EXPIRING_WITHIN_MS = 3 * 86_400_000`.
  - `type HotInput = { presentationId; leadId; leadName; ownerId: string | null; ownerName: string | null; status: string; expiresAt: Date | null; views: { developmentId: string | null; durationSec: number | null; createdAt: Date }[]; favorites: { name: string; favoritedAt: Date | null }[]; lastOutboundAt: Date | null }`
  - `type HotRow = { presentationId; leadId; leadName; ownerName: string | null; kind: "hot" | "expiring"; signalAt: Date; reasons: string[]; expiresAt: Date | null }`
  - `hotSelections(inputs: HotInput[], now: Date): HotRow[]` — only live selections (active and not expired). "hot" when within 48 h there is a view, a project view with durationSec ≥ 60, or a favorite; `signalAt` = newest such event; dropped when `lastOutboundAt >= signalAt`. reasons e.g. `"opened 2×"`, `"4 min on Sea Line"`, `"♥ Sea Line"`. "expiring" when `expiresAt - now <= 3 days` and it had ≥1 view in the last 7 days (shown even if also hot? no — a hot row wins, no duplicate). Sorted by signalAt desc.
  - `loadHotSelections(user: SessionCrmUser, now: Date): Promise<HotRow[]>` — owner sees all leads, others `assignedToId = user.id` (same rule as the Today "Register with developers" card); `lastOutboundAt` = newest LeadInteraction of type in `SLA_OUTBOUND_TYPES` (`src/lib/crm/sla.ts`).
- [ ] Steps 1–5; tests: view 49 h ago → nothing; 30 s project view only counts as "opened"; call logged after the signal drops it; expired-by-date selection excluded; expiring row with recent view, not duplicated when also hot.

### Task 6: New-CRM server actions

**Files:** Create `src/app/crm/leads/presentationActions.ts`; Test `src/lib/__tests__/crmPresentationsGuard.test.ts` (pure guard)

**Interfaces:**
- Consumes: Task 1 core, Task 2 loader, `matchDevelopmentsForLead`, `listPresentationLocations` logic (move its body to `src/lib/crm/presentations/locations.ts` and call it from both old and new actions), `sendLeadEmail` (`src/lib/crm/sendLeadEmail.ts`).
- Produces (all `"use server"`, all return `{ error: string }` on refusal, never throw to the client):
  - `presentationGuard(user: CrmUser, lead: { assignedToId: string | null } | null, op: "edit" | "delete"): string | null` (pure, exported from `src/lib/crm/presentations/guard.ts`): null = allowed; "Lead not found." when lead null or `!canEditLead`; "Only the owner can delete a selection." for delete without `isOwner`.
  - `matchAction(leadId, filters: MatchFilters): Promise<DevelopmentMatch[] | { error }>`
  - `saveFiltersAction(leadId, filters)`; `locationsAction(): Promise<LocationOptions>`
  - `createPresentationAction(leadId, body: unknown)` → core result; origin from `headers()` (`x-forwarded-proto` + `host`, fallback `https://cyprusvipestates.com`), same as the old route.
  - `loadPresentationForEditAction(id): Promise<EditPayload | { error }>` where `EditPayload = { presentation: { id; leadId; locale; greetingName; personalNote; advisorId; expiresAt; criteria }; items: EditorItem[] }` — move the edit page's item mapping (`presentations/[presentationId]/edit/page.tsx:29-60`) into `src/lib/crm/presentations/editorItems.ts` and use it from both.
  - `savePresentationEditAction(id, body)`, `revokePresentationAction(id)`, `extendPresentationAction(id, days: 7 | 14 | 30)`, `deletePresentationAction(id)`
  - `sendPresentationEmailAction(leadId, opts: { subject; body; leadReacted?; presentationToken? })` → `sendLeadEmail(..., { ...opts, skipCadence: true })`, revalidates `/crm/leads/${leadId}`.
  - Every mutating action calls `revalidatePath('/crm/leads/'+leadId)` (Review Focus 5).
- [ ] Step 1: failing test for `presentationGuard`: restricted employee on colleague's lead → "Lead not found."; assignee edit → null; assignee delete → owner message; owner delete → null; inactive user → "Lead not found." (Review Focus 2).
- [ ] Steps 2–5.

### Task 7: Cockpit block "Client Presentations" (list)

**Files:** Create `src/app/crm/components/CockpitPresentations.tsx`; Modify `src/app/crm/leads/[id]/page.tsx`, `src/app/crm/crm.css`

**Interfaces:**
- Consumes: `PresentationListRow` (Task 2), actions (Task 6).
- Produces: `CockpitPresentations({ leadId, rows, canEdit, isOwner, lead: ModalLead, users, currentUser })`.
- Page: load `buildPresentationRows(await loadLeadPresentations(lead.id), now)`; render the block in `crm-ck-aside` directly after `CockpitRegistrations`; remove the `crm-ck-old` "Presentations, matching, email →" link.
- Each row: date, effective status badge, advisor or "by partner {name}", "N views · N days · N ♥", expandable per-project list (name, ♥, views, time `m:ss`), actions: Copy link, Open (`/c/{token}` new tab), Extend (7/14/30), Revoke (confirm), Edit (Task 9), New from favorites (Task 9; disabled without favorites), Delete only when `isOwner` (confirm text "Delete this selection and all its view tracking?"). Revoked rows hide Revoke/Extend/Edit.
- Header: title "Client Presentations", button "New" (Task 8). Empty state: "No selections sent yet."
- [ ] Step 1: Implement; Step 2: demo check (see Task 10's launch entry) — list renders for the seeded lead, Delete hidden for a non-owner user. Step 3: commit.

### Task 8: Presentation modal — create

**Files:** Create `src/app/crm/components/PresentationModal.tsx`, `src/app/crm/components/presentationModalState.ts`; Modify `crm.css`; Test `src/lib/__tests__/crmPresentationModalState.test.ts`

**Interfaces:**
- Consumes: Task 3 `sentHistory/sentLabel`, Task 4 `initialFilters`, Task 6 actions, `MatchingMap` (dynamic, `ssr:false`, from `src/app/admin/(panel)/crm/[id]/MatchingMap.tsx`), `ComposeEmailModal` + `PRESENTATION_EMAIL_TEMPLATE`.
- Produces:
  - `PresentationModal({ mode: { kind: "new"; seed?: { filters: MatchFilters; preselect: string[] } } | { kind: "edit"; presentationId: string }, lead: ModalLead, sent: Record<string, SentInfo>, users, currentUser, onClose })`
  - `type ModalLead = { id; firstName; budgetMin; budgetMax; propertyTypeInterest: string[]; languagePreference: string | null; phone: string | null; email: string | null; lastMatchFilters: unknown }`
  - pure `presentationModalState.ts`: `isDirty(state, initial): boolean`, `confirmDiscard(dirty: boolean, confirmFn: (msg: string) => boolean): boolean` (returns true when closing is allowed; message "Discard this selection? Your picks will be lost."), `buildItems(selectedDevIds, unitOverrides, comments, results): PresentationItemInput[]` (same unitRefs/unitIds rules as `PropertyMatching.tsx` generate()).
- Function parity with `PropertyMatching.tsx`: filters (budget min/max, bedrooms chips incl. Studio and 5+, district chips, area chips when a district is picked, property type chips, include-ready, only-available), debounced match + `saveFiltersAction`, auto-select logic incl. `manuallyUnchecked`, expandable units with show-all toggle, per-project comment, map with markers synced to selection, greeting (with `suggestedGreeting`), locale, advisor, personal note, dropped-units warning, generate, result screen (URL, copy, QR, WhatsApp, Email via ComposeEmailModal → `sendPresentationEmailAction`).
- I-2: each result row shows `sentLabel(sent[devId])` when present (still selectable).
- Close via Esc/backdrop/Cancel goes through `confirmDiscard` (Review Focus 1); after successful create call `router.refresh()` (Review Focus 5).
- Layout: `<dialog class="crm-dialog crm-pres-dialog">` width `min(1100px, calc(100vw - 32px))`; ≤760 px full-screen; filters top, map + results side by side ≥1000 px, stacked below.
- [ ] Step 1: failing tests for `isDirty`, `confirmDiscard` (clean → true without calling confirmFn; dirty + confirm false → false), `buildItems` (unit override → unitRefs normalized via `normalizeRef`; manual unit without ref → unitIds; untouched project → unitRefs of matchedUnits).
- [ ] Steps 2–4; Step 5: demo check — New → filters prefilled from lastMatchFilters, map shows pins, generate creates a selection, list and the Developer registrations "from personal selections" list update without reload. Commit.

### Task 9: Modal — edit mode and "New from favorites"

**Files:** Modify `PresentationModal.tsx`, `CockpitPresentations.tsx`; Create `src/lib/crm/presentations/favoritesSeed.ts` (server: load favorited items' development district/area/available unit prices/beds/type → `filtersFromFavorites`) exposed via `favoritesSeedAction(presentationId)` in Task 6's file.

- Edit: loads `loadPresentationForEditAction`; shows current items first (alias field, comment, unit picks), matching panel below to add projects (seeded with the selection's `criteria`), `sent` computed with `excludeId` = this id; removing an item with `isFavorited` asks "The client favorited {name}. Remove it anyway?"; save → `savePresentationEditAction`; result screen shows URL + WhatsApp "updated" link + summary.
- New from favorites: `favoritesSeedAction` → open New with `seed = { filters, preselect: favoritedDevIds }`.
- [ ] Step 1: test for `favoritesSeed` mapping helper (pure part: rows → `filtersFromFavorites` input, beds parsed with `parseBeds`, prices from available units only). Steps 2–4. Step 5: demo check edit (add one project, remove one) + from favorites (seed a favorite in the demo DB with `prisma db execute --file`). Commit.

### Task 10: Today card "Hot selections" + Telegram links + demo launch entry

**Files:** Modify `src/app/crm/today/page.tsx`, `crm.css`, `src/app/api/c/[token]/view/route.ts`, `src/app/api/c/[token]/favorite/route.ts`, `.claude/launch.json` (main tree; entry `crm-pres`, port 3121, copied from `crm-regdue` with the worktree path).
- Today: section after "Register with developers", title "Hot selections", empty → section hidden. Row: lead link `/crm/leads/{id}#presentations`, reasons joined " · ", relative time, owner (when the viewer sees all); expiring rows show "expires in N days" + Extend 7 days button (`extendPresentationAction`). Summary line gains "N hot".
- `CockpitPresentations` root gets `id="presentations"`.
- Telegram: the "CRM" link in the view/favorite alerts points to `/crm/leads/{leadId}` (text unchanged otherwise; the favorite alert gains the same link).
- [ ] Demo check with seeded views; commit.

### Task 11: Final verification

- [ ] `npm test` (only the known pre-existing failure), `npx tsc --noEmit -p .` (no new errors in touched files), `npx next lint` on touched files.
- [ ] Old CRM regression on demo: `/admin/crm/{lead}` create + edit + revoke still work through the old UI.
- [ ] Screenshots of block, modal (desktop + 390 px), Today card → SendUserFile.
- [ ] PR (no migration → plain deploy).
