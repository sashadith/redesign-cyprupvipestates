# Mito (XML): a feed with no project identity

Date: 2026-08-28
Status: proposed, awaiting approval

## Problem

The operator created the developer account **Mito (XML)** (slug `mito-xml`,
`87c986ae-3898-40c3-b292-bf6d46567680`) on 2026-08-28 and pointed it at a Qobrix
feed, expecting a sync to create projects with content. No sync can run: there is
no adapter for it.

Worse than "nothing happens". `getPreviewProject` ends with
`return islandBlue(target)` — an **unknown developer key silently falls through
to the Island Blue adapter**. A sync triggered for `mito` today would read Island
Blue's feed and could attach Island Blue's projects to Mito's account.

## What the feed actually contains

`https://mito-invest.eu1.qobrix.com/api/v2/feeds/7062fe51…` — HTTP 200,
26 KB, **Kyero v3**, 16 properties. Fields per property:

```
ref, price, currency, price_freq, new_build, type, beds, baths, pool,
surface_area.built, surface_area.plot, energy_rating, desc.en,
images.image.url (×N), location.latitude, location.longitude,
town, province, country, date, email, id
```

Three absences shape this entire design:

**No project identity.** 0 of 16 properties carry a property-level `<url>` — the
hook Square One's adapter uses to derive its project slug. There is no project
name field. Names exist only inside the English prose ("Paramount", "Infinity",
"Mamba"), and two of the four projects are never named at all.

**No status field.** Nothing resembling `status`, `sold` or `available`. Presence
in the feed is the only availability signal.

**No completeness.** The feed carries a *selection*. One project's own
description reads "a contemporary residential development of 27 thoughtfully
designed apartments"; four of those 27 are in the feed.

The root element is `<root>` with `<property>` siblings and a `<kyero>` element
holding only `feed_version`. Square One's adapter reads `kyero.property`, so the
parse path differs even though the property schema matches.

## Grouping: neither signal works alone

Measured on the live feed. Pairwise distances are bimodal — 0–9 m inside a
project, one 61 m case, then nothing until 400 m+.

| Criterion | Result | Failure |
| --- | --- | --- |
| Proximity only | 5 projects | Splits **Mamba**: 1074 sits 450 m from the rest of its own project |
| Identical description only | 5 projects | Splits **Paramount**: its 4 units carry 2 different description texts |
| **Proximity OR identical description** | **4 projects** | none observed |

The combination is stable across every threshold from 100 m to 400 m — the same
four groups throughout, so the number is chosen from the middle of a plateau
rather than tuned to a cliff. **150 m.**

| Project | Units | Description opens with |
| --- | --- | --- |
| A | 1057, 1061, 1072, 1137 | "A contemporary residential development of 27 …" |
| B | 1059, 1078, 1079, 1083 | "Paramount is a modern residential development …" |
| C | 1074, 1076, 1087, 1088, 1090, 1092 | "Defined by … Mamba …" |
| D | 1086, 1111 | "Infinity is a contemporary residential …" |

The `town` field is not usable as a grouping input: 1078 is labelled "Chlorakas"
and sits 61 m from three units labelled "Agios Theodoros", in the same project.

## Design

### Identity is anchored in the database, not recomputed

The operator names these projects by hand — they have said so. That makes
identity stability the first requirement, not a detail: if a project's key
changes between syncs, the hand-typed name stays on the old row while a new,
unnamed project appears beside it.

Recomputing the grouping every sync cannot give that. It is stable *today*, but
Mamba is held together by one description match; if 1076 leaves the feed and
Mito then edits the text, the project splits.

So: **a cluster is matched to the existing Mito `Development` whose coordinates
it is nearest to, within 150 m. Only a cluster matching none creates a new
project.** Feed churn then cannot rename or re-key anything.

### Where the code goes — the boundary matters

`src/app/preview-project/feeds.ts` imports xml2js, view types and a text helper.
**It does not import Prisma, and must not start.** It is the stateless adapter
layer, used by the public preview page as well as the sync.

The work therefore splits along that existing seam:

| Layer | File | Responsibility |
| --- | --- | --- |
| Stateless | `feeds.ts` — new `mitoClusters()` | Fetch, parse Kyero v3 from `<root>`, cluster by proximity-or-description, return clusters with their units, description and centroid. No database, no identity. |
| Stateful | `feedSync.ts` — new Mito branch | Load existing Mito `Development` rows, match each cluster to the nearest within 150 m, assign or reuse a `feedProjectId`, build the `ProjectVM`, hand it to the existing machinery. |

`syncOneProject` already accepts an injected view model
(`opts.vm !== undefined ? opts.vm : await getPreviewProject(dev, id)`), so the
Mito branch reuses every downstream behaviour — unit reconciliation, image
mirroring, pruning — without new machinery.

`listProjectIds("mito")` and `getPreviewProject("mito", …)` stay out of it.
Mito never enters the id-driven path, because the premise of that path is a feed
that supplies ids.

### `feedProjectId`

Assigned once, at creation, as `mito:<lat>,<lng>` from the cluster centroid
rounded to five decimals. Never recomputed: later syncs match by proximity to the
stored `Development.latitude/longitude` and reuse whatever id is already there.
Readable, and visibly tied to the anchor it came from.

### Two things that must not be forgotten

**`DEV_ACCOUNT` needs `mito: { slug: "mito-xml", name: "Mito (XML)" }`.**
`ensureAccount` falls back to `{ slug: dev, name: dev }`, so without this entry
the first sync would upsert a *second*, empty account with slug `mito` beside the
one the operator configured. The same mistake is already recorded in that map's
comment for Medousa, where it happened.

**The silent Island Blue fallback gets a guard.** `getPreviewProject` should
refuse an unrecognised developer key rather than quietly serving another
developer's feed. This is not strictly required for Mito — Mito bypasses that
function — but Mito is what exposed it, and the next developer added without an
adapter will hit it the same way.

### Content

The English `desc.en` becomes the project description, the operator overrides it
as with every other developer, and translations and SEO text run through the
existing generation. Where a cluster carries more than one description variant
(Paramount), the longest wins — it is the one with the most detail, and the
choice must be deterministic so the text does not flip between syncs.

Each property becomes one `DevelopmentUnit`: `ref` from the feed's `ref`, plus
price, type, beds, baths, built and plot area, and its images.

## Known limitations, to be stated on handover

- **Unit counts understate reality.** The feed lists what is available, not the
  development. Project A will show 4 units where its own description says 27.
  Every `{unitsAvailable}` SEO placeholder and every "N of M available" figure
  inherits that. There is no field on `DevelopmentOverride` for a manual total,
  so correcting it would need a schema change — out of scope here, and worth
  raising with Mito instead.
- **Availability is implied.** No status field, so present = available, absent =
  gone. Same mechanic as the other XML developers, but without a total to measure
  against.
- **Two of four projects are unnamed in the feed.** The operator names them; that
  is the agreed division of labour, and the reason identity stability is the
  first requirement above.

## Verification

- `mitoClusters()` against the live feed returns exactly the four groups in the
  table above, and returns the same four at thresholds 100, 150, 250 and 400 m.
- A second sync with the feed unchanged creates no new projects and changes no
  `feedProjectId`.
- Removing a unit from a cluster in a simulated feed does not re-key its project.
- A first sync creates four projects under account `mito-xml` and creates no
  account with slug `mito`.
