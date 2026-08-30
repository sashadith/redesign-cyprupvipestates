# Leptos Estates: the richest feed, and the first with real project identity

Date: 2026-08-30
Status: proposed, awaiting approval

## Problem

The operator asked for a Leptos Estates connector that produces projects rich
enough to publish **without manual rework** — amenities, units, high-resolution
images, floor plans — using what we have learned from the seven adapters before
it.

"Without rework" is the requirement that shapes every decision below. It rules
out any grouping rule that is merely *usually* right, because the cost of being
wrong is not a crash: it is the operator hand-correcting 45 projects in the
admin, which is exactly what this connector exists to avoid.

Feed: `https://www.leptosestates.com/wp-content/themes/leptos-estates/template-export-xml-keyro.php?country=all`
— HTTP 200, 3.36 MB, **Kyero v3**, 440 properties.

## What the feed contains

Per property: `id, date, ref, price, price_freq, type, town, province, country,
location{latitude,longitude}, beds, baths, desc{de,en,pl,ru,cn}, features{feature},
images{image{url}}, sqm{plot_area,covered_area}, floor_plans{image{url}},
benefits{benefit}`.

It is the richest feed we have connected, by a wide margin:

| | |
| --- | --- |
| Properties | 440 (377 in scope) |
| Photos | 4,498 (3,836 in scope) |
| Floor plans | 1,037 (931 in scope) — **99 % of properties have them** |
| Languages | de / en / pl / ru / cn on 439 of 440 |
| Distinct amenities | 41 |
| Benefits | travel times on 436 of 440 (`AIRPORT 26 min`, `SEA 2 min`) |
| Coordinates | 219 of 440 (50 %) |

The root element is `<root>` with `<property>` siblings and a `<kyero>` element
holding only `feed_version` — the same shape as Square One's feed, so
`squareOne`'s parse path (`kyero.property`) does **not** apply; this reads
`root.property`, exactly as the Mito adapter does.

## Scope — decided by the operator, 2026-08-30

**Cyprus only, residential and commercial, no land parcels.**

| Filter | Removed | Remaining |
| --- | --- | --- |
| `country != "Cyprus"` | 46 (Paros, Crete, Santorini, Athens) | 394 |
| `type == "Plots & Land Parcels"` | 17 | **377** |

Filtering happens **in the adapter**, before anything downstream sees a row.
That is not tidiness. `districtFor()` (feeds.ts) resolves any coordinate by
longitude — `lng < 32.6 → Paphos` — with no country check at all. Paros (25.15),
Crete (23.8), Santorini (25.4) and Athens (23.7) all fall under that threshold,
so every Greek property would have been silently labelled **Paphos**. Excluding
them at the adapter boundary means the function is never handed a coordinate it
would answer wrongly, rather than relying on a guard further down.

## Identity: the ref code, not the project name

### The design changed during research, and the reason matters

This spec first proposed deriving the project name from the description and
using a slug of it as the key, anchored in the database against re-keying —
the Mito pattern. Measurement rejected it.

**The `h2` heading is a *unit* title, not a project name.** Stripping the unit
designation from it over-splits: `Kamares Village Villa No. 434B`,
`Kamares Village Cypress Villas No. 003 1&2` and
`Kamares Village – Two-Villa Package Ambelia No. 6A/6B` become three projects.
They are one. Every unit's own description says so, in identical words:
*"is a unique Villa located at Kamares Village, a landmark project by Leptos
Estates."*

**Mining the body instead reaches only 48 %** (181 of 377), and it disagrees
with the heading in a way that has no general resolution: the body calls all
six *Limassol Park* buildings one project, the heading calls them six.

### What actually works

The `ref` is structured — `A-BAG-Z-206` is Apartment, **B**el **A**ir
**G**ardens, block **Z**efiro, unit 206. Taking the code segment yields
**48 codes for 377 units**, and an independent signal confirms every one of
them:

