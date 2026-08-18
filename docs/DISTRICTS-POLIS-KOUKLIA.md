# Districts: Polis and Kouklia

Design spec — 2026-08-17. Status: in implementation on branch
`feat/districts-polis-kouklia`. Amended 2026-08-18 after the Task 2 review —
see "Override-blocked rows".

## Goal

Introduce `Polis` and `Kouklia` as top-level districts alongside `Paphos`,
`Limassol` and `Larnaca`, and reassign every affected development to them.

The concrete complaint driving this: filtering the CRM Property Matching panel
by **Paphos** returns Polis projects (Prodromi, Argaka, Neo Chorio). Polis
Chrysochous is 40 km north of Paphos city across a mountain range — for a lead
searching Paphos it is noise, not a near-miss.

Naming note: the request originally said "Secret Valley". Decision was to name
the region after the actual locality, **Kouklia** — Venus Rock, Secret Valley
and Aphrodite Hills all sit inside it.

## Scope

**In scope:** the Admin/CRM surface — Property Matching panel and the
Presentation editor's location filter.

**Out of scope:** the public projects filter
(`src/app/components/StyledProjectFilters/StyledProjectFilters.tsx`). It runs on
a different model (`Project.city`, not `Development`) with a hardcoded
four-language city list. Deliberately deferred to a separate piece of work.

## Why the CRM needs no UI change

The district list is **not hardcoded**. `listPresentationLocations()`
(`src/app/admin/(panel)/crm/[id]/presentationActions.ts:45`) builds
`{ districts, areasByDistrict }` live from `Development.district`, falling back
to `town` when district is empty. Both consumers — `PropertyMatching.tsx` and
`PresentationEditor.tsx` — render whatever that returns.

A new district therefore comes into existence purely by writing the data. The
scoring in `src/lib/crm/matching.ts:251` already compares the development's
resolved district against the selected ones, so correct data is sufficient for
correct filtering.

## Root cause

Two defects in `src/app/preview-project/feeds.ts` combine:

1. **`districtFor()` (line 57)** classifies by a single longitude band:
   `lng < 32.6 → Paphos`, `lng < 33.4 → Limassol`, else `Larnaca`. It has no
   concept of sub-regions, and it never sees latitude — so Polis (far north,
   same longitude as Paphos) is indistinguishable from Paphos city.

2. **The text fallback is unreachable for geo-located projects.** Every adapter
   uses the idiom `districtFor(center?.lng) || districtFromText(...)`. Because
   `districtFor` returns a non-empty string whenever `lng` exists, the
   `districtFromText` fallback only ever runs for projects *without*
   coordinates. Fixing only `DISTRICT_TOWNS` would therefore change nothing for
   10 of the 12 affected projects.

Additionally the `Paphos` entry in `DISTRICT_TOWNS` (line 62) already lists
`polis`, `latchi`, `latsi` and `venus rock` as Paphos towns — so even the text
path actively produces the wrong answer today.

## Durability constraint

`Development.district` is **not** in `FROZEN_WHEN_PUBLISHED`
(`src/lib/feedSync.ts:157`) — it is rewritten from the feed on every sync.
Correcting the database alone would be silently reverted the same night.

This is why the classifier fix is not optional and why it must land *before*
the backfill: once the classifier produces the same value the backfill writes,
each sync re-confirms the value instead of overwriting it.

`DevelopmentOverride.district` (which always wins and is never touched by the
sync) is deliberately **not** used here. Overrides are the escape hatch for
per-project judgment calls; using them for a systematic, rule-expressible
classification would hide the rule from the sync and leave new feed projects
landing in Paphos forever.

## Region definitions

### Geo (checked before the coarse longitude band)

| Region | Bounding box |
|---|---|
| Polis (Chrysochou bay) | `lat 34.95–36.0` ∧ `lng 32.0–32.60` |
| Polis (Tillyria strip) | `lat 35.0–36.0` ∧ `lng 32.60–32.75` |
| Kouklia | `lat 34.65–34.75` ∧ `lng 32.55–32.70` |

