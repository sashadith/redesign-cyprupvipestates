# CRM MCP Connector — Phase 3: Inventory tools (design)

**Status:** approved in chat 2026-09-08, spec for review
**Extends:** `docs/superpowers/specs/2026-09-07-crm-mcp-connector-design.md` (binding for
everything not restated here: hosts, OAuth, tool wrapper, audit, rate limits, never-return
list, testing conventions)
**Runbook:** `docs/CRM-MCP-CONNECTOR.md`

## Problem

The connector reads the project database only *through a lead*: `crm_get_project` needs an
id/slug/name, `crm_match_properties` needs a `leadId`. Two things the operator does every
day are therefore impossible from the chat:

1. **Browse the stock without a lead.** "What do we have in Paphos under 500k with sea
   view, completion 2027?" — for consultations, comparisons and Challenger-style
   alternatives ("three options next to the one you asked about").
2. **See what changed.** "Which projects had price moves, new units, or went from 3 to 1
   available unit in the last two weeks?" — the value-adding follow-up hook the project
   instructions demand for quiet leads. Today Claude has to guess, which is exactly what
   the instructions forbid.

Nothing in Phase 3 writes to the project database. Prices and statuses stay owned by the
feed syncs and the admin; a chat-side write error would land on the public website.

## Context established while designing

- Catalogue size (2026-09-08, prod): 238 published, 26 draft, 72 archived developments;
  ~3,000 units under published projects. Districts are sparse and inconsistent (131
  Paphos, 48 Limassol, 45 `null`, then Kouklia/Polis/Larnaca as "districts"); unit `type`
  is free text with casing/plural variants ("Villa", "Villas", "apartment",
  "Apartments / Penthouses"). Filtering must go through the existing normalisers
  (`src/lib/propertyTypes.ts`, the helpers in `src/lib/crm/matching.ts`), never raw
  string equality.
- **There is no price or status history.** `Development` and `DevelopmentUnit` carry
  `updatedAt` only; `SyncLog` has aggregate counts per feed run. The only dated
  transitions that exist are `Development.soldOutSince`, `returnedToMarketAt`
  (rolling, overwritten on the next event — see the schema comment), `publishedAt`, and
  `DevelopmentUnit.createdAt`. Anything about *price* changes or *which* unit was sold
  needs a snapshot we take ourselves.
- `Development.unitsTotal/unitsAvailable` are stale caches — every availability figure
  is computed from unit rows via `computeAvailability()` / `listedUnits()`
  (`src/lib/developmentAvailability.ts`), same as the rest of the app.
- The Action Center already reads `soldOutSince` / `returnedToMarketAt` for developer
  reminders (`src/lib/actionCenter/rules/developers.ts`); Phase 3 reuses those fields
  with the same "lower bound, not exact" phrasing for backfilled `soldOutSince`.
- Cron pattern to copy: `src/app/api/cron/mcp-cleanup/route.ts` (key check,
  `withCronLog`, Telegram on anomalies).
- The consent page lists tools by name from `src/lib/mcp/toolNames.ts`. Tokens are not
  scoped per tool, so new read tools become available to the already-connected claude.ai
  client without re-consent. Accepted for read-only tools; the runbook says so.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Two read tools: `crm_search_projects`, `crm_inventory_changes`. No write tools, no developer tool. | Covers both gaps; developer is a label on `Development` (filter + counts are enough; the legacy `Developer` content model is per-language Sanity text, out of scope). |
| 2 | Change detection via a **nightly snapshot table** (`DevelopmentSnapshot`), not hooks in the sync paths. | Isolated and additive; five sync writers (feed, drive, status-only, PDF import, admin editor) would each need a hook otherwise. History starts at rollout — the tool says so explicitly. |
| 3 | The changes tool compares the snapshot at the window start against the **live** state, not the last snapshot. | Today's changes count immediately; the cron is only there to remember the past. |
| 4 | Snapshots store a compact per-unit list `[{ id, status, price }]`. | Unit-level events ("unit 302 reserved", "unit price +5%") are the sales-relevant ones; ~3k units × 180 days is a few MB. |
| 5 | Default scope is `publishStatus = published`; `includeReady` opt-in and each row carries `publishStatus`. | Claude must not quote unpublished projects to customers; the instructions say when a row is not quotable. |
| 6 | Search is a filter + sort, not a score. | Scores only make sense relative to a lead; `crm_match_properties` already does that. |
| 7 | Retention 180 days, cleaned by the same cron. | Long enough for "since the lead last spoke to us" on a quarterly cadence; bounded table. |

