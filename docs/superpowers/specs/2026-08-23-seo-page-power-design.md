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

**5 · mute** — comparison sessions involving this class produce no lead
attributed to a page of this class. Floor: ≥50 comparison sessions for the
class in the window, otherwise unjudged.
*Work: offer, call to action, contact path.*

Diagnosis 5 will read **unjudged for most classes at first**, and that is the
honest output: ~26 website leads in 19 months cannot support a per-class verdict
yet. It becomes meaningful as volume accumulates. `BookingRequest` (4 rows since
July 2026) has the right shape to replace the lead signal here once it has
history — revisit when it does.

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
1: a page with zero impressions has no `SearchMetric` row at all. The universe
is published Developments, Projects, Blogs and Singlepages × their locales; GSC
supplies measurements onto that universe.

**Window: 90 days, excluding the most recent 3.** A 28-day window leaves only 46
pages above 300 impressions — too thin to judge CTR. GSC lags two to three days;
without the exclusion every page looks like it collapsed at the start of a month.

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
