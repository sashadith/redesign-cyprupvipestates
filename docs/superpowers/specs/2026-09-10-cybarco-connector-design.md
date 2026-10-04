# Cybarco: a developer with no feed, only a website

Date: 2026-09-10
Status: proposed, awaiting approval

## Problem

Cybarco is under contract and has no Drive folder, no XML, and no API. It has a
website: `https://www.cybarco.com/project/`. The operator asked whether we can
build projects — with images and materials — out of that, and the answer from a
measured spike is yes, more comfortably than AGG.

Every number below was measured against the live site on 2026-09-10, not
inferred. Where a first measurement turned out to be an artifact of how I
measured, that is stated, because those artifacts are exactly what a connector
would otherwise silently inherit.

## What the source actually is

WordPress on WP Engine behind Cloudflare. The REST API is open but exposes only
the default post types — there is no `project` route, so the projects are a
custom post type with `show_in_rest: false`. Structured extraction therefore
comes from server-rendered HTML plus the Yoast sitemaps, not from the API.

**The decisive test: the production VPS reaches the site.** `curl` from
`root@72.60.89.239` returns HTTP 200 with a byte count identical to a
residential request, and no `cf-mitigated` header, on the listing page, the
sitemap, and the REST root. This is the exact test AGG fails — Cloudflare
JS-challenges our datacenter IP there, which is why AGG is still synced by hand
from a laptop (see the `agg-manual-sync` memory). Cybarco needs no such
workaround: a normal nightly cron on the VPS can fetch it.

### Sources, and what each one is for

| Source | Yields | Covers |
|---|---|---|
| `/project/` listing | name, status mark, price-from, district, featured image, short description, category | **all 15** — the only place all of them appear |
| `projects-sitemap.xml` | canonical slugs | identity for the 4 whose card no longer links |
| `/project/<slug>/` | images, price-list PDF, brochure PDF, long description | 11 |
| `/gallery/<slug>/` | the large image sets | 6 |
| price-list PDF | units: price, status, areas, plot | 9 |
| brochure PDF | floor plans (rasterized) | 11 |

The listing page is machine-readable without JavaScript. Each card is a
`div.project` carrying `span.mark` (status), `h3` (name), `span.sub-title`
(price-from and district), `data-bg` (featured image), and a description.

### The 15 projects

Nine available — seven "Under construction", two "Ready to move in" — and six
sold out. That matches the operator's own count exactly, which is a useful
independent check that the listing is the complete inventory.

The six sold-out ones are not uniform, and the difference drives the design:

| Project | Own page | Images | Price list |
|---|---|---|---|
| the 9 available | yes | 4–187 | yes, all nine |
| Attikis, Thalassa | yes | 4 | no — brochure only |
| Aktea 2, Aktea 3, The Oval | **no** (301) | 10–18, from `/gallery/` | no |
| Sea Gallery Villas | **no** (301) | featured image only | no |

`sea-gallery-villas` redirects to the listing, `the-oval` to the *Russian*
listing, and `aktea-residences-2` and `-3` both redirect to
`aktea-residences-4` — Cybarco itself treats the latter two as superseded
phases of the same project.

**Decision (operator, 2026-09-10): create all 15, with Aktea 2 and 3 as ordinary
standalone Developments marked sold out.** Linking them to Aktea 4 as
"superseded" was considered and rejected on a corrected premise: there is no
Development-to-Development supersession in the schema.
`Project.supersededByDevelopmentId` points from a *legacy Sanity Project* to a
Development, and per its own schema comment it "only records the link, for the
admin banner/redirect-on-deactivate flow" — visibility is governed entirely by
`Project.status`. Building a Development-to-Development relation would be a
subsystem (schema, visibility, canonical logic, admin surface), not a field, and
would block this connector until it landed. The residual risk is accepted and
reversible: three similar Aktea pages in Limassol may compete in search, and
either can be archived later without data loss.

### The galleries are the real image source

`/gallery/<slug>/` holds far more than the project page does: Trilogy 187 images
against 21 on its project page, Limassol Marina 63 against 36, Akamas Bay 36
against 15. Three of the six gallery pages belong to projects whose project page
is gone, so for Aktea 2, Aktea 3 and The Oval the gallery is the *only* image
source beyond the listing thumbnail.

Image resolution runs 774×514 to 1550×719 — measured on real project images, not
assumed. All of it is **below** `imageMirror`'s 1920 px ceiling, so nothing is
downscaled and nothing gains from a larger request. Good enough for cards,
modest for a full-bleed hero; the operator should know that before publishing.

## Units: the price lists

All nine available projects link a price-list PDF directly, with no form gate.
The shape is the family we already read — status as text in the price column:

```
A 101 | 1st | 3 | 119 | 36 | 155 | 0 | 990,000
A 102 | 1st | 2 |  90 | 19 | 109 | 0 | RESERVED
A 103 | 1st | 2 |  90 | 19 | 109 | 0 | SOLD
```

A rough count across the nine gives **236 units — 48 available, 18 reserved, 170
sold**. Treat that as an order of magnitude, not a target: the same rough method
produced two wrong numbers, both described below.

The lists are richer than most XML feeds. Areas are broken out — Covered
Internal, Covered Terraces, Total Covered, Roof Terraces — rather than hidden in
one sum, which maps cleanly onto `areaInternal` / `areaVeranda` / `areaBuilt`.
The villa lists add `Plot Area m²`, so `areaPlot` is populated for Akamas Bay
rather than left empty. FEED-ADAPTER-GUIDE §1 asks both questions explicitly;
both answers are good.

### Four quirks the reader must handle

Each was found by reading actual documents, and each would silently corrupt the
import if missed:

1. **Price cells fragment.** `5 60 , 0 00` is 560,000; `600 ,000` is 600,000. A
   naive text regex reported Aktea 4 as having zero available units. It has
   several. This is the same class of failure that made `gvPriceTable.ts`
   necessary, and it is why the reader must cluster cells geometrically by x
   rather than join text.
2. **Centro Limassol's linked price list is Russian**: `ПРОДАНО` (sold),
   `РЕЗЕРВ` (reserved), `ПЕРЕГОВОРЫ` (under negotiation). An English-only status
   vocabulary reported zero sold units for it.
3. **Limassol Marina lists only available properties.** Its document is titled
   "Available Properties" and contains no sold rows at all, plus extra columns
   (Uncovered Terraces, Sundeck, Pool/Spa, berth sizes) and several sections in
   one document ("Castle Residences", "Island Villas"). Absent rows must not be
   read as an empty project.
4. **Two table shapes.** Apartments key on `Apt. No.`; villas key on `Villa No.`
   and carry `Villa Type` and `Plot Area m²`.

### A second unit source exists, but is not usable as the primary one

`/project/<slug>/properties/` embeds a JSON array in the HTML —
`["ABV48","3","253","1260000",""]` — clean and trivially parsed, and for Akamas
Bay it agrees with the PDF exactly (6 available villas). But only two of the
nine projects serve it; the rest 301 or 404. It also lists available units only.
It is worth keeping as a **cross-check** for those two projects during
acceptance, not as a source.

## Design

### Components

Four files, following the shape every non-XML developer already has. AGG,
Korantina and Kuutio each own a lib, a sync and a cron route; AGG was
deliberately removed from `SYNCED_DEVS` on 2026-08-13 because it "was never a
real feed". Cybarco does not enter the generic feed framework either.

- **`src/lib/cybarco.ts`** — fetching and HTML parsing. Listing cards, sitemap
  slugs, project pages, gallery pages, PDF link discovery. No database, no
  mirroring; pure source → structured records, so it can be tested against saved
  fixtures.
- **`src/lib/ai/cybarcoPriceTable.ts`** — the price-list reader. Self-contained,
  geometric, modelled on `gvPriceTable.ts`. **Deliberately not folded into
  `availabilityTable.ts` or `gvPriceTable.ts`**: the one attempt at a shared
  engine, during the G&V build, produced three Korantina regressions that only a
  live dry-run caught (City Landmark 33 → 1 units, Inner City 3 gaining a
  duplicate Development through a shifted table ordinal, Royal Bay 43 → 42). The
  documented fallback — a separate reader per document family — is the design
  here from the start.
- **`src/lib/cybarcoSync.ts`** — upserts Developments and units, mirrors images
  and rasterized plans, applies the published-project freeze.
- **`src/app/api/cron/cybarco-sync/route.ts`** — its own cron, `withCronLog`,
  same shape as `korantina-sync`.

### Identity

`dev: "cybarco"`, `feedProjectId = <slug>`, `feedKey = "cybarco:<slug>"`,
following the existing `<dev>:<feedProjectId>` convention.

Four sold-out cards carry no link, so their slug comes from matching the card's
name against `projects-sitemap.xml`, which still lists all of them. Slugs are
never derived by slugifying a display name: a name-derived guess that drifts
would re-key a project and create a duplicate Development, which is precisely
how Korantina's `-t<tableIndex>` ordinal bug manifested.

### Field mapping

- `publicName` — from the card's `h3`, through `toTitleCaseName()`, per
  FEED-ADAPTER-GUIDE §4. Applied where the name first leaves the source and
  before any override lookup.