## Architecture

```
claude.ai ──MCP──▶ /api/mcp ──▶ tools/searchProjects.ts ──▶ lib/crm/inventorySearch.ts ──▶ prisma (developments + units)
                              └▶ tools/inventoryChanges.ts ─▶ lib/crm/inventoryChanges.ts ─▶ prisma (snapshots + live)
cron (nightly) ───▶ /api/cron/inventory-snapshot ──▶ lib/crm/inventorySnapshot.ts ──▶ development_snapshots
```

New files:

- `src/lib/crm/inventorySearch.ts` — `searchDevelopments(filters): Promise<SearchResult>`;
  pure filter/sort helpers exported separately for tests.
- `src/lib/crm/inventorySnapshot.ts` — `captureSnapshots(now): Promise<{ captured, deleted }>`
  and `snapshotOf(development)` (pure).
- `src/lib/crm/inventoryChanges.ts` — `diffSnapshot(prev, current): ChangeEvent[]` (pure)
  and `inventoryChanges(params): Promise<ChangesResult>`.
- `src/lib/mcp/tools/searchProjects.ts`, `src/lib/mcp/tools/inventoryChanges.ts`.
- `src/app/api/cron/inventory-snapshot/route.ts`.
- `prisma/migrations/<ts>_add_development_snapshots/migration.sql`.
- Tests under `src/lib/mcp/__tests__/` and `src/lib/crm/__tests__/` (pure modules only,
  `node --test` via tsx, like the existing 53).

Small in-place refactor: `src/lib/crm/matching.ts` exports its private helpers
`normalizePropertyType(value)`, `unitMatchesBedrooms(unit, wanted)` and
`developmentMatchesLocation(dev, districts, areas)` so search and matching filter units
identically. No behaviour change in matching.

## Tool surface (Phase 3 — read)

Common rules from the Phase 1 spec apply (Zod validation, dates as `{ iso, local,
relative }`, `McpToolCall` row per call with `leadId = null`, per-token rate limit,
`readOnlyHint`/`idempotentHint` annotations).

### `crm_search_projects`

Input (all optional; empty input = the whole published catalogue, page 1):

| Field | Type | Notes |
|---|---|---|
| `query` | string 2–100 | case-insensitive contains on `publicName`, `developerName`, `developer`, `town`, `area` |
| `districts`, `areas` | string[] | same semantics as `MatchFilters` (district falls back to town) |
| `propertyTypes` | string[] | Apartment \| Villa \| Townhouse \| Penthouse, normalised |
| `bedrooms` | int[] 0–5 | 5 = 5+; a development matches if ≥1 listed unit matches |
| `budgetMin`, `budgetMax` | int | applied to **unit** prices (a development matches if ≥1 listed unit is in range); falls back to `priceFrom/priceTo` overlap when a development has no priced units |
| `onlyAvailable` | boolean = true | ≥1 available unit (computed) |
| `completionBefore` | string `YYYY` or `YYYY-MM` | compared against `completion` when it parses; developments with unparseable completion are kept and flagged `completionUnparsed: true` |
| `stage` | string | contains-match on `stage` / `status` (feed vocab differs per developer, so no enum) |
| `amenity` | string 2–40 | case-insensitive contains on `Development.amenities[]` or any unit `amenities[]` ("sea view", "pool") |
| `developer` | string | contains on `developer` / `developerName` |
| `includeReady` | boolean = false | adds `publishStatus = ready` |
| `sort` | `price_asc` \| `price_desc` \| `availability_desc` \| `updated_desc` \| `name` = `price_asc` | price sort uses the min matching unit price, else `priceFrom` |
| `page`, `pageSize` | int; pageSize 1–20 = 10 | |

Output:

```
{
  total, page, pageSize,
  summary: { byDistrict: { [district|"—"]: n }, byDeveloper: { [label]: n } },   // over the filtered set, not the page
  rows: [{
    developmentId, name, developer, publishStatus, slug,
    location: { area, district, town }, category, stage, completion, completionUnparsed?,
    priceFrom, priceTo, currency,
    availability: { total, available, soldOut },
    matchingUnits: { count, minPrice, maxPrice, types: string[] },   // units passing the unit-level filters
    publicUrl: { en, de, pl, ru } | null,                             // null unless published + slug
    lastSyncedAt: { iso, local, relative } | null
  }]
}
```

Never returned: `feedKey`, `feedProjectId`, `driveFolderId`, `newFromFeed`,
`imageDriftDetectedAt`, override internals, gallery/plan URLs (Claude gets the public URL;
images are not useful in chat).

