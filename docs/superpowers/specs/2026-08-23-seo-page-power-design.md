# SEO Page Power — diagnosis layer

Status: design approved 2026-08-23. Implementation not started.

## Goal

Answer one question per page, continuously: **where does this page lose its
power, and what kind of work would fix it?**

The business goal behind it is more organic leads that are worth having. The
system does not measure lead quality directly — see "The CRM is not a scoring
basis" below — so it optimises the last measurable stage before a lead, and
treats leads themselves as slow confirmation.

## What the data said

Everything below was measured against production on 2026-08-23, 90-day windows.
These numbers are the basis for every threshold in this spec; re-measure before
changing one.

| | |
|---|---|
| Impressions (GSC, 90d) | 148,618 |
| Clicks | 1,868 → **CTR 1.26 %** |
| Unique visitors (daily-rotating hash) | 3,853 |
| Sessions seeing 2+ different project pages | **282** |
| Leads from the website | ~26 in 19 months |

Position distribution, and it is the finding that shaped the design:

```
Position    pages   median CTR   impressions
  3–5          14       2.78 %         7,910
  5–10        204       1.32 %        37,774
 10–20        123       0.90 %        26,378
 20–40         95       0.23 %        35,150
 40–100+       83       0.00 %        33,187
```

**No page averages better than position 3, and 49 % of all impressions sit at
position 20 or worse**, where CTR is effectively zero. A ranking problem and a
copy problem look identical in a CTR column and need completely different work,
so they get separate diagnoses.

## Target metric: the comparison session

**A session that views two or more *different* project pages.** 282 per quarter.

Chosen over "5+ pageviews" (421 per quarter) after measuring both:

- 115 of the 421 saw **no project page at all** — blog readers, not buyers.
  Optimising for them would push the system toward blog output.
- 73 sessions viewed 2+ project pages in **fewer than 5 pageviews** — someone
  comparing two properties and leaving. That is buying behaviour, and the
  depth threshold misses it.

Comparing two properties is what a buyer does; reading five articles is what a
researcher does. The metric encodes that rather than a round number.

### Known limit of this metric

`PageView.visitorHash` is a **daily-rotating** cookieless hash. So:

- A "session" is really *visitor-per-day*. Multi-day research counts multiple
  times.
- **Returning visitors are invisible**, and a return visit to the same property
  is one of the strongest buying signals there is.

This is deliberate in the analytics design (no PII) and this spec does not
change it. It is a ceiling on what the system can ever see, not a bug to fix
later.

## The CRM is not a scoring basis

Decided with the operator, 2026-08-23. `Lead.pageSource` and `createdAt` are
trustworthy and are used for attribution — which pages produce leads, and when.
`Lead.status` is not: across 179 leads since January 2025 exactly one reached
`CLOSED`, none ever reached `VIEWING_SCHEDULED` or `OFFER`, and 148 of 179 were
entered manually. Whatever that reflects, it cannot carry an optimisation
target. No diagnosis reads lead status.

## The five diagnoses

Each page gets **exactly one** diagnosis: the earliest funnel stage at which it
fails. A page with no impressions never receives a CTR judgement.

Diagnoses 1–3 are **per page** — GSC has the volume for it. Diagnoses 4–5 are
**per page class** (`templateClass.ts`) — only 5 pages have ≥30 clicks in 90
days, so per-page landing analysis is not possible and pretending otherwise
would manufacture noise.

### Per page

**1 · invisible** — in the published inventory, fewer than 10 impressions in 90
days.
*Work: indexing, internal links, or the page has no subject anyone searches for.*

**2 · buried** — ≥100 impressions, average position worse than 20.
*Work: content depth, authority, internal linking.*
**Today: 90 pages, 67,344 impressions. The dominant pile.**

This pile is not a long tail of forgettable pages. Eight of the nine commercial
city/type landing pages are in it:

```
off-plan-properties-in-paphos     5,078 impr    8 clicks   0.16 %   pos 33.2
villas-in-cyprus                  2,270 impr   29 clicks   1.28 %   pos 39.9
properties-paphos                 1,903 impr   39 clicks   2.05 %   pos 27.5
off-plan-properties-in-limassol   1,660 impr    6 clicks   0.36 %   pos 47.2
property-for-sale-limassol          944 impr    2 clicks   0.21 %   pos 51.1
investment-property-in-cyprus       473 impr    3 clicks   0.63 %   pos 45.4
apartments-in-cyprus                410 impr   13 clicks   3.17 %   pos 32.0
property-for-sale-larnaca           294 impr    2 clicks   0.68 %   pos 40.2
luxury-villas-in-cyprus-over-1M     659 impr   18 clicks   2.73 %   pos 14.9   (healthy)
```