> **The largest coordinate spread inside any code is 9 metres.**

Not one code straddles two locations. Compare Mito, where identity had to be
reconstructed from proximity and shared description text because the feed
carried none. Leptos carries it explicitly.

The code is also **immune to rewording**, which the name is not. Leptos edits
its marketing prose — that is what feeds are for — and a name-derived key would
re-key a project on an adjective. The code changes only if the developer
re-references the property, which would break their own systems.

`feedProjectId` is therefore the code itself — `BAG` — which makes
`feedKey` read `leptos:BAG`, following the existing
`feedKey = \`${dev}:${feedProjectId}\`` convention.

### The code is positional, and must stay positional

`PG` appears in the ref of **two different projects, in two different
positions**:

| ref | position of `PG` | project | town |
| --- | --- | --- | --- |
| `A-PG-BLK-D-204` | segment 2 | **Peyia** Gardens | Peyia |
| `A-A09-109-PG` | last segment | **Paphos** Gardens | Kato Paphos |

The rule therefore reads the code at a **known position** — the segment after
the leading type letter (`A`/`V`/`C`/`S`/…) — never "the segment that looks
like a code", and never by searching the ref for a known token. A substring or
last-segment rule merges two projects 12 km apart. This is the single most
likely way a future edit breaks this adapter.

### One collision, neutralised by scope — and a warning attached to it

Code `MBV` covers **three** unrelated projects: Maleme Beach Villas (Paros),
Molos Beach (Paros), and **Maniki Beach, Peyia, €2.2–6.4 M**. Within the Cyprus
scope only Maniki Beach survives, so the collision cannot occur.

**This is a scope-dependent safety, not a property of the key.** If Greece is
ever brought in, `MBV` alone merges a €6.4 M Cyprus project with Greek
apartments. Any future widening of scope must add a country component to the
key. Recorded here so it is found by the person doing that, not after.

## The exception table

48 codes do not map 1:1 onto 45 projects. Four cases need a decision that no
algorithm should be trusted to make, so they are written down explicitly in one
reviewable table rather than inferred:

| Code(s) | Decision | Why |
| --- | --- | --- |
| `LBM` → `LBM-CT` / `LBM` | **split** into Cavalli Tower (52) and Poseidon Tower (8) | Operator's call, 2026-08-30. Distinct brands; merged, the price range €845,000–16,845,000 is useless to a buyer. Both towers name themselves in the body; neither appears in the heading. |
| `ZAN` → `ZANATZIA` | **merge** (4 + 7 = 11) | Two spellings of one project. Same town, same coordinates, identical `Zanatzia Villa` titles. |
| `A09`,`B11`,`B08`,`B10` → `PAPHOSG` | **merge** (4 × 1 = 4) | All four are *Paphos Gardens, Kato Paphos*. Their refs put the project token **last** (`A-A09-109-PG`), so the positional rule reads the block as the code and yields four. The merge target is named `PAPHOSG`, **not** `PG` — `PG` already belongs to Peyia Gardens (see above). |
| `DEL` → `DEL` / `RUBY` | **split** into Limassol Del Mar (3) and The Ruby (1) | Same reasoning as Cavalli: The Ruby at €14.1 M is a separate tower brand inside Del Mar. |

**Result: 45 projects, 377 units.**

The table also carries the **display name** for each code, because the code
itself (`BAG`, `AKMT`, `PRDSGIII`) is meaningless in the admin. 45 rows,
enumerable, stable, reviewed once — which is precisely the "no rework"
requirement, moved from the operator's evenings into a code review.

A code arriving that is **not** in the table is not an error: it gets a name
derived from its heading and creates a project as usual. The table is a
correction layer over a working default, never a gate.

## Where the code goes

The existing seam, unchanged. `feeds.ts` imports xml2js and view types; **it
does not import Prisma and must not start** — the public preview page uses it.

