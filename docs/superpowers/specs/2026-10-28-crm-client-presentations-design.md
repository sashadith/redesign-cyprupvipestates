# Client Presentations in the new CRM — design

Date: 2026-10-28 · Owner: Sascha Dith · Status: draft for review

## Intent

Personal selections ("client presentations") are today built and tracked only
in the old admin CRM (`/admin/crm/[id]`: `PropertyMatching.tsx`, `MatchingMap.tsx`,
`ExistingPresentations.tsx`, `presentations/[id]/edit/PresentationEditor.tsx`,
`presentationActions.ts`). The team works in the new CRM (`/crm/leads/[id]`
cockpit) and has to jump to the old one for this — the cockpit even carries a
link "Presentations, matching, email →". The operator is happy with how the old
flow works; the goal is to bring it over unchanged in function and add five
improvements on top.

Why it matters: a sent selection is what triggers developer registration
(PR #170, "registration is one of the most important things"), and what the
client does with it (views, favorites) is the best signal for when to call.

## Goals

1. A **Client Presentations** block in the cockpit's right column, directly
   under "Developer registrations".
   - Header with a **New** button.
   - List of the lead's existing selections with the same information and
     actions as `ExistingPresentations.tsx`: status (active / expired /
     revoked; active past `expiresAt` shows as expired), created date,
     advisor, view count, favorites count, per-development views + time spent,
     ♥ on favorited ones; actions copy link, open, extend, revoke, delete, edit.
   - Selections created by partners (`partnerId` set) are listed too, marked
     with the partner's name.
2. **New** opens a large modal with the full Property Matching of the old CRM:
   filters (budget min/max, bedrooms, district, area, property type, the two
   checkboxes the old panel has), the map, the result list with expandable
   units, per-unit selection, per-project advisor comment, greeting name,
   locale, advisor, personal note, the dropped-units warning, generate, and the
   result screen (link, copy, QR, WhatsApp, email compose).
3. **Edit** opens the same modal in edit mode for an existing selection (the
   old standalone editor page's functions: add/remove projects and units,
   comments, alias names, greeting/note/locale, "New for you" marking via
   `isNew/newAddedAt`). The modal replaces the old edit page for the new CRM.
4. After a selection is created or edited, the **Developer registrations block
   refreshes immediately** so its "Developers from personal selections" list
   shows the new developers. Nothing is registered automatically — the
   operator clicks Register themselves (explicit operator decision).
5. Improvements (all approved by the operator):
   - **I-2 "Already sent" labels:** in the matching result list, a project
     that was in an earlier selection of this lead shows a small label, e.g.
     "sent 12.10. · 3 views · ♥". It stays selectable.
   - **I-3 Follow-up from favorites:** an action on an existing selection,
     "New from favorites", opens the New modal with that selection's favorited
     projects pre-selected and filters pre-filled to match them (their
     districts/areas, a budget range around their prices, their bedroom
     counts and types). Disabled when the selection has no favorites.
   - **I-4 Signals on the Today page:** a card "Hot selections" listing
     selections the client engaged with recently (opened, time spent,
     favorited) so the owner calls now; plus selections expiring within 3 days
     that still get views, with an Extend action.
   - **I-5 Prefilled filters:** the New modal starts from the lead's saved
     `lastMatchFilters` if present, otherwise from the lead's own profile
     (budget, bedrooms, preferred areas/districts, property type from the
     qualification fields).

## Non-goals

- No change to the public presentation page (`/c/[token]`), its tracking, or
  the data model's meaning. Same tables, same tokens, same links.
- No automatic developer registration.
- The old admin CRM keeps working as is; nothing is removed there in this
  project.
- No new matching algorithm — `src/lib/crm/matching` is reused.

## Anti-goals (would make this a failure even if it works)

- Two diverging implementations of matching/generation logic. Server logic
  (match, generate, edit-save, revoke, extend, delete) must be shared with the
  old CRM, not copied.
- A selection created in the new CRM that looks or tracks differently on the
  public page than one from the old CRM.
- A modal that loses the operator's work on an accidental outside click or Esc
  (confirm before discarding a dirty form).

## Constraints

- Stack: Next.js 14 app router, server actions, Prisma; new-CRM styling in
  `src/app/crm/crm.css` with the existing tokens/classes (`crm-btn`,
  `crm-ck-*`), not the old admin's Tailwind look.
- All CRM copy English (project rule). Client-facing texts (greeting,
  presentation page, email template) stay localized as today.
- Permissions: whoever may edit the lead in the new CRM (`canEditLead`) may
  create, edit, extend, revoke. Delete (hard delete, wipes tracking) is owner-only
  (`user.isOwner`) in the new CRM; others revoke. Operator decision. Every new
  server action checks the user and the lead itself (middleware does not cover
  these routes reliably).
- tsconfig has no target: no Map/Set iteration via spread/for-of, no `u` regex
  flag.
- The map is MapLibre (`MatchingMap.tsx`, client-only dynamic import).
- No migration expected; if the "Hot selections" query needs an index on
  `presentation_views(createdAt)` it already exists.

## Decided by the operator

- Block position: right column, directly under Developer registrations.
- Same structure and functions as the old CRM, including the map.
- After creation: refresh the registrations block only; registering stays a
  manual click.
- Improvements I-2, I-3, I-4, I-5 approved as described above.
- Delete is owner-only in the new CRM; the old CRM is left as is.

## Left to the builder (my calls, marked so the operator can check)

- Extracting the old client components into shared pieces vs. building new
  new-CRM-styled components that call the same server actions — builder's
  choice, as long as server logic is shared (anti-goal 1).
- The modal is full-screen on phones, wide (≈1100px) on desktop, map beside or
  above the result list.
- "Hot selections" thresholds: last 48 h, and at least one of: opened,
  ≥ 60 s on a project, a new favorite. Owner sees all leads, others their own
  (same rule as the Today "Register with developers" card). Rows link to the
  lead with the block in view.
- Budget range for I-3: min/max of the favorited projects' available-unit
  prices, ±15 %.
- The `/c/[token]` view/favorite Telegram alerts keep their text; their "CRM"
  link may switch to the new CRM lead page.
- The cockpit link "Presentations, matching, email →" is removed once the block
  exists (email compose remains reachable from the presentation result screen).

## Builder-check answers (my calls)

- **Shared logic, guarded entry points:** generation (today `POST
  /api/admin/presentations`) and edit-save (`PUT /api/admin/presentations/[id]`)
  move into a lib module (e.g. `src/lib/crm/presentations/`). The old routes and
  old actions call that module and keep their current checks unchanged (no
  behaviour change in the old CRM). The new CRM gets its own server actions
  that check `canEditLead` on the presentation's lead before calling the same
  module.
- **`lastMatchFilters`** stays one field written by both CRMs — it means "the
  last search for this client", whichever screen ran it. Profile fallback for
  I-5: `budgetMin/budgetMax` → budget, lead bedrooms → bedrooms, preferred
  location values → district if they name a district, else area, property type
  → propertyTypes via the existing qualifier vocabulary.
- **Email from the result screen:** reuse `ComposeEmailModal` +
  `sendCrmEmailAction(leadId, { skipCadence: true })`, same semantics as the
  old page.
- **Partner selections** count everywhere: listed, "already sent" labels, and
  "New from favorites".
- **Hot selections:** an entry drops off once an outbound contact (call, email,
  WhatsApp) is logged on the lead after the signal, or after 48 h.
- **Edit mode:** removing a project the client favorited asks for confirmation;
  added projects get `isNew/newAddedAt` as the old editor does.