Google serves "off-plan properties in Paphos" 5,078 times a quarter on page
four. No title rewrite reaches a click from position 33. The commercial keyword
strategy is inside diagnosis 2, which is why it ships in the first release
rather than being deferred as the unpleasant pile.

**3 · unclicked** — ≥300 impressions, average position 20 or better, CTR below
**half the median of its own position bucket**. Buckets are position 0–5, 5–10
and 10–20; a bucket median is only computed when at least 5 pages with ≥100
impressions fall into it, otherwise pages in that bucket stay unjudged.
*Work: title and meta description — the existing title-sweep tooling applies.*
**Today: 12 pages, 13,759 impressions, out of 58 candidates.**

A page that clears all three thresholds is **healthy** and carries no diagnosis.
Healthy and unjudged are distinct states and must be shown as such.

The 300-impression floor is not cosmetic. At 30 impressions and a 1.3 % expected
CTR you cannot distinguish 0 % from normal; a loose floor produced 166 "findings"
that were mostly noise with decimal places.

Bucket medians are computed **from this site's own pages**, not an industry
curve. An external table would claim position 5 owes 6 % and declare 200 pages
broken.

### Per page class

Measured on **sessions**, not clicks. Click data is too thin even per class
(5 pages above 30 clicks); session data is not (3,853 sessions in 90 days).

**4 · repelling** — of the sessions that *entered* the site on this class, the
share that became comparison sessions is below **half the rate of the best
performing class**. Floor: ≥100 entering sessions in the window, otherwise
unjudged.
*Work: landing layout, internal routes to further properties.*

**5 · mute** — sessions that ENTERED on this class and went on to compare two or
more properties produce no lead attributed to a page of this class. Floor: ≥50
such sessions in the window, otherwise unjudged.
*Work: offer, call to action, contact path.*

This says "entered on", not "involving", and the difference is not cosmetic. A
comparison session is *defined* as one viewing two or more different Development
pages — so "comparison sessions involving development-page" is identically equal
to the site-wide total, for every window, forever. The floor would be meaningless
for exactly the class that matters most, and homepage and projects-listing are
near-degenerate for the same navigational reason. Scoping by entry page also
keeps entering sessions, comparison sessions and the rate between them one
arithmetically consistent triple, so the per-class expectations sum to the site
total instead of several times it.

The cost, recorded rather than fixed: the two halves are differently scoped. A
class's lead count is leads whose *form page* belonged to it, while its expected
lead count is built from sessions that *entered* on it. A class hosting most of
the enquiry forms but receiving few entries is measured against a mismatched
expectation.

A second limitation, inherent to the data: `PageView` and `Lead` share no session
key, so a lead can never be traced to the journey that produced it. A lead is
credited to whichever class hosted the form — the blog post that began the
research and the development page that closed it both count as the development
page. Read the figure as "enquiries sent from this class", never as "enquiries
this class earned".

Diagnosis 5 **cannot fire at all today**, and that is the honest output rather
than a gap. At ~4 page-attributable leads per 90-day window across five classes,
zero leads is the *expected* result for a perfectly healthy class — under a
Poisson null, P(zero) is 45% at λ=0.8. A rule that fired on zero would fire on
every class while carrying no information at all.

So the implementation requires the class to have been expected to produce at
least three leads before silence counts as evidence (e⁻³ ≈ 5%, the point where
silence is surprising). Because a class's expected leads can never exceed the
site's page-attributable total, this means diagnosis 5 stays dormant until at
least three such leads land in one window. It becomes reachable on its own as
volume grows, with no threshold to edit.

`BookingRequest` (4 rows since July 2026) has the right shape to replace the lead
signal here once it has history — revisit when it does.

## Data flow

**Canonicalise first, always.** `buildCanonicalMap()` / `canonicalize()` from
`src/lib/seo/urlCanonical.ts` is applied to `SearchMetric.page`,
`PageView.path`, and `Lead.pageSource` (the last also needs its origin and
query string stripped) before anything is compared.

Without it the join loses 22 % of clicks, including the site's single
strongest page: `/blog/wo-leben-die-meisten-deutschen-auf-zypern`, 194 clicks,
which 301s to its `/de/` equivalent. That module was written for exactly this
incident — reuse it, do not re-derive it.

**The page inventory comes from the CMS, not from GSC.** Required for diagnosis
1: a page with zero impressions has no `SearchMetric` row at all. GSC supplies
measurements onto that universe, never the universe itself.

The universe is published Developments, Projects, Blogs, Singlepages, Case
Studies and Developer pages × their locales, plus the fixed pages the sitemap
emits by hand (homepage, `/faq`, `/partners`).