| Layer | File | Responsibility |
| --- | --- | --- |
| Stateless | `feeds.ts` — `leptosProjects()` | Fetch, parse `root.property`, filter to scope, group by code, apply the exception table, build one `ProjectVM` per project. No database. |
| Stateful | `feedSync.ts` — Leptos branch | Assign/reuse `feedProjectId`, hand each `ProjectVM` to the existing machinery. |

`syncOneProject` already accepts an injected view model
(`opts.vm !== undefined ? opts.vm : await getPreviewProject(dev, id)`), so the
branch inherits unit reconciliation, image mirroring and pruning without new
machinery — the same reuse the Mito branch relies on.

Unlike Mito, Leptos **also** joins the id-driven path: `listProjectIds("leptos")`
returns the 45 codes and `getPreviewProject("leptos", code)` returns one
project, because the code is a real id. That makes the public preview page and
the per-project admin resync work for Leptos, which they never could for Mito.

## Content mapping

### Images, at full resolution

**807 of 2,190 image URLs are WordPress `-scaled` downsizes.** Stripping the
suffix returns the original that WordPress kept:

| | `-scaled` | original |
| --- | --- | --- |
| `2023/05/03-1.jpg` | 1920 × 1373 (513 KB) | **4128 × 2953** (2.1 MB) |
| `2023/05/04-1.jpg` | 1920 × 1288 (632 KB) | **4588 × 3078** (3.4 MB) |

Over four times the pixels. Sampling 30 of the 807: **30 of 30 originals exist
and every one is larger.** The adapter requests the original and falls back to
the `-scaled` URL when it is absent — the fallback never fired in the sample,
but a missing original is a 404 in the mirror pipeline, so it stays.

Mirroring is unchanged: `imageMirror.ts` already produces small/medium/large
from whatever it is given, so feeding it the original improves every derived
size at once.

### Floor plans, per unit

931 plans, attached to the **unit** they belong to (`DevelopmentUnit.plans`),
not pooled at project level. `Development.plans` gets the deduplicated union,
which is what the project gallery reads.

### Amenities and benefits — two fields, deliberately not one

`<features>` (41 distinct) become project `amenities`, deduplicated across the
project's units.

`<benefits>` (`AIRPORT 26 min`, `SEA 2 min`) become **`extraFacts`**, and
explicitly **not** `distances`.

`Development.distances` is owned by `developmentDistances.ts`, which every write
path recomputes by haversine from the resolved coordinates. Writing feed values
into it would create a second writer on one field whose value silently depends
on which path ran last. That failure has already happened once in this codebase
— `Development.stage`, wiped nightly by the sync until it was moved to the
override table (Celestia, 2026-07-17/18). Leptos's times are real
drive times and better data than our straight-line estimate, but the place to
prefer them is a deliberate change to that module, not a quiet second writer.

### Units

`ref` → `feedRef` and `ref`; heading → `name`/`label`; `type`, `price`, `beds`,
`baths`; `covered_area` → `areaInternal`; `plot_area` → `areaPlot`; per-property
`images` → `photos`; `floor_plans` → `plans`; `location` → `coords`.

Blocks (`Block Zefiro`, `Block Sirocco`) are parsed from the heading into the
unit label, matching the existing `"Block C · Nr. 504"` convention.

### Description and language