The second Polis box was added after the Task 1 code review (2026-08-17). The
coast turns east past Pomos, so Kato Pyrgos sits at `lng 32.690` — outside the
first box. Without the strip, geo would answer `Limassol` for it and the
`kato pyrgos` text token could never fire, since geo is consulted first. Capped
at 32.75 so Morphou (32.99) and Kyrenia stay outside. Verified against all 244
developments: the added strip contains zero rows, so it changes no existing
classification.

Validated against all 244 developments: 4 rows match Polis, 6 match Kouklia,
zero false positives. Specifically excluded by construction:

- Troodos (Berengaria, Blackpine — `lat 34.95`, `lng 32.83`) fails the Polis
  longitude bound.
- Mandria (Zephyros Village 3 — `lng 32.53`) falls below the Kouklia longitude
  bound; Mandria is not Kouklia.
- Sea Caves / Peyia (`lat ≤ 34.89`) stays below the Polis latitude bound.

### Text (fallback for projects without coordinates)

New `DISTRICT_TOWNS` entries, ordered **before** `Paphos` — `districtFromText`
returns on first match, so order is load-bearing:

- **Polis:** `\bpolis\b`, `prodromi`, `latchi`, `\blatsi\b`, `neo chorio`,
  `argaka`, `pomos`, `kato pyrgos`, `chrysochou`
- **Kouklia:** `kouklia`, `venus rock`, `secret valley`, `aphrodite hills`,
  `petra tou romiou`

`\bpolis\b` uses word boundaries deliberately, so it cannot match `Neapolis`
(Neapolis University Paphos) or `Akropolis`. `\blatsi\b` is anchored for the
same reason — added after the Task 1 code review, which caught that a bare
`latsi` matches **Latsia**, a large Nicosia municipality nowhere near Polis.
`kato pyrgos` sits in the Polis entry ahead of Limassol's `pyrgos` (which
legitimately serves Pyrgos Lemesou) so the Limassol entry cannot claim it.

The same tokens must be **removed** from the `Paphos` entry, otherwise Paphos
still wins for any adapter that reaches the text path.

## Code changes

### `src/app/preview-project/feeds.ts`

1. Change `districtFor` to accept the whole center rather than just longitude:
   `districtFor(center?: { lat: number; lng: number } | null)`. Latitude is
   required for the Polis/Kouklia boxes and is unavailable in the current
   signature.

2. Inside it, test the two sub-region boxes first, then fall through to the
   existing longitude band unchanged. Behaviour for every non-Polis,
   non-Kouklia project is bit-for-bit identical.

3. Update all six call sites: lines 269, 270 (island-blue), 333 (qubehub), 407
   (aristo), 566, 768 (squareone). Line 269/270 call `districtFor` twice on the
   same value — hoist to a single `const`.

4. Add the missing text fallback to the island-blue adapter (line 269), which
   today has none at all: an island-blue project without coordinates gets an
   empty district regardless of what its `Location` says. Same defect class as
   the rest, fixed in the same pass.

5. Rewrite the `DISTRICT_TOWNS` map per **Region definitions** above.

### `scripts/backfill-development-districts.mjs`

One-off catch-up for rows that already exist. Follows the established
convention of `scripts/backfill-development-distances.mjs`:

- **Self-contained duplicate of the classification rule.** `src/lib/` and
  `src/app/` use the `@/…` TS path alias, which plain `node` cannot resolve
  outside the Next.js build — every `scripts/*.mjs` in this repo is
  self-contained for that reason. The script carries a header comment naming
  `feeds.ts` as the source of truth and instructing that changes be mirrored.
- **Dry-run by default**, `--apply` to write. Dry-run prints one row per change
  as `name | old → new | source(geo|text) | status`.
- Writes `Development.district` only. Never touches `DevelopmentOverride` — an
  existing override already wins at read time, so overriding it here would
  destroy a deliberate admin decision.
