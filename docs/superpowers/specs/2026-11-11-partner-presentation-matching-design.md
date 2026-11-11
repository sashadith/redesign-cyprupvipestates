# Partner portal: client presentations built like the CRM (matching, map, units)

Date: 2026-11-11. Operator request: "the creation of the client presentation should work exactly like in our CRM, with the map and the matches", confirmed "ja wie in unserem CRM genauso" — including unit-level selection.

## Why

Today a partner picks a client and ticks up to 12 project names from a plain list; every available unit of each project goes into the presentation. Our advisors in CRM v2 build the same presentation from filters, a scored match list, a map and per-unit picks, which produces a far better selection. Partners should work the same way.

## What changes (the "New presentation" section of `/presentations` in the partner portal)

The flow follows the CRM "New presentation" modal (`src/app/crm/components/PresentationModal.tsx`, create mode only), in the partner portal's look and four languages:

1. **Client** — the partner's effectively ACTIVE clients, as today (`myPresentationClients`). Picking a client loads the matcher; nothing else shows before a client is chosen. `?client=<claimId>` (pipeline "New selection") still preselects.
2. **Filters** — same set as the CRM filter strip: budget min/max, bedrooms (Studio, 1–4, 5+), property type, district → area cascade (area chips only for the picked districts), "only with available units". Not offered: "include ready (unpublished) projects" — partners only ever see published projects.
   - Starting values: the budget the partner submitted for this client (lead budgetMin/max), `onlyAvailable: true`. Not the lead's property-type interest: partners never submit it, so any value there was set by our advisor and is not shown to the partner. *(My call.)* Project names follow the alias rule the matcher already applies (`override.alias || publicName`), the same names as elsewhere in the portal.
   - The partner's own last filters per client are remembered **in the browser** (localStorage, key per claim id), not on the lead: `lead.lastMatchFilters` belongs to our advisor's search and must not be overwritten by a partner. *(My call: avoids a schema migration; cost = not shared across devices.)*
3. **Match list** — the CRM matcher (`matchDevelopmentsForLead`) runs on the server for the chosen client with the partner's filters, debounced, newest response wins. Each row as in the CRM: thumbnail, name, place, match % (same score and colour bands), "from" price, delivery, available-unit count, and a "sent before" mark when this partner already sent the project to this client. Sort: best match, delivery, price, district, area (`RESULT_SORTS`).
   - 100 % matches with at least one exactly matching unit tick themselves; hand ticks/unticks win, as in the CRM.
   - Expand a row → its units (ref, type, beds, area, price, status); exact matches pre-ticked, "show all units (N more)" to add near misses by hand; picking units by hand makes it a hand pick.
   - Per project a note to the client (maps to the item's `advisorComment`, max 300 characters).
   - Cap stays at **12 projects** per presentation (existing partner rule); ticking a 13th is refused with a message.
4. **Map** — the selected projects as pins with the "life nearby" layer: the CRM's `MatchingMap`, given a `lang` prop so its card text follows the portal language (today hard-wired to English).
5. **Greeting name, language, personal note** — as today. Generate → same success screen as today (copy link, open, new presentation).

The presentation then stores what the CRM stores: items with `unitRefs`/`unitIds` (only the picked units), `sortIndex`, `advisorComment`, and `criteria` = the filter snapshot (drives the "your preferences" chips on the client page). `partnerId` set, `advisorId` null (partner branding), 30-day expiry — unchanged.

## What a partner never sees

The matcher's DTO is reduced on the server before it leaves: no developer name or account id, no commission/our rate, no `publishStatus`, no unpublished projects, no projects outside `myProjects`. Location options come from published projects only. "Sent before" counts only this partner's own presentations to this client — never what our advisors sent.

## Server rules (untrusted input)

- Every action calls `requirePartner({ active: true })` and checks the claim is one of the partner's effectively ACTIVE clients (same rule as the current create action, re-checked inside the write transaction).
- Filters are parsed into `MatchFilters` with bounds (numbers, known bed values, at most N strings of bounded length); `includeReady` is always false.
- On create: every project must be in the partner's published set; at most 12; units are resolved against that development's **available** units — refs/ids that don't belong to it are dropped; a project whose picks resolve to nothing is refused with the same "no matching unit" message as the CRM. Note ≤ 300 chars, no control characters.
- Rate limit: existing `partnerLimits.presentation` for create; a separate, looser limit for match calls.
- Audit: `partner_presentation_created` as today, plus unit count.

## Reuse

- Matching, scoring, sort and item building: `src/lib/crm/matching.ts`, `presentationModalState.ts` (`buildItems`, `sortResults`, `shownPriceFrom`, …) — pure and shared, so partner and CRM agree by construction. The partner DTO keeps the `DevelopmentMatch` shape with the internal fields blanked, so these helpers apply unchanged.
- UI: new partner components (portal classes, i18n via the partner dictionaries); the CRM components stay English/admin-styled and untouched apart from the map's `lang` prop.

## Also in scope (operator, 2026-11-11: "Bitte auch implementieren")

### Edit an existing presentation (CRM edit mode)
From the partner's presentation list, "Edit" opens the same builder on that presentation (only the partner's own, not revoked, claim still effectively ACTIVE):
- "In this selection": the items in their order — move up/down, remove (asks first when the client favourited it), per item: name shown to the client, note, unit picks (available units, the saved picks ticked; a sold-out project is flagged).
- "Add projects": the matcher below, starting from the presentation's saved `criteria`; projects already in it are not offered again. Added items are marked new for the client (`isNew`, `newAddedAt`), as the CRM does.
- General: greeting name, language, personal note, expiry date (from tomorrow up to 90 days ahead — *my call*; extending an expired one reactivates it).
- Saving re-snapshots `criteria`; the 12-project cap applies to the total. Audit `partner_presentation_edited` with the CRM's edit summary.
- Server mirrors `savePresentationEdit`: items not sent back are deleted, existing ones updated, new ones created, all in one transaction; the same validation as create (own published projects, units resolved against available units, lengths).

### New from favourites
On a presentation where the client hearted projects, "New from favourites" opens a new presentation for the same client with filters built from the hearted projects (`favoritesSeedFromRows` → `filtersFromFavorites`) and those projects pre-ticked — only those still published and in `myProjects`, named with the partner-facing alias.

### Name shown to the client (alias)
Per selected project an optional display name (max 120 chars), stored as the item's `aliasName` — the client page already shows it instead of the project name. Available when creating and editing.

### Sending: the partner's own mail program and WhatsApp (operator choice 1)
No mail leaves our system. After creating (and after saving an edit) the success screen offers:
- **Email**: a `mailto:` link to the client's email from the partner's submission, subject and body prefilled in the presentation language, signed with the partner's name (brand name if set, else first and last name). The partner sends it from their own mailbox; replies go to them. Hidden when the submission has no email.
- **WhatsApp**: `wa.me/<client phone>` with the prefilled text; after an edit the shorter "I've updated your selection" text. Hidden without a phone.
- Copy link / open / new presentation as today.
The texts are partner copies, not the CRM's: no "from Cyprus VIP Estates" in the subject, partner signature. Four languages, in the partner dictionaries.

## Not in scope

The advisor's saved-notes library (CRM users only).

## Verification

Unit tests for the DTO reduction (no developer/commission fields), filter parsing, unit resolution and the 12-cap; testbed run (DEPLOYMENT.md, assert-not-prod-db) creating a presentation as a partner and opening the client page to see only the picked units; screenshots desktop + phone.