- `stage` — from `span.mark`: "Under construction" and "Ready to move in", after
  case normalization (the site is inconsistent: "Under construction" vs "Under
  Construction", "Sold Out" vs "Sold out"). This is free value: `stage` is a
  publish-gate requirement, and it was one of the fields blocking all four
  Marfields projects.
- `district` — from the `sub-title` tail ("Limassol, Cyprus", "Latchi, Pafos,
  Cyprus", "Nicosia, Cyprus").
- `priceFrom` — from the `sub-title` head, when it is not "Sold Out".
- `gallery` — gallery page where one exists, otherwise the project page,
  otherwise the card's featured image. No cap (the caps were removed on
  2026-09-10; Trilogy alone brings 187 images).
- `plans` — brochure PDF pages, rasterized.
- Units — `ref`, `feedRef`, `floor`, `beds`, `areaInternal`, `areaVeranda`,
  `areaBuilt`, `areaPlot`, `price`, `status`, `sortIndex`.

### Unit status

Numeric price → `available`. `SOLD` / `ПРОДАНО` → `sold`. `RESERVED` / `РЕЗЕРВ`
/ `ПЕРЕГОВОРЫ` → `reserved`.

**Decision (operator, 2026-09-10): reserved is its own status, not folded into
available.** The consequence must be stated plainly because it is derived and
automatic: `computeAvailability` counts only `status === "available"`, so a
project whose remaining inventory is entirely reserved is flagged **sold out**
and will show the SOLD OUT badge. With 18 reserved units across nine projects
this is not hypothetical.

### Sold-out for projects without units — and a bug this exposes

Sold-out state is derived: `recomputeDevelopmentDerivedState` reads only unit
statuses, and `soldOut = total > 0 && available === 0`. Six Cybarco projects
have no price list and therefore no units, so `total === 0`, so `soldOut` is
false and no badge appears — the six would import looking like ordinary
for-sale projects.

Worse, setting `soldOutSince` by hand would not survive. The recompute's
`else if (!soldOut && wasSoldOut)` branch clears `soldOutSince` and stamps
`returnedToMarketAt`. **This is a pre-existing bug independent of Cybarco:**
today, removing every unit from a genuinely sold-out project silently records it
as having returned to the market, on a date nobody chose.

Proposed fix, small and defensible on its own merits: treat `total === 0` as
*no opinion* rather than *back on the market* — do not clear `soldOutSince` when
a Development has no units at all. An explicitly set sold-out state then holds
for the six, and the spurious `returnedToMarketAt` stamp stops happening for
everyone. Guarded by an addition to the existing sold-out QA script, including a
mutation that restores the old behaviour.

### Sync behaviour

- Sold-out projects **stay on the listing** with a "Sold Out" mark rather than
  disappearing. FEED-ADAPTER-GUIDE §1 asks this question because it decides
  whether "missing from the feed" is a usable signal. Here it is not: the mark
  is the signal, and `markProjectsMissingFromFeedSoldOut()` must not be pointed
  at this developer. A project genuinely vanishing from the listing means
  Cybarco removed it, which is a different event and should be reported, not
  acted on.
- Published projects stay frozen, as everywhere else.
- `beginSyncWindow()` held across the whole run and released in `finally`, per
  FEED-ADAPTER-GUIDE §4 — a long import must neither be killed by a restart nor
  kill someone else's.
- Change detection is nearly free: price-list filenames carry a date stamp
  (`Naftikos-Residences-Pricelist-ENG-280826.pdf` = 28.08.26). A new list is a
  new filename. The sitemap carries no usable `lastmod`.

### Acceptance

Per-project, against hand-counted numbers from the source documents — the method
that caught every real defect in the G&V build, where green synthetic tests
passed while three projects were quietly wrong. Specifically:

- Unit counts and status splits per project, counted by hand from the PDF.
- Akamas Bay and Trilogy cross-checked against the `/properties/` JSON.
- Every price spot-checked against the PDF for at least the available units,
  since fragmented cells are the known failure mode.
- Centro read with the Russian vocabulary and verified to produce non-zero sold.
- Limassol Marina verified to import its sections as one project, not several.
- Every new assertion mutation-tested.

## What this connector cannot provide

Stated here so it is not discovered during publishing:

- **No coordinates.** The `/location/` pages carry no lat/lng and no maps link.
  All 15 will fail the publish gate on "Map location set" until the operator
  sets them by hand. This is the Marfields situation repeating.
- **EN and RU only.** DE and PL descriptions must be generated, as with the
  other adapters.
- **Modest image resolution**, as measured above.

## Out of scope

- Development-to-Development supersession (rejected above, with reasons).
- Any change to `availabilityTable.ts` or `gvPriceTable.ts`. Both stay
  byte-identical; the acceptance step verifies this by blob hash, as the G&V
  build did.
- Asking Cybarco for a real XML feed. Worth doing in parallel — they are under
  contract and clearly hold structured data — and it would retire the reader.
  It does not block this work and this work does not block it.