Description text (for the model): "Browse the published project catalogue without a lead —
filters for location, type, bedrooms, budget, completion, amenities and developer. Rows carry
computed availability and a `publicUrl` only when the project is published; never quote a
row without `publicUrl` to a customer. For lead-specific ranking use `crm_match_properties`;
for full figures on one project use `crm_get_project`."

### `crm_inventory_changes`

Input:

| Field | Type | Notes |
|---|---|---|
| `days` | int 1–60 = 14 | window start = now − days |
| `developmentIds` | uuid[] ≤ 20 | e.g. the ids from `crm_match_properties` for one lead |
| `districts` | string[] | |
| `types` | ChangeType[] | filter event kinds |
| `limit` | int 1–100 = 40 | events, newest first |

Event kinds (`ChangeType`):

| Type | Source | Payload |
|---|---|---|
| `published` | `publishedAt` in window | — |
| `sold_out` | `soldOutSince` in window | `sinceIsLowerBound: true` when it equals the backfill stamp (same rule as the Action Center) |
| `back_on_market` | `returnedToMarketAt` in window | `availableNow` |
| `new_units` | units with `createdAt` in window under a published development | `count`, `types[]`, `priceRange`, `source: feed\|manual\|mixed` |
| `availability_changed` | snapshot vs live: computed `available` differs | `from`, `to`, `lastUnits: true` when `to ≤ 2 && to < from` |
| `price_from_changed` | snapshot vs live: `priceFrom` differs | `from`, `to`, `pct` |
| `unit_status_changed` | per unit in snapshot: status differs | `unitRef/label`, `from`, `to`, `price` — grouped per development, max 10 units listed + `more` |
| `unit_price_changed` | per unit: price differs by ≥1% | `unitRef/label`, `from`, `to`, `pct` — same grouping |

Rules:

- Snapshot-based events use the **oldest snapshot at or after the window start** as
  `prev` (so a 14-day window really compares against ~14 days ago) and the live rows as
  `current`. If no snapshot exists in the window, only the dated-field events are emitted
  and `coverage.snapshotBased = false`.
- Units are matched by `DevelopmentUnit.id`. A unit present in `prev` but gone live counts
  as `unit_status_changed { to: "removed" }` only when the development is still published
  (feed sync rewrites `source: feed` units — ids are stable across syncs per the
  `feedRef` anchor; the plan verifies this on prod data before trusting it, and falls back
  to `feedRef` matching if ids are not stable).
- Archived developments never appear. Draft/ready ones appear only in `published`.
- Every event carries `developmentId, name, developer, location, publicUrl, at` (best
  known time: the dated field, else the snapshot date that first shows the change).

Output:

```
{
  window: { from, to, days },
  coverage: { snapshotBased: boolean, oldestSnapshotAt: date|null, note: string },
  total, returned,
  events: [...]
}
```

`coverage.note` is fixed text the model can repeat to the operator: "Price and unit-level
history starts on <oldestSnapshotAt>; before that only publish/sold-out/back-on-market/new-unit
dates are known."

Description text: "What changed in the catalogue in the last N days — new projects, sold out,
back on market, new units, availability and price moves, per-unit reservations. Use it to
give quiet leads a real reason to hear from us (pass the `developmentIds` from their
`crm_match_properties` result) and to open the day. Figures come from the CRM; quote them as
returned."

### Instructions and consent

- `src/lib/mcp/toolNames.ts`: append both names to `READ_TOOL_NAMES` (consent page + runbook
  list update automatically).
- `src/lib/mcp/instructions.ts`: two bullets —
  "Browsing stock without a lead: crm_search_projects (published only by default; a row
  without publicUrl is internal — never quote it to a customer)." and
  "Before following up a quiet lead, call crm_inventory_changes with the developmentIds
  from their match — a real change (new units, last units, price move) is the reason for
  the message; if nothing changed, say so and do not invent urgency."
- Project-instructions block (runbook, German): one bullet under *Verkaufsmethodik →
  Follow-up-Disziplin*: "Anlass für einen Follow-up holst du dir aus
  crm_inventory_changes (neue Einheiten, letzte Einheiten, Preisänderung, wieder verfügbar)
  — gibt es keinen, sag es mir statt einen zu erfinden."

## Data model (additive; one migration)

