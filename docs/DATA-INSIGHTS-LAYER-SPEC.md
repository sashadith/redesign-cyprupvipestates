> **Written 2026-07-16 — the Development/Project separation assumption is
> outdated; they are unified at the routing layer since 2026-07-17.** This
> particularly affects the "two separate systems with no relational link"
> framing below (Important structural fact section) and the developer-page
> mapping analysis that depends on it. Recovered from `wip/content-imports`
> (Phase 6 audit, 2026-07-18).

# Data Insights Layer — Implementation Blueprint

**Planning document only.** No code, no redesigns, no CMS changes, no implementation. Everything below is a specification to be reviewed and approved before any build work starts.

**Relationship to the master plan:** this document is the detailed execution spec for the data-enrichment slice of `docs/SEO-GROWTH-ROADMAP-2026.md` — specifically Opportunity Map items **#4** (developer page structured data), **#9** (developer/project linking), and **#31** (Price Report), plus the "Existing Content Improvement" and "EEAT Strategy" sections. It does not replace that roadmap; numbers here are cross-checked against it and should be read alongside it.

**Data sources for this document:**
- Live public inventory: `Project` model (221 published EN listings), `Developer` model (22 EN bio pages / 88 across 4 languages)
- New per-unit pipeline: `Development` + `DevelopmentUnit` (1,466 units, 198 developments, 9 developer feeds — not yet public-facing)
- Search performance: GSC export `/root/seo-data/Pages.csv` (trailing 3-month period referenced throughout `SEO-GROWTH-ROADMAP-2026.md`)

**Important structural fact carried through this whole document:** the 1,466-unit dataset (`Development`/`DevelopmentUnit`) and the live public site (`Project`/`Developer`) are **two separate systems** with no relational link. For city, property-type, commercial-landing, and project "market-context" pages this doesn't matter — those are thematic filters (district/type/beds), not identity lookups. For **developer pages** it does matter — enrichment requires a one-time manual mapping between a public `Developer` page and its corresponding `DeveloperAccount` in the new pipeline. Today, **8 of 22 EN developer pages have a direct match**: Aristo, BBF, Domenica, INEX, Island Blue, Medousa, Olias Homes, Pafilia.

---

## PART 1 — Page Prioritization (Top 25)

Methodology: ROI is judged from real GSC impressions/position (headroom = how far from page 1, i.e. how much room to gain), data richness (sample size behind the stat), and implementation effort (readiness of the underlying data link). Scores are a directional 0–100 heuristic, not a precise model — used for ordering, not as a guarantee.

