# Partner Presentation Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partners build, edit and share client presentations in the portal the way advisors do in CRM v2 (filters, scored matches, map, unit picks, notes, alias, favourites), shared through their own mail program and WhatsApp.

**Architecture:** The CRM matcher (`matchDevelopmentsForLead`) and the pure modal helpers (`presentationModalState.ts`) are reused unchanged. A partner layer reduces every match to the partner's published projects and blanks internal fields, validates all input on the server, and writes `ClientPresentation` rows exactly as `createPresentation` / `savePresentationEdit` do. New portal-styled, localized client components render the builder on `/presentations`.

**Tech Stack:** Next.js 14 server actions, Prisma, React client components, node:test via `npm test`.

**Spec:** `docs/superpowers/specs/2026-11-11-partner-presentation-matching-design.md`

## Global Constraints

- Partner-facing copy in en/de/pl/ru (partner dictionaries, identical keys — `partnerI18n.test.ts`); never Hebrew.
- Never to the client bundle: developer name/account, commission/our rate (except trust mode, not needed here), `publishStatus`, projects outside `myProjects`, unpublished projects, advisor-sent history.
- Every action: `requirePartner({ active: true })`; claim must be one of `myPresentationClients(partnerId)`; re-checked ACTIVE inside the write transaction.
- Max 12 projects per presentation (`MAX_PRESENTATION_PROJECTS`); note ≤ 300, alias ≤ 120, greeting ≤ 60, personal note ≤ 600; no control characters (newline allowed in personal note only).
- Expiry on edit: from tomorrow to today + 90 days (Europe/Nicosia date).
- No schema migration. Partner filters remembered in localStorage key `pp-pres-filters:<claimId>`.
- Radii in portal CSS use `calc(Npx * var(--ds-radius-scale))` (designPortalCss test).
- No mail leaves our system: `mailto:` and `wa.me` links only.

## Review Focus

1. A forged create/save body naming another partner's presentation, a non-published project or a unit of a different project → refused or dropped, never written (Task 1 tests).
2. A project whose picked units are all sold by the time of saving → refused with "no matching unit" instead of an empty item (Task 1 test).
3. Client without email/phone in the submission → share buttons hidden, not a broken `mailto:` (Task 3 test).
4. Edit of a presentation whose claim lapsed or which is revoked → load and save refused (Task 2 guard test via pure `canEditPartnerPresentation`).
5. Filters from localStorage that are malformed or stale (districts no longer offered) → parsed defensively, unknown values dropped (Task 1 `parsePartnerFilters` test).

---

### Task 1: Pure partner layer — filters, match reduction, item validation

**Files:**
- Create: `src/lib/partner/presentationBuilder.ts`
- Test: `src/lib/__tests__/partnerPresentationBuilder.test.ts`

**Interfaces:**
- Produces:
  - `parsePartnerFilters(raw: unknown): MatchFilters` — budgetMin/Max integers 0..1e9 or null; bedrooms ⊆ [0..5]; propertyTypes ⊆ `PROPERTY_VALUES` (`@/app/components/qualifierFields`); districts/areas ≤ 30 strings each, ≤ 80 chars; `onlyAvailable` boolean (default true); `includeReady` always false.
  - `toPartnerMatch(m: DevelopmentMatch, allowed: ReadonlySet<string>): DevelopmentMatch | null` — null when `m.development.id` ∉ allowed or `publishStatus !== "published"`; otherwise same object with `developer: null`, `commission: { ratePercent: null, source: "MISSING" }`.
  - `type PartnerItemInput = { developmentId: string; unitRefs: string[] | null; unitIds: string[] | null; aliasName: string; advisorComment: string }`
  - `type DevUnits = { name: string; units: { id: string; ref: string | null; status: string | null }[] }`
  - `validatePartnerItems(raw: unknown, ctx: { allowed: ReadonlySet<string>; devs: ReadonlyMap<string, DevUnits> }): { ok: true; items: PresentationItemInput[] } | { ok: false; code: "err.presentationProjects" | "err.presentationUnits" | "err.presentationText"; developmentId?: string }` — array 1..12, unique ids in allowed; refs kept only where `normalizeRef(unit.ref, dev.name)` of an available unit; ids kept only for available units without ref; both empty after filtering while the request named some → `err.presentationUnits`; null/null = whole project; alias/comment trimmed with limits; sortIndex = array order.
  - `canEditPartnerPresentation(p: { partnerId: string | null; status: string; leadId: string }, me: { partnerId: string; activeLeadIds: ReadonlySet<string> }): boolean` — own, not revoked, lead among active clients.
  - `expiryFromInput(s: string, now: Date): Date | null` — YYYY-MM-DD; today = `now` as a Europe/Nicosia calendar date; valid range [today+1, today+90]; returns `Date.UTC(y, m-1, d, 21, 59, 59)` (end of that day in Cyprus, close enough across DST); null when malformed or out of range.