```prisma
// Nightly catalogue snapshot for crm_inventory_changes (Phase 3). One row per
// development per capture; units = [{ id, status, price }] over listedUnits().
// Written only by /api/cron/inventory-snapshot; never read by the public site.
model DevelopmentSnapshot {
  id             String   @id @default(uuid())
  developmentId  String
  capturedAt     DateTime @default(now())
  publishStatus  String
  priceFrom      Int?
  priceTo        Int?
  unitsTotal     Int
  unitsAvailable Int
  units          Json     // [{ id: string, status: string, price: number | null }]

  @@index([developmentId, capturedAt])
  @@index([capturedAt])
  @@map("development_snapshots")
}
```

No relation to `Development` (an archived/deleted development must not cascade-delete its
history inside the retention window; the cron prunes by age). Migration is additive only.

## Cron: `/api/cron/inventory-snapshot`

- Auth: `?key=$CRON_SECRET` exactly like `mcp-cleanup`; `withCronLog("inventory-snapshot", …)`.
- Captures every development with `publishStatus in (published, ready)` (drafts and
  archived are skipped — the `published` event comes from `publishedAt`), one row each,
  in batches of 50 with `createMany`.
- Idempotent per day: if a snapshot for the development exists with `capturedAt` on the
  same Cyprus calendar day, skip it (a manual re-run must not double up).
- Prunes rows older than 180 days.
- Telegram warning (English, admin channel) when the run captures 0 rows or fewer than
  half of the previous day's count.
- Schedule: after the nightly feed/drive syncs and before `action-digest`; the plan reads
  the live crontab to pick the exact slot. Operator step: add the crontab line (runbook),
  then trigger it once by hand right after the deploy so history starts on day one.

## Error handling

- Empty result sets are results, not errors (`total: 0`, `events: []` with the coverage note).
- Invalid `completionBefore` → validation error naming the accepted formats.
- Missing snapshots → `coverage.snapshotBased = false`, never an error.
- Prisma/DB errors → `internal` via the existing wrapper (stack-frame-only logging as
  established in Phase 1/2).

## Security notes

- Read-only; no lead data in either tool; `leadId = null` in the audit row.
- Same per-token rate limit as the other read tools. `crm_search_projects` with
  `pageSize ≤ 20` and `crm_inventory_changes` with `limit ≤ 100` bound the response size;
  the snapshot diff runs over ≤ 300 developments in memory.
- Unpublished data leaves the server only with `includeReady: true`, and every such row is
  labelled `publishStatus: "ready"` with `publicUrl: null`.
- No image URLs, no feed identifiers, no drive ids (nothing that points at a vendor system).

## Testing

Pure unit tests (`node --test`):

- `inventorySearch`: type normalisation ("Villas / Houses" ⇒ Villa+Townhouse per
  `propertyTypes.ts`), budget on units vs fallback to `priceFrom/priceTo`, bedrooms 5+,
  `completionBefore` parsing incl. unparseable kept+flagged, sort orders, summary counts
  cover the filtered set not the page.
- `inventoryChanges.diffSnapshot`: each event kind from a fixture pair; `lastUnits` flag;
  1% threshold on unit price; grouping caps (10 + `more`); removed unit only when still
  published; `prev` selection = oldest snapshot at/after window start.
- `inventorySnapshot.snapshotOf`: uses `listedUnits()`/`computeAvailability()`, not the
  cached counters.

Smoke (`scripts/qa/mcp-smoke.mjs`): both tools listed, empty-input search returns
`total > 0` on staging, changes tool returns `coverage.snapshotBased = false` before the
first cron run and `true` after a manual trigger.

## Rollout

1. Merge; deploy on the operator's go (never unasked).
2. Migration applies with the deploy (`CVP_RUN_MIGRATE=1`).
3. Add the crontab line; trigger `/api/cron/inventory-snapshot` once by hand; confirm
   `development_snapshots` has ~240 rows.
4. In the CVE LEADS chat: "Was hat sich in den letzten 14 Tagen im Bestand geändert?" —
   expect dated-field events immediately, snapshot-based events from the next day on.
5. Update the project-instructions block in claude.ai with the new follow-up bullet.

## Out of scope

- Any write to developments/units from the connector.
- Developer profiles (legacy Sanity `Developer` content), blog/insight content.
- Image/plan access, PDF brochures, presentation creation (Phase 1 spec's out-of-scope list
  stands).
- Backfilling history before the first snapshot (impossible — no source data).
- Per-lead "what changed since we last spoke" as a single call — composed by the model
  from `crm_get_lead` (last contact date) + `crm_match_properties` + `crm_inventory_changes`.