| # | URL | Page type | Search intent | Impr / Pos (GSC) | Available statistics | SEO impact | EEAT impact | Conversion impact | Effort | ROI |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` (homepage, all langs) | Homepage | Brand + category entry | pos ~28.9 (per roadmap) | Site-wide: 1,466 units, 9 developers, district split | H | H | M | Low | **95** |
| 2 | `/en/developers/aristo-developers` | Developer | "aristo developers cyprus" | 1,329 impr, pos 5.39, **0 clicks** | 30 developments, unit count/price range (matched feed) | M | H | H | Med | **93** |
| 3 | `/luxusvillen-in-zypern` (DE hub #1) | Property-type/luxury | "luxusvilla zypern" | 3,318 impr, pos 14.89 | 142 villas >€1M sitewide; Cyprus-wide villa avg €977K (Paphos) | H | H | M | Low | **92** |
| 4 | `/en/off-plan-properties-in-limassol` | Commercial landing | "off plan property limassol" | 3,954 impr, pos 4.9, 5 clicks | 232 off-plan units in Limassol, completion-year pipeline | H | M | M | Low | **90** |
| 5 | `/en/off-plan-properties-cyprus` | Commercial landing | "off plan cyprus" | 3,014 impr, pos 8.6, 13 clicks | 522 off-plan units sitewide by district/year | H | M | M | Low | **89** |
| 6 | `/en/developers/island-blue` (+ prefixless variant) | Developer | "island blue cyprus" | ~750 impr combined, pos 6.5–7.8 | **66 developments — our single largest feed source**; full inventory stats | M | H | H | Med | **88** |
| 7 | `/en/villas-in-cyprus` | Property-type | "villas in cyprus" | 1,025 impr, pos 33.35 | 346 villas sitewide, price ladder by beds | H | H | M | Low | **87** |
| 8 | `/grosse-villen-zypern` | Commercial landing | "große villen zypern" | 1,025 impr, pos 55.31 | Large-villa segment (4+ bed avg €1.2–2.2M) | H | M | M | Low | **85** |
| 9 | `/en/developers/bbf` | Developer | "bbf cyprus" | 816 impr, pos 8.41, 9 clicks | 34 developments (matched feed) | M | H | H | Med | **84** |
| 10 | `/en/investment-properties-limassol` | Commercial landing | "investment property limassol" | 1,016 impr, pos 24.07, 0 clicks | Limassol avg €1.31M, price/m² €3.8–5.8K by area | H | H | M | Low | **83** |
| 11 | `/en/developers/domenica-group` | Developer | "domenica group cyprus" | 1,004 impr, pos 7.65, 1 click | 17 developments (matched feed) | M | H | H | Med | **81** |
| 12 | `/en/off-plan-properties-in-paphos` | Commercial landing | "off plan paphos" | 1,344 impr, pos 39.16, 2 clicks | 180 off-plan units in Paphos | H | M | M | Low | **80** |
| 13 | `/luxusvillen-zypern-ueber-1-mio` | Commercial landing | "luxusvilla über 1 million" | 906 impr, pos 47.44, 5 clicks | 142 villas >€1M, exact range/avg | H | H | M | Low | **79** |
| 14 | `/luxusimmobilien-auf-zypern` | Property-type/luxury | "luxusimmobilien zypern" | 877 impr, pos 29.53, 5 clicks | Site-wide luxury segment stats | H | M | M | Low | **77** |
| 15 | `/en/developers/medousa-developers` | Developer | "medousa developers" | 581 impr, pos 9.72, 5 clicks | 16 developments (matched feed) | M | H | H | Med | **75** |
| 16 | `/en/properties-paphos` | City | "properties for sale paphos" | 271 impr, pos 35.89, 8 clicks | Paphos avg €723K, n=599, villa/apt split | H | H | M | Low | **74** |
| 17 | `/en/property-for-sale-limassol` | City | "property for sale limassol" | 504 impr, pos 5.68, 3 clicks | Limassol avg €1.31M, n=316 (reinforce a page already ranking well) | M | H | M | Low | **72** |
| 18 | `/en/developers/pafilia` (+ prefixless) | Developer | "pafilia cyprus" | ~280 impr combined, pos ~10 | 12 developments (matched feed) | M | H | H | Med | **70** |
| 19 | `/en/villas-in-paphos-with-private-pool` | Commercial landing (niche) | "villa with private pool paphos" | 441 impr, pos 29.49, 6 clicks | Villa base n=254; pool-tagged subset (needs amenity filter) | M | M | M | Low-Med | **68** |
| 20 | `/en/apartments-in-cyprus` | Property-type | "apartments in cyprus" | 292 impr, pos 7.52, 6 clicks | 580 apartments sitewide, price ladder | M | M | M | Low | **66** |
| 21 | `/en/developers/inex` | Developer | "inex cyprus" | 195 impr, pos 7.43, 1 click | 7 developments (matched feed, smallest sample) | L | M | M | Med | **62** |
| 22 | `/en/investment-property-in-cyprus` | Commercial landing | "investment property cyprus" | 383 impr, pos 16.1 | Sitewide investment-relevant cuts (yield proxy needs rental data — not yet available) | M | M | M | Low | **60** |
| 23 | `/en/villas-in-cyprus-for-investors` | Commercial landing | "villas cyprus investors" | 187 impr, pos 9.06 (already decent) | Villa segment stats (reinforcement, not rescue) | L | M | M | Low | **57** |
| 24 | `/en/property-for-sale-larnaca` + `/en/villas-in-larnaca` | City | "property for sale larnaca" | 25 + 48 impr, pos 4.24 / 11.12 | **New finding:** 119 available Larnaca units, avg €428K — real inventory the parent roadmap didn't have when it advised "Larnaca is not inventory-backed" | M | M | M | Low | **55** |
| 25 | `/en/apartments-in-cyprus/apartments-in-paphos` | Property-type sub-page | "apartments in paphos" | 190 impr, pos 4.76 (already excellent) | n=281, avg €448,948, 2-bed cut n=174 avg €450K | L | M | M | Low | **52** |

**Notable exclusions from this Top 25 (documented, not overlooked):**
- High-impression developer pages **without** matched feed data yet — Mito Developers (3,447 impr, pos 5.57), G&V Hadjidemosthenous (1,341), Quality Home (1,112), Korantina Homes (1,111), AGG Luxury Homes (1,246), Sol Properties (861), Reiwa (832). These are legitimate future candidates once onboarded to the feed/Drive pipeline (see Part 4) — enriching them today would mean showing no data or (worse) stale/wrong data.
- PL/RU-language versions of the above — per the parent roadmap, RU is explicitly the lowest-ROI language; PL is secondary. Both are correctly deprioritized here in favour of EN/DE.
- The DE blog flagship (`wo-leben…`, 389 clicks/pos 3.06) — already performing excellently; a stats block here is a "nice to have" for topical depth, not a rescue, and isn't a commercial page.

---

## PART 2 — Data Block Inventory

Every block is **read-only, self-contained, and additive** — no dependency on or modification of any card/listing component (see constraint below). Each renders from an aggregate query result (numbers/strings), never a `Project`/unit object directly.

### 1. Market Overview
- **Purpose:** a compact "at a glance" summary for a city, property type, or district page.
- **Metrics:** unit count, average price, price range, available/reserved/sold split.
- **Fields:** `DevelopmentUnit.price`, `.status`; `Development.district`/`.area`.
- **Fallback:** if n < 5, show count only ("X properties tracked"), suppress averages.
- **Sample size:** n ≥ 5 for averages; n ≥ 20 preferred for headline placement.
- **Update frequency:** monthly (cheap to compute; keeps "as of" date fresh without a full quarterly cycle).

### 2. Average Prices
- **Purpose:** the core "what does it cost" answer for a page's theme.
- **Metrics:** average price, median price (more robust to outliers than mean given the €1–€11.5M spread seen in the data).
- **Fields:** `DevelopmentUnit.price`, filtered by `status: available`.
- **Fallback:** if n < 5, omit the block entirely rather than show an unreliable average.
- **Sample size:** n ≥ 5 minimum, n ≥ 10 recommended.
- **Update frequency:** monthly.

### 3. Price Per m²
- **Purpose:** the single most-searched, most-comparable real-estate statistic; differentiates from competitor portals that rarely surface it cleanly.
- **Metrics:** average €/m², range.
- **Fields:** `DevelopmentUnit.price` ÷ parsed `areaBuilt` (numeric extraction needed — see Part 4 data-quality note on unit suffixes).
- **Fallback:** if fewer than 5 units have both price and area, suppress.
- **Sample size:** n ≥ 5; 1,017 of 1,466 units currently qualify sitewide.
- **Update frequency:** monthly.

### 4. Bedroom Price Ladder
- **Purpose:** self-qualification tool ("what does a 2-bed cost here") — high, direct conversion value.
- **Metrics:** avg price per bedroom count (1 through 6+), site-wide or per-district.
- **Fields:** `DevelopmentUnit.price`, `.beds`.
- **Fallback:** collapse thin rungs (e.g. 6-bed n=11) into a "5+ bed" bucket rather than showing a shaky single-digit average.
- **Sample size:** n ≥ 10 per rung preferred; site-wide 1-through-4-bed rungs all qualify today (142–384 units each).
- **Update frequency:** quarterly (this ladder is stable; doesn't need monthly refresh).

### 5. Area Comparison
- **Purpose:** the "which neighbourhood fits my budget" table — the report-style centerpiece, usable on city pages too.
- **Metrics:** avg price, avg €/m², unit count, by named area within a district.
- **Fields:** `Development.area`, `DevelopmentUnit.price`/`areaBuilt`.
- **Fallback:** only list areas with n ≥ 5 (today: ~30 qualifying areas); merge sub-n areas into an "Other areas" line rather than omitting silently.
- **Sample size:** n ≥ 5 per area row.
- **Update frequency:** quarterly.

### 6. New-Build Supply Pipeline
- **Purpose:** signals market activity/momentum — a distinctly EEAT-flavoured block (shows we track the market, not just list it).
- **Metrics:** count of units/developments by completion year.
- **Fields:** `Development.completion` (needs year-extraction — see Part 4).
- **Fallback:** bucket anything unparseable as "Completion TBC / Ready now."
- **Sample size:** no minimum (a simple count), but suppress years with < 3 developments to avoid a noisy chart.
- **Update frequency:** quarterly.

### 7. Market Activity
- **Purpose:** demand-pressure proxy — how much of current stock is already reserved/sold.
- **Metrics:** available / reserved / sold percentages.
- **Fields:** `DevelopmentUnit.status`.
- **Fallback:** if reserved+sold < 5 units, show available count only (don't imply a "hot market" from noise).
- **Sample size:** n ≥ 15 total units in scope.
- **Update frequency:** monthly (this is the most time-sensitive block — status changes are the whole point).

### 8. District Comparison
- **Purpose:** the highest-level "where should I buy" comparison (Paphos vs Limassol vs Larnaca).
- **Metrics:** avg price, avg €/m², villa/apartment split, per district.
- **Fields:** `Development.district`, `DevelopmentUnit.price`/`type`.
- **Fallback:** exclude a district entirely if n < 15 (protects Larnaca-type findings from overstatement even as its sample grows).
- **Sample size:** n ≥ 15 per district row; all 3 tracked districts qualify today.
- **Update frequency:** quarterly.

### 9. Cheapest Entry Prices
- **Purpose:** a practical, screenshot-friendly "what can I get for X" table — strong for both SEO featured-snippet potential and conversion.
- **Metrics:** lowest available price per bedroom count per district.
- **Fields:** `MIN(price)` grouped by `district` × `beds`, `status: available`.
- **Fallback:** if a district/bed combination has no unit, omit that cell (don't show €0 or "N/A" prominently).
- **Sample size:** works even with n=1 per cell (it's a minimum, not an average) — but the block as a whole should only render if ≥ 3 populated cells exist.
- **Update frequency:** monthly (entry prices move faster than averages — a unit selling changes the "cheapest").

### 10. Luxury Segment Snapshot
- **Purpose:** powers the luxury-cluster pages specifically (`luxusvillen-*`, `luxury-villas-over-1-million`).
- **Metrics:** count of units > €1M, avg price within that segment, top district for luxury supply.
- **Fields:** `DevelopmentUnit.price > 1,000,000`.
- **Fallback:** if segment n < 10, broaden the threshold description ("over €750K") rather than force a €1M cut with a thin sample.
- **Sample size:** n ≥ 10; today 142 villas alone qualify at >€1M.
- **Update frequency:** quarterly.

### 11. Developer Snapshot
- **Purpose:** the developer-page-specific block — inventory count, availability, price range for one specific developer.
- **Metrics:** total units tracked, available count, avg price, price range, property-type mix.
- **Fields:** `DeveloperAccount` (via the manual mapping table, see Part 4) → its `Development`/`DevelopmentUnit` rows.
- **Fallback:** if the mapping doesn't exist for a given `Developer` page, the block simply doesn't render (silent omission, never a broken/empty block) — this is the mechanism that keeps the other 14 unmatched developer pages safe from showing garbage.
- **Sample size:** n ≥ 5 units for the developer; below that, show inventory count only, no averages.
- **Update frequency:** monthly (this is inventory-status-sensitive, same reasoning as Market Activity).

---

## PART 3 — Page Type Strategy

**Constraint carried through every section below:** no redesigns, no card changes, no listing-UI changes. Every block is placed *around* existing layouts, never inside them. "Location" below is described conceptually (above/below an existing section), not as a visual spec.

### 1. City pages
- **Recommended blocks:** District Comparison (if the page is a district hub) → Market Overview → Average Prices → Price Per m² → Bedroom Price Ladder → Cheapest Entry Prices.
- **Recommended order:** overview first (headline numbers), granularity increasing downward.
- **Recommended location:** as a new section between the existing intro copy and the property-listing section — never inside the listing grid itself.
- **Data requirements:** `district` scalar match is exact and reliable (Paphos/Limassol/Larnaca) — no normalization risk here.
- **Risks:** Larnaca's smaller sample (n=119) needs the "n ≥ 15" fallback rule respected; don't overstate confidence on a thinner market.

### 2. Property-type pages
- **Recommended blocks:** Average Prices → Bedroom Price Ladder → Price Per m² → (if applicable) Luxury Segment Snapshot.
- **Recommended order:** headline average first, then the ladder (most quoted/screenshotted element), then €/m² for the more analytical reader.
- **Recommended location:** below the hero/intro, above the listings grid.
- **Data requirements:** **property-type normalization must happen first** (Villa/Villas, Apartment/Apartments — see Part 4). This page type is the most exposed to that specific data-quality issue.
- **Risks:** thin sub-types (Townhouse, Studio, Plot) will trip the n ≥ 5 fallback often — expect these blocks to be sparser/absent on niche type pages, by design.

### 3. Commercial landing pages (off-plan, luxury, investment, niche-intent)
- **Recommended blocks:** varies by theme — New-Build Supply Pipeline for off-plan pages; Luxury Segment Snapshot for luxury pages; Market Overview + Average Prices as the generic default for investment/niche pages.
- **Recommended order:** theme-specific block first (it's *why* the visitor is here), Market Overview as supporting context after.
- **Recommended location:** as an inserted section, keyed off a slug-to-filter mapping table (per-page theme → {district, type, beds, completionAfter}) — the same mechanism across all 75 landing pages, no per-page manual authoring, no CMS/`contentBlocks` involvement.
- **Data requirements:** the mapping table itself is the main deliverable here (see Part 6, Phase 1) — a one-time, reviewable list of ~25–40 rows (only the pages actually being enriched, not all 75 at once).
- **Risks:** amenity-filtered pages (`villas-in-paphos-with-private-pool`) need an `attrs`/`amenities` text-match filter, which is noisier than a clean scalar filter — validate sample size before publishing, don't assume it inherits the parent villa count.

### 4. Project pages
- **Recommended blocks:** Market Overview only, scoped as "comparable market context" (filtered by this project's own `city` + `propertyType`, not by matching to a specific `Development` row — see structural note at the top of this document).
- **Recommended order:** single block, no stacking — this page type's job is to sell one specific listing, not to be a market-research page.
- **Recommended location:** as an independent sibling section placed adjacent to (not inside) the existing `ProjectSameCity` component — e.g. directly above or below it in the page layout. `ProjectSameCity` itself is not opened, wrapped, or modified.
- **Data requirements:** `Project.city` + `Project.propertyType` are already scalar columns — no schema change, no cross-system linking.
- **Risks:** the biggest risk here is scope creep — it would be tempting to try to match a project to "its own" `Development` record for richer stats; **explicitly out of scope** (221-row manual mapping, uncertain payoff, not worth it — see Part 4).

### 5. Developer pages
- **Recommended blocks:** Developer Snapshot only.
- **Recommended order:** single block.
- **Recommended location:** as a new section between the existing developer intro/bio and the projects grid — never interleaved with individual project cards.
- **Data requirements:** the manual `Developer.slug` ↔ `DeveloperAccount.id` mapping table (Part 4) is a hard prerequisite — without it this page type cannot be enriched at all, by design (no fuzzy/automatic matching).
- **Risks:** only 8 of 22 EN developer pages qualify today; the other 14 must render with no block at all (not a placeholder, not a "coming soon") until they're onboarded to the feed/Drive pipeline.

---

## PART 4 — Data Quality Audit

Ranked by priority (blocking issues first), with effort estimates.

| Priority | Issue | Detail | Effort |
|---|---|---|---|
| **P1 — Blocking** | Property-type duplication | "Villa"/"Villas", "Apartment"/"Apartments" recorded as distinct values across different feeds (casing/pluralization drift) — any type-based stat is wrong until normalized. | **Low** — one normalization function (already partly prototyped during this session's driveAvailabilitySync work), applied at query time; no data migration needed. |
| **P1 — Blocking** | Missing property type | ~50 available units have `type: null`. | **Low** — exclude from type-specific blocks (already the correct fallback behaviour), no fix needed beyond the exclusion rule itself. |
| **P1 — Blocking** | Developer-page identity mapping missing | No link between public `Developer` and pipeline `DeveloperAccount` — blocks 100% of Part 3 §5 until built. | **Low** — one-time manual table, ~22 rows, 8 populated now. |
| **P2 — High** | District normalization | 53 developments have `district: null` despite having a valid `area` (e.g. "Kissonerga," "Chloraka" imply Paphos but the district field wasn't back-filled). | **Medium** — needs an area→district lookup table (a superset of work already done for Paphos/Pafos dedup in the internal-linking project) covering all ~30+ observed area names. |
| **P2 — High** | Area name inconsistency | Duplicate/near-duplicate area strings: "Paphos" vs "Emba, Paphos" vs "Empa, Paphos" vs "Geroskipou" vs "Geroskipou, Paphos" vs "Geroskipou/Kato Paphos" — these fragment sample sizes that would otherwise be large enough to feature. | **Medium** — a canonicalization map (similar in spirit to the `refKey()`/`buildCanonicalMatcher()` normalization built for the Drive-sync project name problem this session) — same class of problem, reusable pattern. |
| **P2 — High** | Missing m² | 449 of 1,466 units have no `areaBuilt` value — blocks Price Per m² for those rows specifically (1,017 still qualify). | **Medium** — no retroactive fix available without going back to source documents; treat as a permanent partial-coverage constraint, not a bug to "fix." |
| **P3 — Medium** | Outlier prices | At least one unit recorded at `price: €1` (clearly a data-entry/extraction artifact) found during this analysis; likely a handful of others at extreme ends. | **Low** — a sanity floor/ceiling filter (e.g. exclude price < €20,000 or > €20M from aggregates) added at the same query layer as the type normalization. |
| **P3 — Medium** | Feed inconsistency (structural) | Different developer feeds report different field sets natively (e.g. some give a single "total area," others split ground/upper floor; some give bathrooms, others don't) — already partly handled by the `attrs` JSON fallback built into the sync pipeline, but means sample sizes for finer cuts (e.g. "price by bathroom count") will always be uneven across feeds. | **Low** (already mitigated by design) — worth stating explicitly so nobody is surprised when a cut has gaps. |
| **P3 — Medium** | Non-deterministic re-extraction drift | The AI-driven price-list extraction (Drive-sync pipeline) is not byte-stable run-to-run — a project or unit's own labelling can shift slightly between syncs. Several defensive layers were added this session (ref normalization, "never overwrite good data with empty," canonical name matching against existing DB records), but this remains a live characteristic of the pipeline, not a one-time fix. | **Ongoing** — no additional action needed for this spec specifically, but any stats block should be built to tolerate a project's sample composition shifting slightly between refreshes, not assume perfect stability. |

**Overall read:** none of the P1 items block *starting* — they're all low-effort, and the normalization work overlaps significantly with work already done this session for the Drive-sync pipeline (the same "messy multi-source strings need canonicalization" problem, solved once, reusable here).

---

## PART 5 — SEO Impact Model

| Page type | Why Google would value the added data | Query classes that benefit most | Pages most likely to improve |
|---|---|---|---|
| **City pages** | Turns a generic "properties for sale in X" page into one with unique, sourced statistics — exactly the kind of added value Google's helpful-content guidance rewards over templated listing pages. Large sample sizes (n=119–599) give genuine statistical confidence. | "[city] property prices," "average house price [city]," "cost of property in [city]" | `properties-paphos` (pos 35.89 → real headroom), `property-for-sale-limassol` (already pos 5.68, reinforces rather than rescues) |
| **Property-type pages** | Category pages benefit most from becoming genuine topical hubs — a bedroom-price-ladder and €/m² breakdown is exactly the kind of structured, comparison-ready content that also wins table/list-style featured snippets. | "villas in cyprus price," "apartment prices cyprus," "[type] cyprus cost" | `villas-in-cyprus` (pos 33.35 — the single biggest headroom opportunity in this category) |
| **Commercial landing pages** | These are the site's largest page count (75) and most direct match to commercial search intent; original statistics differentiate them from any competitor page built on the same generic "properties for sale" template. Off-plan and luxury pages specifically benefit from data no scraped-listing competitor easily replicates (completion-year pipeline, >€1M segment counts). | "off plan property cyprus," "luxury villas cyprus over 1 million," "new build cyprus [year]" | `off-plan-properties-in-limassol` (already pos 4.9 but 0.13% CTR — a stats block plus title/meta work from the parent roadmap's CTR initiative compounds here), `grosse-villen-zypern` (pos 55.31 — large headroom) |
| **Project pages** | Lower direct ranking upside (individual listings rarely compete on broad market queries), but a "comparable market" block adds unique on-page content depth, which supports dwell time and reduces bounce — both indirect ranking signals — and directly supports the parent roadmap's "top-20 project upgrade" initiative (§6 item 6). | Long-tail project-name + "cyprus new development" queries | The already-trafficked project pages named in the parent roadmap (`villas-cap-st-georges-resort`, `cypress-park`) — enrichment here reinforces existing traffic rather than creating new rankings |
| **Developer pages** | Directly addresses the parent roadmap's Opportunity #4 ("Structured data + strong titles on developer pages... brand-query buyers are deep-funnel") — a live inventory snapshot is a strong, unique trust signal specifically for brand-name queries, and helps convert the striking **0-click, page-1-position** anomaly seen on `aristo-developers` (1,329 impr, pos 5.39, 0 clicks). | "[developer] cyprus," "[developer] reviews," "[developer] projects" | `aristo-developers` (biggest impression/click mismatch of any page in this dataset — a title/meta + stats combination is the highest-confidence single fix identified in this whole analysis) |

---

## PART 6 — Implementation Roadmap

Smallest possible MVP first. The objective is maximum SEO/EEAT improvement per unit of engineering effort — not the most complete system.

### Phase 1 — Foundation + highest-certainty wins
- **Pages affected:** the 8 matched developer pages (Aristo, BBF, Domenica, INEX, Island Blue, Medousa, Olias Homes, Pafilia) + 5 city pages (Paphos, Limassol, Larnaca ×2 URL variants each in EN) + the property-type normalization/canonicalization work from Part 4 (P1 items).
- **Data blocks used:** Developer Snapshot, Market Overview, Average Prices, District Comparison.
- **Engineering effort:** Low — one normalization layer (type + district + outlier filtering), one manual developer-mapping table, two new query functions (developer aggregate, district aggregate), block components with no card/listing dependency.
- **SEO impact:** High — targets the single biggest anomaly found (`aristo-developers` 0-click/page-1) plus the largest-sample, most defensible statistics (district-level, n=119–599).
- **Business impact:** Medium-High — developer-page visitors are deep-funnel; city-page visitors are broad-funnel but high-volume.

### Phase 2 — Property-type + commercial landing expansion
- **Pages affected:** `villas-in-cyprus`, `apartments-in-cyprus`, plus the ~15 highest-ROI commercial landing pages identified in Part 1 (off-plan ×3, luxury ×3, investment ×2, remainder).
- **Data blocks used:** Bedroom Price Ladder, Price Per m², New-Build Supply Pipeline, Luxury Segment Snapshot, Cheapest Entry Prices.
- **Engineering effort:** Medium — requires the slug-to-filter mapping table (one-time authoring, ~20–25 rows for this phase, reviewed before publishing), plus the area-name canonicalization work from Part 4 (P2) since several of these pages cut by area, not just district.
- **SEO impact:** High — this phase covers the largest page count and the widest spread of query intents (off-plan, luxury, investment, bedroom-count).
- **Business impact:** High — bedroom ladder and cheapest-entry-price blocks are the most directly conversion-relevant blocks in the whole inventory.

### Phase 3 — Project-page context + remaining developer pages + Price Report groundwork
- **Pages affected:** top-20 project pages already named in the parent roadmap's improvement plan (comparable-market block only), remaining EN developer pages as they get onboarded to the feed pipeline, plus any DE-language mirrors of Phase 1/2 pages the data justifies.
- **Data blocks used:** Market Overview (project-scoped), Developer Snapshot (newly onboarded developers), Area Comparison (as a candidate for a future dedicated area-guide content type, not built in this phase).
- **Engineering effort:** Medium-High — project-page integration touches the most-visited page template on the site, so needs the most careful review despite being architecturally simple (one additional independent block).
- **SEO impact:** Medium — mostly reinforcement of already-ranking pages rather than new-ranking creation, per Part 5.
- **Business impact:** High — this is where the data layer most directly touches the bottom of the purchase funnel.

**Explicitly deferred beyond Phase 3:** PL/RU localization of any block (per the parent roadmap's language-priority findings), the standalone Cyprus Property Price Report (see Part 7), automated quarterly regeneration of any block (Phase 1–3 stats can be refreshed manually on the cadence given in Part 2 until volume justifies automation), and any amenity-filtered niche page (private pool, sea view) until the base district/type pages are proven.

---

## PART 7 — Final Recommendation

### "What should we build first?"

**Build Phase 1 of the existing-page data layer first — specifically, start with the `aristo-developers` page and the three district city pages. Do not start the standalone Cyprus Property Price Report yet.**

### Ranking: what to build, in order

1. **City pages** — largest, most reliable sample sizes (n=119–599), zero cross-system linking risk, directly addresses real headroom (e.g. `properties-paphos` at pos 35.89).
2. **Property-type pages** — same low-risk mechanism as city pages, second-largest samples, and contains the single biggest headroom opportunity found in this entire analysis (`villas-in-cyprus`, pos 33.35).
3. **Landing pages (commercial)** — largest page *count* (75), most varied intents, but needs the one-time slug-mapping table before it can start — hence ranked third, not first, despite comparable per-page value to #1/#2.
4. **Project pages** — cheapest single integration (one block, one existing insertion point) and the highest conversion leverage of anything in this analysis, but the lowest *new-ranking* SEO upside (these pages are already specific, already indexed, already narrow-intent) — so it's "do it because it's easy and helps conversion," not "do it because it moves rankings."
5. **Developer pages** — highest EEAT/trust value per page and directly fixes a documented, unusual anomaly (`aristo-developers`), but gated by the one-time identity-mapping prerequisite and currently limited to 8 of 22 pages — real value, smaller current footprint.
6. **Standalone Cyprus Property Price Report** — last, not because it lacks value (the parent roadmap correctly identifies it as the strongest long-term EEAT/link-building asset), but because **it has to earn authority from a brand-new URL with zero existing signal**, whereas items 1–5 apply the exact same underlying data to **pages that are already indexed, already have real impressions, and in several cases are one step from ranking on page 1**. Every block built for items 1–5 is also reusable groundwork for the eventual Report — nothing here is wasted if/when the Report is built afterward.

### Why this order, in one paragraph

The fastest, lowest-risk, most defensible path to measurable SEO and EEAT improvement is to enrich pages that **already exist, already rank somewhere, and already have a documented gap** (a striking example: `aristo-developers` gets 1,329 impressions at position 5.39 with **zero clicks** — a page one small intervention away from converting real traffic). Every one of items 1–4 can be shipped with no CMS changes, no card/listing modifications, and — critically — no dependency on solving the harder cross-system identity-matching problem that developer pages and a hypothetical "linked" project-page version would need. The standalone Price Report is a real, valuable asset, but it competes for the same engineering time while offering slower payback (new URL, zero existing signal, higher build effort per the parent roadmap's own H-effort rating) — it should follow this work, informed and accelerated by the query/normalization infrastructure this work will have already built.
