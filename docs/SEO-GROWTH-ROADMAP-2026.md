> **Written 2026-07-16 — the Development/Project separation assumption is
> outdated; they are unified at the routing layer since 2026-07-17.**
> Recovered from `wip/content-imports` (Phase 6 audit, 2026-07-18).

# Cyprus VIP Estates — SEO Growth Roadmap 2026 (H2)

**Master SEO strategy document.** Owner: Head of SEO. Horizon: 6 months (Jul 2026 → Jan 2027).
Last updated: 2026-07-07.

> **Purpose of this document.** This is the single source of truth for organic-search strategy. The objective is **not to create more pages** — it is to **maximise qualified organic traffic and qualified leads** from the substantial asset base we already own. Where prior audits assumed "more languages / more landing pages = more growth," this document challenges that and reprioritises around *demand capture* (CTR, internal authority, funnels) over *supply* (page count).

> **Guardrails.** Planning and analysis only. No page created here should be built without a pre-publish review. Nothing in this file changes the site.

> **Data-freshness note.** Inventory and performance figures below reflect production as observed through early July 2026. Two figures are marked **[verify]** because they weren't re-queried on the last pass: exact *category* page counts and *developer-page indexability/linking* status. Confirm both before Month-1 execution; they do not change the strategic conclusions.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Current SEO Asset Inventory](#2-current-seo-asset-inventory)
3. [SEO Opportunity Map (50)](#3-seo-opportunity-map--50-highest-impact-opportunities)
4. [Keyword Gap Analysis](#4-keyword-gap-analysis)
5. [Internal Linking Strategy](#5-internal-linking-strategy)
6. [Existing Content Improvement Plan](#6-existing-content-improvement-plan)
7. [EEAT Strategy](#7-eeat-strategy)
8. [Technical SEO Roadmap](#8-technical-seo-roadmap)
9. [Conversion Optimization Roadmap](#9-conversion-optimization-roadmap)
10. [Six-Month SEO Roadmap](#10-six-month-seo-roadmap)
11. [Week-by-Week Execution Plan](#11-week-by-week-execution-plan)
12. [Quick Wins (next 30 days)](#12-quick-wins--next-30-days)
13. [Things We Should STOP Doing](#13-things-we-should-stop-doing)
14. [Final Prioritization](#14-final-prioritization)

---

## 1. Executive Summary

### Current SEO status
Cyprus VIP Estates (CVE) is a **content-rich, structurally broad** multilingual real-estate site (EN/DE/PL/RU) with a large landing-page footprint, a strong German blog, ~222 project pages and 88 developer pages. The site is **mid-recovery** from a URL migration (German moved to `/de/`, English moved to no-prefix) that temporarily depressed rankings and split link equity. Traffic is concentrated in **Germany** (the dominant market by a wide margin), followed by Cyprus, Poland, the UK and Russia.

The defining characteristic today is a **conversion gap between impressions and clicks**: multiple pages rank on page 1 yet earn ~0% CTR, and many commercial pages sit structurally isolated (no inbound internal links). We have been **over-investing in new supply** (new landing pages per language) and **under-investing in demand capture** (CTR, internal authority, blog→commercial funnels). The next six months should invert that ratio.

### Biggest strengths
1. **German relocation/lifestyle blog cluster** — the crown jewel. `/blog/wo-leben-die-meisten-deutschen-auf-zypern` ranks ~pos 3 with the site's largest click volume; the surrounding cluster (pets, best-places, tax, auswandern) is a proven traffic engine.
2. **Breadth of commercial coverage** — 68 EN / 32 DE / 29 PL / 31 RU commercial landing pages; most city × property-type intents are covered.
3. **Real inventory depth** — 222 projects (166 Paphos, 55 Limassol) and 88 developer pages: a large body of *transactional* pages competitors can't easily replicate.
4. **Proprietary data** — we hold structured pricelist/inventory data (developer names, unit types, prices). This is latent **original research** fuel (price reports) almost no competitor has.
5. **A repeatable production system** — CSV+importer pipeline, cluster-linking method, verification routine. We can ship and interlink pages quickly and safely.

### Biggest weaknesses
1. **CTR failure on page-1 rankings** — e.g. health-insurance (1,984 impr, 0 clicks), Cyprus-vs-North-Cyprus (1,753 impr, 0 clicks), houses-in-cyprus (1,243 impr, 0 clicks). Rankings exist; titles/intent-match do not. *(Four of these were corrected on 2026-07-07 — see §6/§12.)*
2. **Orphaned commercial pages** — 9 EN and 2 DE commercial pages have **zero inbound internal links**; they can't rank to potential without authority.
3. **Under-leveraged transactional assets** — 88 developer pages and 222 project pages receive almost no internal authority despite attracting brand-query impressions.
4. **Weak informational→commercial funnels in EN** — EN owns huge informational impressions (relocation, tax) but doesn't route them to commercial pages the way the DE cluster implicitly does.
5. **Homepage underperformance** — the root `/` ranks ~pos 28.9; the primary brand asset is not pulling its weight.

### Biggest opportunities
1. **Convert existing page-1 impressions to clicks** (title/meta/intent) — fastest ROI on the site.
2. **Flow authority into commercial + developer + project pages** via internal linking — no new content required.
3. **Build the EN relocation/tax → commercial funnel** that already works implicitly in German.
4. **Monetise developer-brand demand** — "[developer] cyprus" queries are high-intent, low-competition, and we own 88 matching pages.
5. **Original research (Cyprus Price/Market Reports)** from our proprietary data — a durable EEAT + link + Discover asset.

### Biggest risks
1. **Migration equity leakage (highest risk).** English ranking URLs (`/en/…`) 301-redirect to no-prefix; German legacy content also lives at no-prefix. This is an active locale-routing/equity risk, not a passive "watch item." A botched redirect map or index split could suppress recovery for months.
2. **Mis-allocated effort.** Continuing to pour time into low-ROI markets (RU) and thin niche pages while the DE/EN funnels and CTR gaps go unaddressed.
3. **Thin/duplicated content at scale.** Rapid multilingual production risks near-duplicate FAQ/CTA/boilerplate that dilutes topical authority (partly mitigated on new pages; older sets unaudited).
4. **Google core/Helpful-Content volatility** on informational blog traffic — over-reliance on a handful of blog URLs (e.g. wo-leben) is concentration risk.

**One-line thesis:** *Stop building supply; start capturing the demand we already rank for — via CTR fixes, internal-authority flow, EN funnels, developer-page monetisation, and one flagship original-research asset.*

---

## 2. Current SEO Asset Inventory

### 2.1 Totals (published)

| Asset | EN | DE | PL | RU | Notes |
|---|---:|---:|---:|---:|---|
| Commercial landing pages | 68 | 32 | 29 | 31 | of 75/37/34/36 total singlepages |
| Blog posts | 32 | 34 | 29 | 30 | DE blog is the traffic leader |
| Case studies | 3 | 3 | 3 | 3 | same 3 stories localised ×4 |
| Project pages | 221 | 222 | 222 | 222 | shared inventory, localised |
| Developer pages | — | — | — | — | **88 total** (shared) |
| Category/parent pages | **[verify]** | | | | property-type & city parents (nested URLs) |

**Project inventory by market/type:** Paphos **166** (Villa 95 / Apartment 69), Limassol **55** (Apartment 49 / Villa 6), Larnaca **1**. → **Only Paphos and Limassol are inventory-backed markets. Larnaca is not** — do not build Larnaca landing pages.

**Geographic demand (GSC, trailing period):** Germany ≈688 clicks ≫ Cyprus ≈392 > Poland ≈212 > UK ≈110 > Russia ≈73 > Austria ≈72 > Switzerland ≈61. → **German-speaking DACH + UK-English are the commercial core; Poland is secondary; Russia is marginal.**

### 2.2 Breakdown by content type

**Commercial landing pages** — comprehensive across city (Paphos/Limassol), property type (apartments/villas/houses/townhouses), and intent (investment, buy-to-let, off-plan, sea-view, beachfront, luxury). PL and RU sets were recently completed to 6-page clusters + a Limassol hub each, fully interlinked. EN is the broadest set but the **least internally organised** (no landing↔landing clusters; 9 orphans).

**Blog clusters** (themes observed):
- **DE:** relocation/auswandern, best places to live, pets, taxes/Mieteinnahmen, cost-of-living — *the strongest cluster on the site.*
- **EN:** relocation (best-areas, move-from-UK), tax/VAT, health insurance, comparison (Cyprus vs Spain/Portugal, vs North Cyprus) — *huge impressions, weak CTR & weak commercial routing.*
- **RU:** relocation/emigration, best areas for expats, pet relocation — *modest but real traffic.*
- **PL:** relocation, Cyprus vs North Cyprus, buying basics — *smallest engagement.*

**Projects** — 222 pages; a handful already earn real traffic (e.g. `villas-cap-st-georges-resort` ~pos 20.5 with ~90 clicks; `cypress-park`). The vast majority are near-orphan and under-optimised (thin copy, likely partial schema).

**Developers** — 88 pages. Brand queries appear in GSC with impressions and page-1-ish positions (e.g. *mito developers* ~818 impr @ ~pos 8.3; *korantina homes*, *sol properties*, *agg luxury homes*). **Indexability/linking status [verify].** High-intent, low-competition, under-exploited.

**Cities** — Paphos and Limassol are covered as hubs + segment pages (recently formalised into hub↔spoke for Limassol in PL/RU). Paphos hub↔spoke is less formalised.

**Luxury pages** — present (e.g. `luxusvillen-in-zypern` ~pos 14.9, 32 clicks; `elitnye-villy…`, `luksusowe-wille…`, `elite/luxury villas`). Ranking but not top; strong commercial value.

**Investment pages** — present in all languages (investment-paphos, buy-to-let, crypto-purchase, investor villas/apartments). Good coverage; weak interlinking and EEAT depth.

**Relocation pages** — mostly **blog** (not commercial). Big EN/DE/RU informational footprint; **no strong bridge to commercial pages.**

**Buyer guides / buying process** — partial (VAT, taxes, buying basics in blog). No consolidated "How to buy property in Cyprus" cornerstone per language.

**Tax content** — EN VAT + taxes, DE Mieteinnahmen/Steuern. Ranks but position-limited (taxes-on-real-estate ~pos 32). High trust value; under-developed as a cluster.

**Case studies** — 3 strong narratives (UK→Cyprus relocation; UK investor diversifying via Limassol; German family luxury villa in Paphos), each localised ×4. **Currently dead ends** — not linked from commercial pages.

### 2.3 Strongest vs weakest vs orphan pages

**Strongest (authority/traffic):**
- `/blog/wo-leben-die-meisten-deutschen-auf-zypern` — 389 clicks @ pos 3 (DE).
- `/en/projects/villas-cap-st-georges-resort` — 90 @ pos 20.5.
- `/blog/haustier-nach-zypern-bringen` — 68 @ pos 6 (DE).
- `/luxusvillen-in-zypern` — 32 @ pos 14.9.
- `/en` homepage — 36 @ pos 3; strong RU blogs (pet relocation ~38, expat areas ~27).

**Weakest / highest-waste (page-1 rankings, ~0 CTR):**
- `/blog/health-insurance-in-cyprus` — 1,984 impr @ pos 9.2, 0 clicks *(title fixed 2026-07-07)*.
- `/blog/difference-between-cyprus-and-northern-cyprus` — 1,753 @ pos 9, 0 clicks *(fixed)*.
- `/houses-in-cyprus` — 1,243 @ pos 12.8, 0 clicks *(fixed)*.
- `/en/blog/cyprus-property-vat-explained` — 2,641 @ pos 8.5, 2 clicks *(fixed)*.
- `/en/blog/taxes-on-real-estate-in-cyprus` — 2,403 @ pos 32, 1 click *(position-limited → content/links, not CTR)*.
- Homepage `/` — pos 28.9.

**Near-orphan commercial pages (zero inbound internal links):**
- **EN (9):** off-plan-properties-cyprus, buy-to-let-property-cyprus, beachfront-properties-in-cyprus, houses-in-cyprus, west-coast-properties-cyprus, properties-in-cyprus, properties-near-golf-courses, properties-near-international-schools, properties-near-city-centre.
- **DE (2):** strandimmobilien-paphos, off-plan-immobilien-zypern.
- **PL / RU: 0** (clusters + hubs already built and interlinked).

### 2.4 Internal-authority distribution (qualitative)

- **Receiving the most internal authority:** PL/RU commercial clusters (recently interlinked), the DE blog flagship, the homepage(s), and pages inside the newly built hub↔spoke structures.
- **Receiving almost none:** the 88 developer pages, the ~222 project pages, the 9 EN commercial orphans, the 2 DE orphans, and the 3×4 case studies. **This is the biggest untapped authority reservoir on the site** — thousands of transactional pages with negligible internal PageRank.

---

## 3. SEO Opportunity Map — 50 highest-impact opportunities

Legend — **Pri:** P1 (now) / P2 (soon) / P3 (later). **SEOimp/Bizimp/Diff:** L/M/H. **ROI:** H/M/L. **When:** Now / Soon / Later.

### A. CTR & SERP-appearance (capture existing impressions)
| # | Opportunity | Lang | Pri | SEOimp | Bizimp | Diff | Time | ROI | When | Why it matters |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Title/meta rewrite on the 5 near-top 0-click pages | EN | P1 | H | M | L | 0.5d | **H** | Now | *(4/5 done)* page-1 impressions convert to clicks immediately |
| 2 | Extend CTR audit to next tier of page-1, sub-2%-CTR pages (all langs) | all | P1 | H | M | L | 2d | **H** | Now | Same mechanism, broader base |
| 3 | Add FAQ/HowTo schema to guide pages to win featured snippets | EN/DE | P2 | M | M | M | 3d | M | Soon | Position-0 for tax/VAT/buying queries |
| 4 | Structured data + strong titles on developer pages | all | P1 | M | H | L | 2d | **H** | Now | Brand-query buyers are deep-funnel |
| 5 | Rich results (Product/Offer/Breadcrumb) on project pages | all | P2 | M | H | M | 4d | M | Soon | 222 pages; SERP real estate + CTR |

### B. Internal-authority flow (no new content)
| # | Opportunity | Lang | Pri | SEOimp | Bizimp | Diff | Time | ROI | When | Why |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | Link the 9 EN orphan commercial pages from matched pages | EN | P1 | H | H | L | 1d | **H** | Now | Unlocks pages that can't currently rank |
| 7 | Cluster the 2 DE orphans (parity with PL/RU) | DE | P1 | M | H | L | 0.5d | **H** | Now | Core market; trivial effort |
| 8 | Build EN landing↔landing clusters (Limassol, Paphos) | EN | P1 | H | H | M | 3d | **H** | Now | EN has none; mirror PL/RU method |
| 9 | Link 88 developer pages from their projects (and vice-versa) | all | P1 | M | H | M | 3d | **H** | Now | Activates the largest orphan pool |
| 10 | Link top project pages from city/type landing sliders + blogs | all | P2 | M | H | M | 3d | M | Soon | Lift cap-st-georges/cypress-park from p2→p1 |
| 11 | Blog→commercial funnels: EN relocation blogs → houses/apartments/off-plan | EN | P1 | H | H | L | 1d | **H** | Now | Route huge informational impressions to money pages |
| 12 | Blog→commercial funnels: EN tax/VAT blogs → investment/buy-to-let | EN | P1 | M | H | L | 0.5d | **H** | Now | Tax intent is pre-purchase |
| 13 | Case studies → commercial pages (embed + link) | all | P2 | M | M | L | 1d | M | Soon | EEAT + de-orphan the case studies |
| 14 | DE relocation/tax blogs → DE commercial hub (extend recovery links) | DE | P1 | H | H | L | 1d | **H** | Now | Reinforce the proven DE funnel |
| 15 | Paphos hub↔spoke formalisation (PL/RU/DE/EN) | all | P2 | M | M | M | 2d | M | Soon | Mirror the Limassol hub structure |

### C. Existing-content depth & refresh
| # | Opportunity | Lang | Pri | SEOimp | Bizimp | Diff | Time | ROI | When | Why |
|---|---|---|---|---|---|---|---|---|---|---|
| 16 | Deepen `taxes-on-real-estate` (pos 32) + interlink tax cluster | EN | P1 | H | M | M | 2d | **H** | Now | Position-limited; 2,400 impr waiting |
| 17 | Homepage `/` title/H1/intro overhaul (pos 28.9) | EN | P2 | H | H | M | 2d | M | Soon | Primary brand asset under-ranking |
| 18 | Refresh DE flagship cluster (freshness + new internal links) | DE | P2 | M | M | L | 2d | M | Soon | Protect the crown jewel |
| 19 | Expand thin project pages (top 20 by impressions) | all | P2 | M | H | H | ongoing | M | Soon | Transactional depth |
| 20 | Consolidate/upgrade EN luxury pages into a luxury cluster | EN | P2 | M | H | M | 2d | M | Soon | High AOV; "luxury villas cyprus" |
| 21 | Buyer-guide cornerstone "How to buy property in Cyprus" per language | all | P2 | H | M | M | 4d | M | Soon | Captures buying-process intent; internal-link hub |
| 22 | Duplicate-FAQ/CTA audit on older EN/DE sets; differentiate | EN/DE | P2 | M | L | M | 3d | M | Soon | Remove thin-content risk |
| 23 | Comparison content upgrade (Cyprus vs Spain/Portugal/North) + CTR | EN | P2 | M | M | L | 2d | M | Soon | 2,000+ impr comparison cluster |
| 24 | Relocation cornerstone per language linking to commercial | EN/DE | P2 | H | H | M | 4d | M | Soon | Bridge the biggest informational demand |

### D. New content — only where gap + commercial value (deliberately limited)
| # | Opportunity | Lang | Pri | SEOimp | Bizimp | Diff | Time | ROI | When | Why |
|---|---|---|---|---|---|---|---|---|---|---|
| 25 | Neighborhood/area guides for Limassol & Paphos districts | EN/DE | P2 | H | H | M | ongoing | M | Soon | Local EEAT + long-tail + internal-link hubs |
| 26 | "British buying in Cyprus (post-Brexit)" commercial-info page | EN | P2 | M | H | M | 2d | M | Soon | *move to cyprus after brexit* 780 impr, 0 cl |
| 27 | DE luxury/investment gap pages (only if keyword-validated) | DE | P3 | M | H | M | 2d | M | Later | Core market; validate first |
| 28 | Golf/marina lifestyle buyer pages (Paphos/Limassol) | EN/DE | P3 | L | M | M | 2d | L | Later | Niche but high-AOV |
| 29 | Pet-relocation → pet-friendly-property bridge (from top RU/DE blogs) | DE/RU | P3 | L | M | L | 1d | M | Later | Monetise a proven blog topic |
| 30 | Retirement-in-Cyprus intent page | EN/DE | P3 | M | M | M | 2d | L | Later | Growing DACH/UK segment |

### E. EEAT & original research (durable authority)
| # | Opportunity | Lang | Pri | SEOimp | Bizimp | Diff | Time | ROI | When | Why |
|---|---|---|---|---|---|---|---|---|---|---|
| 31 | **Quarterly "Cyprus Property Price Report"** from our data | EN(+DE) | P1 | H | H | H | 5d | **H** | Now | Original research → links, Discover, authority |
| 32 | Developer reviews/profiles (credibility + delivered-projects) | all | P2 | M | H | M | ongoing | M | Soon | Turns 88 pages into EEAT assets |
| 33 | Author/expertise entities (named experts, bios, credentials) | all | P2 | M | M | L | 1d | M | Soon | EEAT signals on YMYL (tax/legal) content |
| 34 | Legal/tax content reviewed & attributed to a named advisor | EN/DE | P2 | M | M | M | 2d | M | Soon | Trust for YMYL topics |
| 35 | Downloadable buyer checklists / cost calculators (lead magnets) | EN/DE | P2 | M | H | M | 3d | M | Soon | Links + leads + dwell |
| 36 | Neighborhood guides with original photography/maps | EN/DE | P3 | M | M | H | ongoing | M | Later | Local authority + image SEO |
| 37 | Client testimonials / verified reviews with schema | all | P2 | L | H | L | 1d | M | Soon | Trust + Review rich results |

### F. Technical & discovery
| # | Opportunity | Lang | Pri | SEOimp | Bizimp | Diff | Time | ROI | When | Why |
|---|---|---|---|---|---|---|---|---|---|---|
| 38 | **Resolve EN migration equity** (`/en/…`→no-prefix 301 audit; index split) | EN | P1 | H | H | M | 3d | **H** | Now | Highest technical risk to recovery |
| 39 | Fix legacy flat→nested 308 internal links | all | P1 | M | M | M | 2d | M | Now | Stop equity leaking through redirects |
| 40 | Site-wide 404/broken-link + redirect-chain crawl | all | P1 | M | M | M | 1d | **H** | Now | Baseline hygiene |
| 41 | Hreflang reciprocity audit on legacy pages | all | P2 | M | M | M | 2d | M | Soon | Prevent wrong-language SERPs |
| 42 | Schema coverage sweep (Article/Product/Breadcrumb/FAQ/Org) | all | P2 | M | M | M | 3d | M | Soon | Rich results across the site |
| 43 | Image SEO: descriptive alt, filenames, next-gen formats, Image sitemap | all | P2 | M | M | M | ongoing | M | Soon | Property = image-heavy; Images tab traffic |
| 44 | Core Web Vitals audit (LCP/CLS/INP) on templates | all | P2 | M | M | M | 2d | M | Soon | Ranking + UX; **[measure first]** |
| 45 | Index-bloat review: consolidate ultra-niche EN pages | EN | P2 | M | L | L | 1d | M | Soon | Crawl budget + quality signals |
| 46 | Video SEO: project walkthroughs w/ VideoObject + transcripts | EN/DE | P3 | M | H | H | ongoing | M | Later | Video rich results + dwell + leads |
| 47 | Google Discover optimisation (large images, timely reports) | DE/EN | P3 | M | M | M | ongoing | M | Later | DE blog is Discover-eligible; big upside |

### G. Conversion (SEO-adjacent, lead-focused)
| # | Opportunity | Lang | Pri | SEOimp | Bizimp | Diff | Time | ROI | When | Why |
|---|---|---|---|---|---|---|---|---|---|---|
| 48 | Roll out no-commission + remote-purchase + process blocks to older pages | all | P2 | L | H | M | ongoing | M | Soon | Differentiators that lift conversion & dwell |
| 49 | CTA & lead-form optimisation on top info-intent blogs | all | P2 | L | H | L | 2d | **H** | Soon | Convert the traffic we already have |
| 50 | Trust/authority blocks (reviews, developer credibility, guarantees) | all | P2 | L | H | M | 2d | M | Soon | Lead quality + E-E-A-T signals |

**Portfolio read:** ~30 of the 50 opportunities require **no new pages** (CTR, linking, technical, conversion, refresh). New-content items are deliberately fewer and gated on keyword validation. The single highest *new-content* bet is **#31 (Price Report)** because it compounds (links + authority + Discover + leads) rather than adding one more thin landing page.

---

## 4. Keyword Gap Analysis

> Method: intent-clustered gap analysis using known rankings/impressions + coverage. Volumes are directional (no live keyword tool in this pass — **validate with Search Console + a keyword tool before building new pages**).

### 4.1 English (UK/international — second-largest market, biggest *informational* footprint)
- **Commercial (have, improve):** houses/apartments/villas in cyprus, off-plan cyprus, beachfront/sea-view cyprus. *Gap = CTR + internal links, not pages.*
- **Investment:** "british investing in cyprus" (312 impr, 0 cl), "buy-to-let cyprus", "cyprus property ROI/rental yield". *Gap = depth + funnel from tax/relocation.*
- **Luxury:** "luxury villas cyprus", "luxury property limassol/paphos", "beachfront villas cyprus". *Gap = luxury cluster + EEAT.*
- **Relocation (huge impressions, weak funnel):** "move to cyprus from uk", "move to cyprus after brexit", "best areas to live in cyprus". *Gap = commercial bridge + CTR.*
- **Buying process / legal:** "how to buy property in cyprus", "cyprus title deeds", "buying property in cyprus as a foreigner". *Gap = cornerstone guide.*
- **Tax:** "cyprus property tax", "cyprus property VAT 5% vs 19%", "capital gains tax cyprus". *Have; deepen + snippet.*
- **Lifestyle:** health insurance, cost of living, cyprus vs spain/portugal, north vs south. *Have; monetise via bridges.*
- **Developers:** "[developer] cyprus/reviews/projects". *Have 88 pages; unlink → link.*
- **Comparison / questions:** "is cyprus safe to buy property", "cyprus vs northern cyprus", "cyprus residency by investment". *Have partially; snippet + FAQ.*
- **Missing clusters:** consolidated **buying-guide**, **relocation cornerstone**, **neighborhood guides**, **price/market report**.

### 4.2 German (DACH — the #1 market; protect and extend)
- **Commercial:** "villa/wohnung/haus zypern kaufen", "immobilien zypern" — ranking (e.g. *zypern villa kaufen* ~pos 13, 831 impr) but not top; *gap = internal authority + CTR + luxury depth.*
- **Investment:** "immobilien zypern als kapitalanlage", "renditeimmobilien zypern", "zypern immobilien rendite".
- **Luxury:** "luxusimmobilien zypern" (~pos 14, 257 impr), "luxusvilla zypern".
- **Relocation (crown-jewel intent):** "auswandern nach zypern" (~pos 7.6, 616 impr), "wo leben deutsche auf zypern", "leben auf zypern". *Extend blog→commercial bridges.*
- **Tax:** "mieteinnahmen zypern versteuern", "steuern immobilien zypern" — have, strong.
- **Buying process/legal:** "immobilie zypern kaufen ablauf", "grunderwerbsteuer zypern".
- **Missing clusters:** **German price/market report**, **neighborhood guides (Limassol/Paphos auf Deutsch)**, **relocation cornerstone → commercial**.

### 4.3 Polish (secondary; keep tidy, don't over-expand)
- **Commercial:** "mieszkania/wille/domy na Cyprze", "nieruchomości Limassol/Pafos" — recently built + clustered. *Gap = let them mature; monitor.*
- **Relocation:** "przeprowadzka na Cypr", "życie na Cyprze".
- **Comparison:** "Cypr a Cypr Północny" (~pos 18, 1,261 impr) — CTR + snippet opportunity.
- **Investment/tax:** "inwestycja w nieruchomości Cypr", "podatki Cypr".
- **Missing:** minimal net-new justified; **improve CTR + funnels** rather than add pages.

### 4.4 Russian (marginal market; minimise further investment)
- **Commercial:** новостройки/квартиры/виллы Кипр — recently built + clustered.
- **Relocation:** "переезд на Кипр", "эмиграция на Кипр" (~pos 28, 1,322 impr).
- **Investment:** "инвестиции в недвижимость Кипр", "доходная недвижимость".
- **Reality check:** Google share vs Yandex, sanctions/payment friction, and only ~73 clicks make RU the **lowest-ROI language**. *Gap-filling here is not a priority; maintain, don't expand.*

### 4.5 Missing topical clusters (all languages, ranked)
1. **Price/Market Report cluster** (original research) — none today; highest authority upside.
2. **Buying-process/legal cornerstone** — fragmented; consolidate.
3. **Relocation → commercial bridge** — informational exists, commercial link missing.
4. **Neighborhood/area guides** — near-absent; strong local EEAT + long-tail.
5. **Developer authority cluster** — pages exist, no supporting reviews/context.
6. **Luxury cluster** (EN/DE) — pages scattered, not a cluster.

---

## 5. Internal Linking Strategy

**Principle:** we have ample content and ample authority — it is simply **pooled in the wrong places** (blog + PL/RU clusters) and **absent from the money pages** (developer, project, EN commercial). The strategy is redistribution, not creation.

### 5.1 Authority map
- **Authority sources (link *from*):** DE flagship blog cluster; EN high-impression informational blogs; homepage(s); PL/RU commercial clusters; top project pages (cap-st-georges).
- **Authority sinks (link *to*):** 9 EN orphan commercial pages; 2 DE orphans; 88 developer pages; ~222 project pages; 3×4 case studies; the taxes page (pos 32); the homepage.

### 5.2 Concrete linking moves (report only — build in execution weeks)
1. **EN orphan rescue:** add each of the 9 EN orphans to the related-blocks of 3–5 topically matched EN pages + link from the relevant EN blog. *(Mirror the exact method used for PL/RU.)*
2. **DE parity:** inbound links to strandimmobilien-paphos & off-plan-immobilien-zypern from DE Paphos/investment/off-plan pages.
3. **EN clusters:** build Limassol and Paphos landing↔landing clusters (hub↔spoke), replicating the PL/RU pattern that already verified clean.
4. **Blog→commercial:**
   - EN: best-areas-to-live / how-to-move-from-uk → houses-in-cyprus, apartments-limassol, off-plan; VAT/taxes → investment/buy-to-let.
   - DE: auswandern / wo-leben → DE Limassol/Paphos commercial + luxury; Mieteinnahmen → renditeimmobilien.
5. **Developer support:** every project links to its developer page; every developer page lists its projects; add a "Developers" entry to city pages. This activates 88 + 222 near-orphans in one structural pass.
6. **Project inbound:** surface top projects from their city/type landing sliders (already partial) *and* from matching blogs/case studies.
7. **Case-study integration:** relocation case study → relocation commercial + blog; investor case study → investment/Limassol; luxury-villa case study → luxury/Paphos.
8. **Homepage:** ensure the homepage links to the top commercial hubs per language (Limassol/Paphos, off-plan, luxury, investment) to pass brand authority downward.

### 5.3 Dead-end elimination
- Case studies (3×4), most developer pages, most project pages, and the EN orphans are current dead ends (few in/out links). Target: **no commercial or transactional page with zero inbound internal links** by end of Month 2.

**Rule of engagement:** all internal-link work is content/data-only, reversible, verified (renders + 200 + no draft/redirect targets) — never modify code or templates.

---

## 6. Existing Content Improvement Plan

> Improve before you create. For each, the *how*.

1. **The 5 CTR pages** *(4 applied 2026-07-07)* — titles/metas rewritten for query-intent match; `taxes-on-real-estate` held for depth work (below). *How:* intent-matched titles, benefit hooks, drop false claims (e.g. Larnaca).
2. **`taxes-on-real-estate-in-cyprus` (pos 32):** expand to a genuine tax cornerstone (VAT, transfer fees, stamp duty, CGT, rental income, exemptions, worked examples), add FAQ schema, interlink the whole tax cluster, add named-advisor attribution (EEAT). *Goal: p32 → p1.*
3. **Homepage `/`:** rewrite title/H1/intro to a clear value proposition ("New-build property in Cyprus, direct from developers, no commission"), add links to top hubs, ensure crawlable primary nav. *Goal: p28 → top 10.*
4. **EN commercial pages (off-plan, houses):** add depth (districts, price bands, process), FAQ, internal links, no-commission + remote-purchase blocks. *Goal: convert impressions + leads.*
5. **DE flagship cluster:** freshness pass (updated stats/year), add new internal links to DE commercial, add author/expertise. *Goal: defend + extend.*
6. **Project pages (top 20):** richer copy, unit tables, developer link, Product/Breadcrumb schema, gallery alt text, CTA. *Goal: p2 → p1 for project-name + "cyprus new development" queries.*
7. **Developer pages:** add delivered-project counts, credibility copy, project links, Organization schema. *Goal: own "[developer] cyprus".*
8. **Comparison blog cluster:** upgrade content + CTR + FAQ schema (Cyprus vs Spain/Portugal/North). *Goal: featured snippets.*
9. **Duplicate-FAQ/CTA audit (older EN/DE):** differentiate boilerplate to reduce thin-content risk. *Goal: topical clarity.*
10. **Media/structured data:** descriptive alt + filenames + next-gen images across templates; ensure FAQPage/Article/Product where applicable.

---

## 7. EEAT Strategy

Real estate is **YMYL** (money + legal). Google demands demonstrable Experience, Expertise, Authoritativeness, Trust. We have raw materials competitors lack — proprietary data and real transactions.

**Flagship: Original research**
- **Quarterly Cyprus Property Price Report** (EN + DE) built from our pricelist/inventory data: median €/m² by city & type, off-plan vs resale, developer activity, YoY trends. *This is the single best EEAT/link/Discover asset available to us.* Gate a data summary as a downloadable PDF (lead magnet).
- **Neighborhood price snapshots** (Limassol/Paphos districts) derived from the same data.

**Trust & experience**
- **Case studies / real client stories** — extend the 3 we have (add outcomes, numbers, photos); link them into commercial pages; add Review/Article schema.
- **Client testimonials & verified reviews** with Review schema and named/attributed sources.
- **Developer reviews & profiles** — turn 88 pages into credibility assets (track record, delivered units, on-time delivery).

**Expertise & authority**
- **Named experts** with bios/credentials as content authors (especially on tax/legal/relocation YMYL pages); consistent author entities.
- **Legal/tax content reviewed by a named advisor** (attribution + "reviewed by").
- **Expert commentary / interviews** (developers, lawyers, tax advisors) embedded in guides.
- **Market reports & statistics** — the price report plus periodic "State of the Cyprus property market" commentary.

**Resources (links + leads)**
- **Downloadable buyer checklists**, **cost calculators** (purchase-cost, rental-yield, VAT), **relocation guides** — link magnets that also capture leads.

**Sequencing:** ship the **Price Report v1** early (Month 2) as the anchor; layer testimonials/reviews/author entities alongside; developer reviews and neighborhood guides as an ongoing program.

---

## 8. Technical SEO Roadmap (ranked by impact)

| Rank | Item | Impact | Notes / action |
|---|---|---|---|
| 1 | **EN migration equity** | **H** | Audit `/en/…`→no-prefix redirects (all 301, no chains); confirm no index split; verify canonicals/hreflang point to the *live* no-prefix URL; monitor re-indexing in GSC. **Biggest lever/risk.** |
| 2 | **Redirect chains / legacy 308s** | M-H | Replace flat internal links that 308→nested canonical with direct canonical links; eliminate multi-hop chains. |
| 3 | **Broken links / 404 sweep** | M | Full crawl; fix or redirect; confirm the RU-footer-type issues don't recur in other langs. |
| 4 | **Canonical correctness** | M | Self-referential per language; ensure no cross-language or `/en/`-vs-no-prefix canonical conflicts. |
| 5 | **Hreflang reciprocity** | M | Verify de/en/pl/ru clusters reciprocate on *legacy* pages (new pages verified). |
| 6 | **Schema coverage** | M | Article (blog), Product/Offer + Breadcrumb (projects), FAQPage (guides), Organization + Review (trust). Sweep for gaps. |
| 7 | **Sitemaps** | M | Confirm PUBLISHED-only, per-type, all languages; add **Image sitemap**; consider a News/Report section for the price report. |
| 8 | **Image SEO** | M | Descriptive alt + filenames, next-gen formats, dimensions; property = image-search upside. |
| 9 | **Core Web Vitals** | M | **Measure first** (field + lab) on blog/landing/project templates; fix LCP/CLS/INP regressions. |
| 10 | **Index bloat** | M | Consolidate ultra-niche EN pages (near-golf/schools/city-centre) if impressionless; protect crawl budget & quality signals. |
| 11 | **Robots / crawl** | L-M | Confirm no accidental disallows on commercial/project/developer paths; check faceted/pagination handling. |
| 12 | **Pagination / duplicate** | L-M | Ensure project listing pagination isn't creating thin/duplicate index entries; canonical or noindex as appropriate. |
| 13 | **JS rendering** | L-M | Confirm Google renders key content/links server-side (Next.js SSR/ISR) — spot-check rendered HTML for commercial links. |

---

## 9. Conversion Optimization Roadmap

Conversion work that *also* helps SEO (dwell time, engagement, return visits, brand queries):

1. **CTA strategy** — a clear primary CTA above the fold on commercial + project pages ("Request a selection", "Book a viewing"); lighter contextual CTA on top info-intent blogs (wo-leben, best-areas) to convert their large traffic.
2. **No-commission messaging** — propagate the differentiator to *all* commercial + project pages (currently strong only on new pages).
3. **Remote-purchase reassurance** — "buy entirely from abroad" block on project/city pages (critical for DACH/UK/PL distance buyers).
4. **Buying-process explainer** — the "your path to ownership" step block on project pages; links to the buying-guide cornerstone.
5. **Developer credibility** — track record, delivered units, guarantees on developer + project pages.
6. **Testimonials / verified reviews** — with schema; near forms and on commercial pages.
7. **Comparison blocks** — "why buy new-build / why Cyprus / why direct" comparison modules on commercial pages.
8. **FAQ positioning** — surface FAQs mid-page (answers pre-empt objections + earn snippets).
9. **Lead forms** — reduce friction, confirm consent links correct in all 4 languages (RU fixed), add progress/reassurance microcopy.
10. **Authority blocks** — awards, transaction volume, years active, partner developers.

---

## 10. Six-Month SEO Roadmap

**Overarching arc:** *Fix leaks → flow authority → capture demand → build durable authority → measure & compound.*

### Month 1 — Capture & stabilise (why: fastest ROI + protect recovery)
Convert existing page-1 impressions to clicks (CTR), resolve migration equity risk, and start authority flow. Nothing here needs new content — it's the highest ROI on the site and de-risks everything after.
- CTR sweep (all langs), EN orphan + DE orphan linking, EN migration/redirect audit, 404 crawl, developer→project link pass (start).

### Month 2 — Funnels & clusters (why: turn informational traffic into leads)
Build the blog→commercial funnels (EN especially) and the EN landing clusters; ship **Price Report v1** as the EEAT anchor.
- EN Limassol/Paphos clusters, blog→commercial bridges (EN/DE), case-study integration, Price Report v1, tax cornerstone deepening.

### Month 3 — Transactional authority (why: activate the largest orphan pool)
Systematically upgrade developer + project pages (schema, copy, links) — the biggest untapped, highest-intent asset base.
- Developer reviews/schema, top-20 project upgrades, project↔developer↔city linking complete, buying-guide cornerstone per priority language.

### Month 4 — EEAT & depth (why: durable rankings on YMYL + luxury)
Author entities, legal/tax review attribution, luxury cluster, neighborhood guides program, testimonials/reviews.
- EN/DE luxury cluster, neighborhood guides (Limassol/Paphos), author/expert entities, review schema, relocation cornerstone.

### Month 5 — Technical depth & discovery (why: unlock rich results, Discover, images/video)
Schema completeness, image/video SEO, CWV fixes, Discover optimisation, Price Report v2.
- Schema sweep finish, Image sitemap + alt program, CWV fixes, Discover/large-image optimisation, first project video pilots.

### Month 6 — Consolidate, measure, compound (why: prove impact, reallocate)
Full GSC before/after per language, prune/consolidate low-value pages, double down on what moved, plan the next half.
- Performance review, index-bloat consolidation, refresh cycle, next-6-month plan.

---

## 11. Week-by-Week Execution Plan (Weeks 1–24)

> Each week: **Objectives · Tasks · Outputs · SEO impact · Business impact · Dependencies · Risk.** All publish-facing work is reviewed before shipping. Weeks 1–2 partly executed (CTR fixes done 2026-07-07).

### Month 1
**W1 — CTR + baseline**
- *Obj:* convert page-1 impressions to clicks; establish baselines.
- *Tasks:* finish CTR rewrites (done for 4 EN; extend to next-tier all-lang), pull GSC baselines.
- *Outputs:* updated titles/metas; baseline snapshot. *SEO:* H (fast clicks). *Biz:* M. *Dep:* none. *Risk:* Low.

**W2 — Orphan rescue (DE + EN start)**
- *Obj:* end zero-inbound on core commercial pages.
- *Tasks:* DE 2-orphan cluster; EN 9-orphan linking (part 1).
- *Outputs:* inbound links verified. *SEO:* H. *Biz:* H. *Dep:* none. *Risk:* Low.

**W3 — Migration/technical de-risk**
- *Obj:* protect recovery.
- *Tasks:* EN `/en/`→no-prefix redirect audit, redirect-chain/308 fixes, 404 crawl.
- *Outputs:* clean redirect map; issue list closed. *SEO:* H. *Biz:* M. *Dep:* crawl access. *Risk:* Med (changes to redirects — review carefully).

**W4 — Developer/project linking (pass 1) + blog→commercial (EN)**
- *Obj:* activate transactional orphans; route informational traffic.
- *Tasks:* project↔developer links (top developers), EN relocation/tax blogs → commercial.
- *Outputs:* link pass verified. *SEO:* M-H. *Biz:* H. *Dep:* W2. *Risk:* Low.

### Month 2
**W5 — EN clusters (Limassol/Paphos)**
- *Obj:* give EN the cluster structure PL/RU already have. *Outputs:* hub↔spoke verified. *SEO:* H. *Biz:* H. *Dep:* W2. *Risk:* Low.

**W6 — Price Report v1 (build)**
- *Obj:* flagship EEAT/original-research asset. *Tasks:* extract data, design report page + PDF, schema. *Outputs:* published report (after review). *SEO:* H (links/authority). *Biz:* H (leads). *Dep:* data access. *Risk:* Med (accuracy — review data).

**W7 — Tax cornerstone + DE funnel**
- *Obj:* p32 taxes → p1; reinforce DE. *Outputs:* deepened page + tax cluster links; DE blog→commercial. *SEO:* H. *Biz:* M. *Dep:* none. *Risk:* Low (YMYL accuracy).

**W8 — Case-study integration + comparison upgrade**
- *Obj:* de-orphan case studies; win comparison snippets. *Outputs:* links + FAQ schema. *SEO:* M. *Biz:* M. *Dep:* none. *Risk:* Low.

### Month 3
**W9 — Developer reviews/schema** — *SEO:* M *Biz:* H *Risk:* Low.
**W10 — Top-20 project upgrades (part 1)** — copy/schema/links. *Biz:* H *Risk:* Low.
**W11 — Project upgrades (part 2) + buying-guide cornerstone (EN/DE)** — *SEO:* H *Biz:* M.
**W12 — Month-1–3 review + reprioritise** — GSC compare; adjust.

### Month 4
**W13 — Luxury cluster (EN/DE)** · **W14 — Neighborhood guides (Limassol)** · **W15 — Neighborhood guides (Paphos) + author entities** · **W16 — Testimonials/reviews + relocation cornerstone.**
*SEO:* M-H, *Biz:* H, *Risk:* Low-Med (new content → validate keywords + review).

### Month 5
**W17 — Schema sweep** · **W18 — Image SEO + Image sitemap** · **W19 — CWV fixes** · **W20 — Discover optimisation + Price Report v2.**
*SEO:* M, *Biz:* M, *Risk:* Low-Med (CWV requires measurement first).

### Month 6
**W21 — Video pilots (top projects)** · **W22 — Index-bloat consolidation + refresh cycle** · **W23 — Full performance review (per language)** · **W24 — Next-6-month plan + documentation update.**
*SEO:* M, *Biz:* M, *Risk:* Low.

---

## 12. Quick Wins — next 30 days (ranked by ROI)

1. **CTR title/meta rewrites** — *(4 EN done 2026-07-07)*; extend to the next tier of page-1, sub-2%-CTR pages in all languages. **ROI: very high.**
2. **EN 9-orphan + DE 2-orphan internal linking** — unlocks pages that currently can't rank. **ROI: very high.**
3. **EN blog→commercial bridges** (relocation + tax blogs) — routes thousands of impressions to money pages. **ROI: very high.**
4. **Developer→project link pass** (top developers first) — activates high-intent brand-query pages. **ROI: high.**
5. **404/redirect-chain crawl + EN migration redirect check** — stops equity leaks. **ROI: high.**
6. **Tax page depth + FAQ schema** — 2,400 impr waiting at pos 32. **ROI: high.**
7. **CTA on top info-intent blogs** (wo-leben, best-areas) — convert existing traffic to leads. **ROI: high.**
8. **Case-study → commercial links** — trivial, de-orphans EEAT assets. **ROI: medium-high.**

All are content/data/link-only, reversible, and require no new pages.

---

## 13. Things We Should STOP Doing

> Critical self-review of recent work. The following are honest challenges to prior assumptions, including my own.

1. **Stop treating "more landing pages per language" as growth.** We built 6-page PL/RU clusters + hubs. They're clean and correct — but the marginal page now yields less than **fixing CTR and internal links on what exists**. The site already covers most commercial intents. *Reallocate to demand capture.*
2. **Stop expanding Russian.** ~73 clicks, Yandex share, sanctions/payment friction, and access issues make RU the **lowest-ROI language**. Maintain the cluster; do **not** build RU wave 3 or further RU pages. *Reallocate to DE + EN.*
3. **Stop building ultra-niche EN pages** (near-golf-courses, near-international-schools, near-city-centre). Low/zero impressions, low commercial value, index-bloat and thin-content risk. *Consolidate or leave; don't extend the pattern.*
4. **Stop shipping near-duplicate FAQ/CTA boilerplate.** Fast multilingual production created repetition risk. *Differentiate, don't replicate.*
5. **Stop leaving transactional pages orphaned.** Publishing 222 project + 88 developer pages without internal links wastes the site's biggest asset. *Every transactional page needs inbound links.*
6. **Stop over-crediting new-page publishing as "done."** A page live in the DB ≠ a page that ranks. *Definition of done = indexed, linked, and earning impressions/clicks.*
7. **Stop deferring the migration/technical debt.** The EN `/en/`→no-prefix transition and legacy 308s are quietly capping recovery. *Treat as P1, not "watch."*

**Where the reclaimed time goes:** CTR + internal linking + EN/DE funnels + developer/project activation + the Price Report. These move qualified traffic and leads; incremental multilingual pages largely do not.

---

## 14. Final Prioritization

> One table, sorted by ROI then start-week. SEO/Biz/Diff: L/M/H. Time is rough effort.

| Pri | Task | SEO | Biz | Diff | Time | ROI | Start Wk |
|---|---|---|---|---|---|---|---|
| P1 | CTR title/meta sweep (finish EN, extend all langs) | H | M | L | 2d | **H** | W1 |
| P1 | Link 9 EN + 2 DE orphan commercial pages | H | H | L | 1.5d | **H** | W2 |
| P1 | EN migration `/en/`→no-prefix redirect + index audit | H | H | M | 3d | **H** | W3 |
| P1 | 404 / redirect-chain / 308 crawl + fixes | M | M | M | 2d | **H** | W3 |
| P1 | EN blog → commercial funnels (relocation + tax) | H | H | L | 1d | **H** | W4 |
| P1 | Developer↔project↔city linking (activate orphans) | M | H | M | 4d | **H** | W4 |
| P1 | EN Limassol/Paphos landing clusters | H | H | M | 3d | **H** | W5 |
| P1 | Tax cornerstone depth + FAQ schema (pos 32→p1) | H | M | M | 2d | **H** | W7 |
| P1 | Quarterly Cyprus Price Report v1 (original research) | H | H | H | 5d | **H** | W6 |
| P1 | DE relocation/tax → DE commercial (extend funnel) | H | H | L | 1d | **H** | W4 |
| P2 | Developer reviews + Organization schema | M | H | M | ongoing | M | W9 |
| P2 | Top-20 project upgrades (copy/schema/links) | M | H | H | ongoing | M | W10 |
| P2 | Buying-guide cornerstone per language | H | M | M | 4d | M | W11 |
| P2 | CTA/lead-form optimisation on top blogs | L | H | L | 2d | **H** | W4 |
| P2 | Case-study integration into commercial pages | M | M | L | 1d | M | W8 |
| P2 | Homepage title/H1/intro overhaul (pos 28.9) | H | H | M | 2d | M | W7 |
| P2 | Luxury cluster (EN/DE) | M | H | M | 2d | M | W13 |
| P2 | Neighborhood guides (Limassol/Paphos) | H | H | M | ongoing | M | W14 |
| P2 | Author/expert entities + YMYL review attribution | M | M | L | 2d | M | W15 |
| P2 | Testimonials/reviews + Review schema | L | H | L | 1d | M | W16 |
| P2 | Comparison cluster upgrade + snippets | M | M | L | 2d | M | W8 |
| P2 | Duplicate FAQ/CTA audit (older EN/DE) | M | L | M | 3d | M | W8 |
| P2 | Schema coverage sweep | M | M | M | 3d | M | W17 |
| P2 | Image SEO + Image sitemap | M | M | M | ongoing | M | W18 |
| P2 | Core Web Vitals (measure → fix) | M | M | M | 2d | M | W19 |
| P2 | Hreflang reciprocity (legacy) | M | M | M | 2d | M | W17 |
| P2 | No-commission/remote-purchase/process rollout | L | H | M | ongoing | M | W10 |
| P3 | Discover optimisation (large images/reports) | M | M | M | ongoing | M | W20 |
| P3 | Video SEO (project walkthroughs) | M | H | H | ongoing | M | W21 |
| P3 | Retirement / golf-lifestyle intent pages (validated) | M | M | M | 2d | L | W13+ |
| P3 | Index-bloat consolidation (niche EN) | M | L | L | 1d | M | W22 |
| — | **STOP:** RU expansion, new niche EN pages, duplicate boilerplate | — | — | — | — | — | — |

---

### Appendix — verify before Month 1
- **[verify]** Exact category/parent-page counts per language and their internal-link status.
- **[verify]** Developer-page indexability (indexed? in sitemap?) and current inbound links.
- **[measure]** Core Web Vitals field data (CrUX/PSI) per template.
- **[measure]** Live confirmation that the 2026-07-07 CTR title edits rendered (singlepage ~60s, blogs ~1h ISR) and re-indexed in GSC.
- **[validate]** Keyword volumes for any *new* page before building it (§4 figures are directional).

*End of document.*