**English only from the feed** (operator's decision, 2026-08-30); de/pl/ru
continue to come from the existing AI translation pipeline. The feed's
professional de/pl/ru/cn translations are therefore *not* used.

This is a deliberate trade, and the reason it went this way is worth recording:
the only existing home for per-language text is
`DevelopmentOverride.descriptionEN/DE/PL/RU`, and that table's entire purpose is
that **the sync never writes to it**. Using the feed's translations would have
meant either breaking that invariant or adding columns. Neither is justified by
translations we can already generate.

The description is HTML (`<h2>`, `<p>`). It is converted to text through the
existing helpers, and `anonymize()` runs as it does for every other developer.

## Guards

**No Leptos `DeveloperAccount` exists yet** — verified against production on
2026-08-30; the 15 accounts present are agg, aristo, bbf, domenica, inex,
island-blue, korantina-homes, kuutio-homes-drive, luma, medousa-xml, mito-xml,
motive-point, olias-homes, pafilia, square-one.

**The operator must create it before the first sync, and `DEV_ACCOUNT` must
carry its exact slug.** `ensureAccount` falls back to `{ slug: dev, name: dev }`,
so a missing or mismatched entry creates a *second*, empty account beside the
operator's and attaches all 45 projects to it. This has already happened twice —
Medousa, then nearly again at Mito — and both times the fix was this one line.

Following the convention of every other XML developer here, the recommended
account is **slug `leptos-xml`, name "Leptos Estates (XML)"**, giving
`leptos: { slug: "leptos-xml", name: "Leptos Estates (XML)" }`. If the operator
creates it under a different slug, that slug wins — the entry is read from the
account, never the other way round.

**The completeness guard uses the shared thresholds, and here they work.**
`FEED_INCOMPLETE_PCT = 0.15` against 377 units means the sync refuses a feed
that lost more than 56 units; the `FEED_INCOMPLETE_ABS_FLOOR = 20` floor binds
only for projects under 133 units. Mito needed a custom floor of 3 because its
16-unit catalogue made `missing > 20` unsatisfiable — a guard that could not
fire. At 377 units no such override is needed, and adding one would be cargo
cult. The arithmetic is stated here so the next reader can check it rather than
trust it.

**Price 0 never sets a price.** 4 units in scope carry `price = 0`
(`V-KAM-3-434A`, and three commercial). `priceFrom`/`priceTo` are computed from
available units with a price above zero, matching the `squareOne` and `aristo`
behaviour and the documented Royal Horizon failure, where two sold villas set a
headline price a buyer could not get.

**Unit refs run through `unitRef.ts`.** Leptos refs are globally unique
(`V-KAM-3-434B`), so the block-qualification rules that Arbeo Park needed should
be inert here — to be confirmed by counting key changes before the first sync,
not assumed.

## Known limitations, to state on handover

- **Availability is implied.** No status field: present = available, absent =
  gone. The same mechanic as every other XML developer here.
- **Unit counts are what Leptos publishes, not what exists.** Bel Air Gardens
  shows 47; the development is larger. Every `{unitsAvailable}` SEO placeholder
  inherits this. Unlike Mito — where the feed carried 16 of 39 for-sale units
  and the connector had to be switched off — there is no evidence yet of how
  complete Leptos's selection is. **This should be measured against a Leptos
  price list before the projects are published**, and is the single most likely
  reason this connector would need the same treatment.
- **19 codes carry exactly one unit** (Akropolis, Atlas Centre, The Ruby,
  Latchi Beach …). They become one-unit projects. Whether they are individual
  resale listings rather than developments cannot be settled from the feed —
  the word "resale" appears nowhere in it. They are created; the operator can
  archive any that do not belong.
- **`V-KAM-AMB-6A6B` and `V-KAM-5-457/458B` are package deals** — one listing,
  two villas. They import as single units, which is what the feed states.

## Verification

- `leptosProjects()` against the live feed returns **45 projects / 377 units**,
  and `Cavalli Tower` (52) and `Poseidon Tower` (8) are separate.
- Every project's units lie within 200 m of each other where coordinates exist
  (measured worst case today: 9 m).
- No project contains a property with `country != "Cyprus"` or
  `type == "Plots & Land Parcels"`.
- A second sync with the feed unchanged creates no new projects and changes no
  `feedProjectId`.
- A simulated rewording of a project's description does not re-key it.
- The first sync creates 45 projects under the operator's existing Leptos
  account and creates **no** second account.
- Image URLs carry no `-scaled` suffix where an original exists; spot-check two
  mirrored images at over 4000 px wide.
- `priceFrom` is above zero for every project containing a zero-priced unit.