- [ ] **Step 1: Write failing tests** covering: filter parsing (garbage → defaults; `includeReady: true` → false; 7 bedrooms dropped; 31 districts → 30); `toPartnerMatch` blanks developer/commission and drops ids outside `allowed`; `validatePartnerItems` drops a ref from another project, keeps a manual unit by id, refuses all-sold picks with `err.presentationUnits`, refuses 13 items, refuses an unknown project, trims a 121-char alias to refusal `err.presentationText`; `canEditPartnerPresentation` false for other partner, revoked, lapsed claim; `expiryFromInput` rejects today and today+91.
- [ ] **Step 2:** `node --import tsx --test src/lib/__tests__/partnerPresentationBuilder.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/lib/partner/presentationBuilder.ts` (no prisma import).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `Partner presentations: pure builder layer (filters, match reduction, item validation)`.

### Task 2: Server actions + published-only locations + throttle

**Files:**
- Create: `src/app/partner-portal/presentationBuilderActions.ts` (`"use server"`)
- Modify: `src/lib/crm/presentations/locations.ts` — `listPresentationLocationOptions(opts: { publishedOnly?: boolean } = {})`
- Modify: `src/lib/partner/limits.ts` — `presentationMatch: makeThrottle(600, HOUR)`
- Modify: `src/lib/partner/scope.ts` — `partnerSentHistory(partnerId, leadId, excludeId?)` using `sentHistory` from `@/lib/crm/presentations/sentHistory` over this partner's presentations only.

**Interfaces:**
- Consumes: Task 1 exports; `matchDevelopmentsForLead`, `buildEditorItems`, `favoritesSeedFromRows`, `editSummary`, `uniquePresentationToken`, `writePartnerAudit`, `myPresentationClients`, `myProjects`.
- Produces (all return `{ error: string }` codes from the partner dict on failure):
  - `partnerMatchAction(claimId: string, filters: unknown): Promise<DevelopmentMatch[] | { error }>` — lead budget only as `LeadLike` (no propertyTypeInterest).
  - `partnerLocationsAction(): Promise<LocationOptions | { error }>` — publishedOnly.
  - `partnerBuilderContextAction(claimId: string): Promise<{ filters: MatchFilters; sent: Record<string, SentInfo>; email: string | null; phone: string | null; firstName: string } | { error }>` — starting filters from lead budget, sent history, submission contact.
  - `createPartnerPresentationAction(body: { claimId; items; greetingName; personalNote; locale; criteria }): Promise<{ ok: true; id: string; url: string } | { error; field? }>`
  - `loadPartnerPresentationAction(id: string): Promise<{ presentation: { id; claimId; locale; greetingName; personalNote; expiresAt: string; criteria: MatchFilters | null }; items: EditorItem[]; favoritedIds: string[] } | { error }>`
  - `savePartnerPresentationAction(id: string, body: { items; greetingName; personalNote; locale; expiresAt; criteria }): Promise<{ ok: true; url: string; summary: string } | { error; field? }>` — mirrors `savePresentationEdit` (delete missing, update existing, create new with `isNew: true, newAddedAt`), sets `status: "active"` when the new expiry is in the future; audit `partner_presentation_edited`.
  - `partnerFavoritesSeedAction(id: string): Promise<FavoritesSeed | { error }>` — only favourited items still in `myProjects`; `preselectNames` with alias names.