- Covers every `publishStatus`, not just published. The 53 districtless rows
  are all draft or archived, and a missing district blocks the publish gate
  (`src/lib/developmentPublishGate.ts:36`).

## Affected rows

12 developments change district. 10 are published, 2 are drafts, none archived.

| Development | Now | After | Matched by | Status |
|---|---|---|---|---|
| Prodromi Gardens | Paphos | Polis | geo | draft |
| Beachside Villas | Paphos | Polis | geo | draft |
| Argaka Village 6 | Paphos | Polis | geo | published — **override-blocked** |
| Agnades Village 1 | Paphos | Polis | geo | published |
| Grigio Court | Paphos | Polis | text (`town=Polis`) | published — **override-blocked** |
| Villa Oasis | Paphos | Kouklia | geo | published |
| Royal Residences | Paphos | Kouklia | geo | published — **override-blocked** |
| Premier Residences | Paphos | Kouklia | geo | published |
| Imperial Residences | Paphos | Kouklia | geo | published — **override-blocked** |
| **Villa Infinity** | **Limassol** | Kouklia | geo | published |
| **Ridge Residences** | **Limassol** | Kouklia | geo | published |
| Trinity Residences | Paphos | Kouklia | text (`area=Venus Rock`) | published |

Villa Infinity and Ridge Residences are pre-existing misclassifications: both
sit in Venus Rock at `lng 32.600`/`32.614`, just past the `< 32.6` Paphos
bound, and were therefore labelled Limassol. Fixed as a side effect.

Resulting CRM district list: Paphos 124 → 114, Limassol 63 → 61, plus
**Polis** (5 — areas Prodromi, Argaka, Neo Chorio) and **Kouklia** (7 — area
Venus Rock). Larnaca (3) and Nicosia (1) unchanged.

Those totals are the *intended* end state. Four of them are not reachable by
the backfill alone — see below.

### Override-blocked rows (discovered 2026-08-18)

Four of the twelve carry a `DevelopmentOverride` row with `district: "Paphos"`.
The override wins at read time and the backfill refuses to touch it, so these
four stay under Paphos no matter how often the classifier runs:

| Development | `base.district` | `override.district` | `override.town` |
|---|---|---|---|
| Argaka Village 6 | Paphos | Paphos | **Polis** |
| Grigio Court | Paphos | Paphos | **Polis** |
| Imperial Residences | Limassol | Paphos | **Kouklia** |
| Royal Residences | Limassol | Paphos | **Kouklia** |

The `town` column is the tell: each override already records the correct
locality while pinning `district` to Paphos — consistent with having been
written when Polis and Kouklia did not exist as districts. Note this is
inference, not record: the admin district field is free text, not a constrained
select (`src/app/admin/(panel)/developments/[id]/page.tsx:194`), and
`DevelopmentOverride` has no `createdAt` to date the row against.

**Decision still open.** The backfill reports these rows and refuses to write
them. Whether they are then corrected by hand in the admin UI, or the override
`district` is cleared so the base column resumes winning, is an operator call —
and the two are not equivalent: clearing keeps the row tracking the rule as it
evolves, while setting Polis/Kouklia pins it forever. 19 overrides set a
`district` in total, so this is a pattern, not a one-off.

Until it is resolved, the CRM shows **Polis 3** and **Kouklia 5**, not 5 and 7.

## Side effects

`Development.district` is a shared field, not CRM-private. Changing it also
changes:

- **Location labels** on client presentation pages (`src/app/c/[token]/`) and
  development cards, via `resolveDevelopmentLocation(district, town, area)`
  (`src/lib/developmentCard.ts:102`). It dedupes case-insensitively, so
  Grigio Court renders `Polis · Prodromi` rather than `Polis · Polis ·
  Prodromi`.
- **SEO meta title/description text** (`src/lib/developmentSeo.ts:127,139`),
  which joins `[area, district]` — `"Prodromi, Paphos"` becomes
  `"Prodromi, Polis"`.