That list is longer than the one this spec first carried, and the two additions
were found by code review during implementation rather than by design:

- **Developer pages were missing entirely** — 14,315 impressions and 153 clicks
  in 90 days, roughly a tenth of the site's whole search surface. One of them,
  `/developers/agg-luxury-homes` at 1,497 impressions, already appears in the
  measured `unclicked` list earlier in this document. It was visible in the data
  the whole time and still went unnoticed when the inventory was scoped.
- **Nested Singlepages were being built at the wrong URL.** `Singlepage` rows
  carry `parentSanityId`, and the served URL is the full parent chain. The first
  implementation used the leaf slug alone, which does not exist as far as Google
  is concerned:

```
flat    /de/villen-in-paphos                            0 impressions
nested  /de/luxusvillen-in-zypern/villen-in-paphos    535 impressions
```

  About 25 pages across the four locales are nested, and they are the commercial
  ones — `villas-in-cyprus/villas-in-paphos`,
  `apartments-in-cyprus/apartments-in-paphos`. Every one would have been
  diagnosed "invisible" while ranking perfectly well.

Development pages are included only while `NEW_PROJECTS_INDEXABLE`
(`src/lib/developmentSeo.ts`) is true; when it is false they are not public SEO
surface and must not be judged as such.

**Window: 90 days, excluding the most recent 3.** A 28-day window leaves only 46
pages above 300 impressions — too thin to judge CTR (90 days gives 129). Shorter
is not faster, it is wronger. GSC lags two to three days; without the exclusion
every page looks like it collapsed at the start of a month.

**A 28-day trend arrow** sits beside each page on the admin screen — impressions,
position and CTR against the preceding 28 days. It is **not** a diagnosis and
raises **no** alert: `actionCenter/rules/seo.ts` already reports week-over-week
ranking drops, and two systems shouting the same thing is worse than one. The
arrow exists so someone working a pile can see whether a change is taking hold.

The honest re-measure horizon after a change is **four weeks** — the same horizon
the existing title sweep already assumes.

## Where it surfaces

**Action Center — five items, not ninety.** One item per diagnosis, carrying the
count, the impressions behind it, and the three largest examples. Severity is
ranked by impressions at stake, not page count. Ninety individual items would
bury the existing CRM and SEO rules.

**`/admin/analytics/seo/power`** — the full table, filterable by diagnosis,
sorted by impressions. This is where someone works through a pile.

**The weekly advisor** receives the diagnosis summary as input, so it discusses
named piles instead of raw metrics.

## Noise control

**"Not enough data" is its own state**, not a diagnosis. A page below its floor
is carried as *unjudged* and never appears as a problem. Without this, 1,400
pages look healthy when they are merely unmeasured.

**Stable item IDs** following `staleCopyFigures`: diagnosis plus page key. If a
page's diagnosis changes it becomes a new item, so an old snooze cannot hide a
new problem.

**Coverage ratio is a visible metric.** The share of GSC clicks that resolve
through canonicalisation is shown on the admin page. If it drops, new redirects
exist that the map does not know — that is itself an alarm.

## Verification

There is no test runner in this repo. As with `staleCopyFigures`:

1. **Invariants against live data** — every page has exactly one diagnosis or is
   unjudged; totals reconcile; coverage above 85 %.
2. **Manual calibration pass** — read the ten largest entries of each diagnosis
   and confirm each is real. This is the step that caught `abiete-2` (a project
   named "Abiete 2", read as a count) and velaro-homes' furniture package. Below
   80 % precision, thresholds are retuned before anything ships.
3. **Only then** enable the Action Center rule.

Calibration requires the production DB tunnel on `localhost:5433`.

## Deliberately excluded

- **No composite score.** "SEO Power: 43" hides which work is outstanding and
  invites optimising the number.
- **No automated content changes.** The system diagnoses; people decide.
- **No third-party keyword data (DataForSEO) in this phase.** The
  `src/lib/seo-sources/dataforseo.ts` stub stays a stub. Keyword research finds
  demand you do not have; this phase is about the demand you already have and
  do not convert. Revisit once the diagnosis mix is known.
- **No per-page experiments beyond titles.** At ~1.4 website leads per month,
  only CTR has the volume for an experiment to conclude.

## Follow-on phases (not this spec)

- **Metrics warehouse** — a rollup fact table for trend questions ("is it
  getting better?"), once the diagnoses tell us which metrics are worth
  freezing. Note that history is young: SearchMetric from 2026-04-15, PageView
  from 2026-06-18, so trends start now rather than reaching back.
- **Experiment loop** — generalise the title sweep once the diagnosis mix shows
  what is worth testing.