- [ ] **Step 1:** Implement; `revalidatePath("/partner-portal/presentations")` after writes.
- [ ] **Step 2:** `npx tsc` (scratchpad override config) clean for these files; `npx eslint` on them.
- [ ] **Step 3:** Commit `Partner presentations: server actions for match, create, edit, favourites`.

### Task 3: Share links + dictionary keys

**Files:**
- Create: `src/lib/partner/presentationShare.ts`; Test: `src/lib/__tests__/partnerPresentationShare.test.ts`
- Modify: `src/lib/partner/i18n/{en,de,pl,ru}.ts` — `presentations.*` new keys (builder labels, sort labels, errors `err.presentationUnits`, `err.presentationText`, `err.presentationExpiry`, share texts).

**Interfaces:**
- Produces: `presentationMailto(t: PartnerDict, p: { email: string | null; greetingName: string; url: string; signer: string; updated: boolean }): string | null`; `presentationWhatsApp(t, p: { phone: string | null; greetingName; url; signer; updated }): string | null` (digits only, `https://wa.me/<digits>?text=`). Texts from `t.presentations.shareSubject`, `shareBody` (`{name}`, `{url}`, `{signer}`), `shareUpdated` (`{url}`, `{signer}`). No "Cyprus VIP Estates" in the subject.
- [ ] **Step 1:** Tests: null without email/phone; subject/body encoded; updated variant; phone "+357 99-123 456" → `wa.me/35799123456`.
- [ ] **Step 2–4:** fail → implement → pass (`partnerI18n.test.ts` too).
- [ ] **Step 5:** Commit.

### Task 4: Map language

**Files:** Modify `src/app/admin/(panel)/crm/[id]/MatchingMap.tsx` — optional prop `lang?: "en" | "de" | "pl" | "ru"` (default "en") passed to `projectsStrings`. CRM call sites unchanged.
- [ ] Commit with Task 5.

### Task 5: Builder UI

**Files:**
- Create: `src/app/partner-portal/components/presentationBuilder/PresentationBuilder.tsx` (create + edit + favourites seed; state like `PresentationModal` create/edit using `buildItems`, `sortResults`, `selectionMatches`, `unitsToList`, `shownPriceFrom`, `editorItemFromMatch`, `editPayloadItems`, `removeItemConfirm` semantics with localized confirm text), `BuilderFilters.tsx`, `BuilderResults.tsx`, `BuilderSelection.tsx`, `BuilderDone.tsx` (copy link, open, email, WhatsApp, new).
- Modify: `src/app/partner-portal/presentations/page.tsx` — render builder; `?client=`, `?edit=<id>`, `?favorites=<id>`; table gets "Edit" (active/expired, own active client) and "New from favourites" (favourites > 0).
- Modify: `src/app/partner-portal/components/presentationBits.tsx` — those two links.
- Remove the old `PresentationForm` once nothing imports it (keep `BrandForm` etc.).
- Modify: `src/app/partner-portal/portal.css` — builder styles (`pp-pb-*`).
- Behaviour pins: 100 % matches with ≥1 matching unit auto-tick; hand picks win; ticking a 13th project shows `presentations.capReached`; filters saved to localStorage on change (debounced 350 ms, same as match).
- [ ] Commit `Partner presentations: builder UI like the CRM`.

### Task 6: Verification

- [ ] `npm test` on the testbed (real Prisma client) → all pass.
- [ ] Testbed (DEPLOYMENT.md, `assert-not-prod-db`): as a partner with an active client, create a presentation with hand-picked units, open `/c/<token>` and see only those units; edit it (add, remove, alias, note, reorder, extend); new from favourites after hearting one item on the client page; screenshots 1440 and 390 px; no horizontal overflow.
- [ ] PR with summary; no deploy without the operator.