- **Alternative-project suggestions** (`src/lib/developmentAlternatives.ts`).
  Polis projects will now prefer other Polis projects. This does not starve the
  list: in stage 4 `sameLocation` is only a sort key, not a filter
  (`fillLocationFirst`, line 203), so a thin Polis pool still fills up to
  `MAX_ALTERNATIVES` from elsewhere.

All three are improvements in accuracy rather than regressions, but they are
customer-visible on 10 published projects and are stated here so the change is
not mistaken for CRM-only.

### Explicitly not affected

- **URLs / slugs.** `baseDevelopmentSlug()` derives the slug from `publicName`
  alone (`src/lib/developmentSeo.ts:43-45`), and slugs are assigned once on
  publish. No redirects are needed.
- **Feed sync behaviour** for any project outside the two bounding boxes and
  the new text tokens.

## Verification

1. **Unit-level:** table-driven test of the classifier over the 12 affected
   rows plus the near-miss guards (Troodos, Mandria, Sea Caves, Peyia) — all
   must keep their current district.
2. **Backfill dry-run.** Superseded 2026-08-18 — see "Override-blocked rows"
   below. Expect **8** reclassifications (`X -> Y`), plus first-time fills
   (`(none) -> X`) for districtless drafts/archives, plus a blocked-override
   report naming the 4 rows the script refuses to write. The invariant that
   still holds: **no unexpected `Paphos -> X` row**. A reclassification not in
   the table above is a defect in the rule, not an acceptable surprise.
3. **After apply:** re-run the `listPresentationLocations()` query and assert
   Paphos contains no Prodromi / Argaka / Neo Chorio / Venus Rock area, and
   that Polis and Kouklia appear with the expected areas.
4. **Sync durability:** re-run a sync for one affected published project (e.g.
   Villa Oasis, aristo) and confirm the district survives. NOT Royal
   Residences — it carries an override pinning Paphos, so it would show no
   change and read as a classifier failure. This is the
   check that proves the classifier and the backfill agree — without it the
   whole approach is unverified.

## Corrections to this branch's history

- The commit message of `9f6bb2f` claims the override-coordinate fix "fixes a
  real miss". It does not. Verified across all 244 rows by computing the result
  both ways: **11 rows change classification mechanism** (text → geo), **0
  change district**. Every one lands on the same answer by either route. The fix
  stays — it aligns this script with the eight other override-first read paths
  in the repo and removes a latent hazard where a corrected map pin and stale
  feed coordinates disagree — but it corrected no data.

## Known remaining, not addressed here

Other misclassifications surfaced while surveying the data, left alone to keep
this change reviewable:

- `Berengaria`, `Blackpine` — Troodos/Prodromos, filed under Limassol.
- **The Nicosia band gap.** The coarse band has no Nicosia region: `lng < 33.4`
  answers `Limassol`, so Nicosia coordinates are misfiled. Two rows are
  affected, **both archived**, neither published or client-facing:
  - `Engomi Plots` — protected. Its `override.district = "Nicosia"` is correct
    and the backfill refuses to touch it. This is the clearest validation we
    have of the never-write-overrides policy: a write-overrides design would
    have overwritten a correct value with a wrong one.
  - `Legacy` — **unprotected**. `base.district = Limassol`, text says
    `"Nicosia, City centre"`, no override. Already wrong today; `--apply`
    cannot worsen it, since `next === r.district` skips it.

  `GEO_CASES` pins `Legacy`'s coordinates to `"Limassol"`. Read that pin as
  "what we currently produce", **not** "what is correct". Closing the gap means
  adding a Nicosia box in the 33.29–33.36 longitude range, which carries the
  same false-positive risk the Polis/Kouklia boxes were validated against — its
  own piece of work with its own validation burden, not a rider on this one.
- 53 developments with no district at all (all draft/archived). The backfill
  will assign whichever of them the rules can resolve; the rest stay empty.
