# SEO Page Power Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every published page exactly one diagnosis — where it loses its
search power and what kind of work would fix it — recomputed nightly and
surfaced in the Action Center and a dedicated admin screen.

**Architecture:** Pure functions over existing tables. No migration, no new
model. `src/lib/seo/pagePower/` computes verdicts from `SearchMetric`,
`PageView`, `Lead` and the CMS inventory, joined through the existing
redirect-aware canonicaliser. Same shape as `src/lib/seo/staleCopyFigures.ts`,
which was built this way and works.

**Tech Stack:** TypeScript, Next.js App Router (server components), Prisma,
Postgres. Existing modules reused: `src/lib/seo/urlCanonical.ts`,
`src/lib/seo/templateClass.ts`, `src/lib/gsc/client.ts`,
`src/lib/actionCenter/`.

**Spec:** `docs/superpowers/specs/2026-08-23-seo-page-power-design.md` — read it
first. Every threshold below comes from measurements recorded there.

---

## Verification model — read this before Task 1

**This repo has no test runner.** Do not add one; do not write `*.test.ts`.
The established convention (see `docs/superpowers/plans/2026-08-19-factsheet-pdf.md`)
is:

1. Every task ends with `npx tsc --noEmit`, which must stay clean.
2. Behaviour against live data is verified in Task 5 through a **temporary**
   probe route that is created and deleted inside that task. TypeScript modules
   cannot be imported from a plain `.mjs` script, so a route is the only way to
   exercise the real module rather than a re-implementation of it. A
   re-implementation would verify the copy, not the code.
3. Task 6 is a manual calibration gate with a hard pass criterion. Nothing
   surfaces to users before it passes.

**The production DB tunnel on `localhost:5433` must be open for Tasks 5 and 6.**
`.env.local` in the repo root points at production. Every query in this plan is
read-only. Do not write.

**Working directory:** all paths are relative to the repo root.

---

## File structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/seo/pagePower/types.ts` | Verdict types and every threshold constant. No logic. |
| `src/lib/seo/pagePower/inventory.ts` | The page universe from the CMS: published Developments, Projects, Blogs, Singlepages × locales → canonical paths. |
| `src/lib/seo/pagePower/pageVerdicts.ts` | Diagnoses 1–3 per page, from `SearchMetric` + inventory. |
| `src/lib/seo/pagePower/classVerdicts.ts` | Diagnoses 4–5 per template class, from `PageView` + `Lead`. |
| `src/lib/actionCenter/rules/pagePower.ts` | Grouped Action Center items: one per diagnosis, one per flagged template class. |
| `src/app/admin/(panel)/analytics/seo/power/page.tsx` | Admin screen (server component). |
| `src/app/admin/(panel)/analytics/seo/power/PagePowerTable.tsx` | Filter/sort table (client component). |

**Modify:**

| File | Change |
|---|---|
| `src/lib/actionCenter/index.ts:5,26` | Import and call `pagePowerRules()`. |
| `src/lib/seoAdvisor/gather.ts:66,282` | Add `pagePower` to `AdvisorPayload` and populate it. |
| `src/lib/seoAdvisor/analyze.ts:20,22` | Tell the ANALYZE step to read `reason`, not the diagnosis label. |

The directory split mirrors `src/lib/seoAdvisor/` (gather/analyze/deliver/types),
the existing precedent in this codebase for a multi-file lib module.

---

## Task 1: Types and thresholds

**Files:**
- Create: `src/lib/seo/pagePower/types.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { Locale } from "@prisma/client";
import type { TemplateClass } from "@/lib/seo/templateClass";

// Every number here was measured against production on 2026-08-23 — see
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md. Re-measure before
// changing one; they are not preferences.

/** 90 days. A 28-day window leaves only 46 pages above 300 impressions — too
 *  thin to judge CTR, where 90 days gives 129. Shorter is not faster, it is
 *  wronger. */
export const WINDOW_DAYS = 90;

/** GSC lags two to three days. Without excluding them, every page looks like it
 *  collapsed at the start of a month. */
export const GSC_LAG_DAYS = 3;

/** Feedback only — the trend arrow on the admin screen. Never a diagnosis and
 *  never an alert: actionCenter/rules/seo.ts already reports week-over-week
 *  ranking drops. */
export const TREND_WINDOW_DAYS = 28;

/** Minimum impressions in the PRIOR 28-day window before a trend percentage is
 *  computed at all. It exists because MIN_IMPRESSIONS_VISIBLE is a 90-day
 *  visibility floor and means nothing as the denominator of a 28-day ratio: at
 *  a prior of 10, three recent impressions render a confident "−70%" that is
 *  entirely sampling noise.
 *
 *  100 because the relative standard error on a count is roughly 1/sqrt(n), so
 *  a prior of 100 carries about 10% noise and the ±20–30% swings this arrow is
 *  meant to communicate sit clearly outside it; at 30 the noise is ~18% and the
 *  arrow reports variance as a trend. Independently derived from, and only
 *  coincidentally equal to, MIN_IMPRESSIONS_BURIED and MIN_BUCKET_IMPRESSIONS
 *  below — re-measuring any one of the three is not license to update the
 *  others. */
export const MIN_IMPRESSIONS_TREND = 100;

export const MIN_IMPRESSIONS_VISIBLE = 10;

/** Page-level eligibility floor for the `buried` diagnosis — independently
 *  derived from, and only coincidentally equal to, MIN_BUCKET_IMPRESSIONS
 *  below (that one is a bucket-level sample-size floor for a valid CTR
 *  median). Re-measuring one is not license to update the other. */
export const MIN_IMPRESSIONS_BURIED = 100;

/** At 30 impressions and a ~1.3% expected CTR you cannot distinguish 0% from
 *  normal. A loose floor produced 166 "findings" that were mostly noise with
 *  decimal places; 300 produces 12 real ones. */
export const MIN_IMPRESSIONS_CTR = 300;

export const BURIED_POSITION = 20;

/** A page is flagged `unclicked` when its CTR is below this fraction of the
 *  MEDIAN CTR of its own position bucket. Half was chosen because it is far
 *  enough below typical that noise cannot explain it at the 300-impression
 *  floor, and it produced 12 findings against 58 candidates when measured on
 *  2026-08-23 — a workable list rather than a wall. */
export const CTR_MEDIAN_FRACTION = 0.5;

/** Bucket medians come from this site's own pages. An industry curve would
 *  claim position 5 owes 6% and declare 200 pages broken.
 *
 *  Half-open, low-inclusive: `[lo, hi)` — a bucket owns its low boundary but
 *  not its high one. `pageVerdicts.ts` implements this as
 *  `position >= low && position < high`. The buckets share the values 5 and
 *  10, and an impression-weighted average lands exactly on them often enough
 *  to matter. */
export const POSITION_BUCKETS: ReadonlyArray<readonly [number, number]> = [
  [0, 5],
  [5, 10],
  [10, 20],
];

/** Comparable pages a position band needs before its median CTR may be used as
 *  a bar. It sat bare for four rounds; the note is here because the band it
 *  gates is the one a reader will want to lower it for.
 *
 *  Measured against production on 2026-08-23: the 0-5 band holds 177 pages and
 *  only 3 of them clear MIN_BUCKET_IMPRESSIONS, so the band sets no bar and
 *  every page in it is reported `unjudged` on CTR — including the site's
 *  highest-impression page, 7,018 impressions at position 3.5. That is not a
 *  shortage that fills in with time: this site rarely ranks top-five on queries
 *  carrying volume, so its best-ranking pages are structurally unjudgeable.
 *
 *  Do NOT lower it to make them judgeable. A median drawn from three samples is
 *  an unfounded verdict with a decimal point on it — the same defect as the
 *  one-onward-session `repelling` call MIN_EXPECTED_ONWARD exists to block.
 *  `pageVerdicts.ts` reports the gap instead, naming both counts in the reason
 *  so a reader can tell a thin band from a structurally empty one. */
export const MIN_BUCKET_PAGES = 5;

/** Bucket-level sample-size floor for a valid CTR median — independently
 *  derived from, and only coincidentally equal to, MIN_IMPRESSIONS_BURIED
 *  above (that one is a page-level eligibility floor for the `buried`
 *  diagnosis). Re-measuring one is not license to update the other. */
export const MIN_BUCKET_IMPRESSIONS = 100;

/** A comparison session views this many DIFFERENT property pages. Comparing two
 *  properties is what a buyer does; reading five articles is what a researcher
 *  does.
 *
 *  A PROPERTY is a published Development OR a published legacy Sanity Project,
 *  which is the whole of what `/projects/{slug}` serves. That is NOT the same
 *  set as the `development-page` template class — see `propertyOf` in
 *  classVerdicts.ts for why the two must stay apart — and reading it as the
 *  Development-only set was a real defect, not a theoretical one: measured
 *  2026-08-23, the site holds 147 published Developments against 611 published
 *  legacy Projects, and the Development-only reading found 106 comparison
 *  sessions in the window where the spec's own definition finds 276. The
 *  approved north-star figure is 282 per quarter (measured 2026-08-23 over the
 *  window ending that day — see the design spec); the property-wide definition
 *  reproduces it, the Development-only one returned 38% of it.
 *
 *  Applied at TWO scopes, which classVerdicts.ts keeps apart under two names
 *  because they are not the same number: the site-level metric counts distinct
 *  properties across the WHOLE session (the north-star figure above), while the
 *  per-class rate counts only distinct properties OTHER THAN the one the
 *  session landed on. Counting the landing property in a per-class rate compares
 *  different funnel steps across classes — see `onwardComparisonSessions`
 *  below. */
export const COMPARISON_PROJECT_PAGES = 2;
export const MIN_ENTERING_SESSIONS = 100;

/** Floor for judging LEAD production, i.e. the `mute` diagnosis. Measured on
 *  `onwardComparisonSessions`, not on the site-level metric.
 *
 *  NO LONGER DORMANT, and the correction is worth recording. This note used to
 *  read "the five classes produced onward counts of 1, 2, 14, 22 and 31, the
 *  largest is 31, so NO class reaches 50 and the `mute` branch cannot fire at
 *  all". Those counts were measured while "property" wrongly meant "Development
 *  only" (see COMPARISON_PROJECT_PAGES above), which hid most of the site's
 *  property browsing. Re-measured 2026-08-23 over the same window with the
 *  corrected definition, the counts are 9, 12, 31, 41 and 117: `other-landing-page`
 *  clears this floor almost two and a half times over, and `mute` is a verdict
 *  this module can now actually emit. It does not emit it today only because 27
 *  enquiries are traced to that class — see MUTE_MIN_EXPECTED_LEADS in
 *  classVerdicts.ts for the second precondition and the full derivation.
 *
 *  The constant is unchanged and is still NOT to be lowered. At counts below it
 *  a lead-production verdict would be a coin flip — the same defect, in a
 *  different place, as declaring a class `repelling` on a handful of onward
 *  sessions (see MIN_EXPECTED_ONWARD below). It is now the binding constraint on
 *  the second-closest class: `homepage` sits at 41. */
export const MIN_COMPARISON_SESSIONS = 50;

/** Floor under the EVIDENCE for the engagement axis, in EXPECTED onward
 *  sessions: `enteringSessions × bestRate`. MIN_ENTERING_SESSIONS bounds the
 *  DENOMINATOR of the rate; nothing bounded its numerator, so a class could
 *  clear that bar and still be judged on a handful of onward sessions — and on
 *  2026-08-23 one was: `projects-listing` was declared `repelling` on ONE.
 *
 *  Measured 2026-08-23. False-alarm rate, i.e. the chance the `repelling` test
 *  fires at a class that is genuinely performing AT the best rate:
 *
 *    expected  4 → 9.16%      expected 20 → 0.50%
 *    expected  6 → 6.20%      expected 30 → 0.09%
 *    expected 10 → 2.93%      expected 40 → 0.02%
 *
 *  and the same run's five classes, re-measured with the corrected property
 *  definition (see COMPARISON_PROJECT_PAGES) and against the benchmark the
 *  paragraph below now requires — `other-landing-page` at 8.6%:
 *
 *    homepage            expected  52.6  observed  41  false alarm 0.004%
 *    projects-listing    expected   9.3  observed  12  false alarm 4.56%
 *    development-page    expected  51.5  observed  31  false alarm 0.003%
 *    blog-post           expected  96.6  observed   9  false alarm <0.001%
 *    other-landing-page  expected 117.0  observed 117  false alarm <0.001%
 *
 *  20 bounds the false alarm at 0.5% and, on that data, gates exactly the one
 *  class that cannot support a verdict — `projects-listing`, at a 1-in-22 chance
 *  of a spurious `repelling` — while leaving the other four judgeable, each
 *  under 0.005%. Re-measure before changing it.
 *
 *  It gates the WHOLE engagement axis, not just `repelling`. A handful of onward
 *  sessions is no more evidence for `healthy` than against it, so a class below
 *  this floor is reported `unjudged` on engagement rather than certified by
 *  silence.
 *
 *  Since 2026-08-23 it also gates which class may SET the bar. Nothing did
 *  before, so a class the module refused to judge could still decide what every
 *  other class was judged against — on this window `projects-listing`, unjudged
 *  on 12 onward sessions, carried the highest rate on the site and as the
 *  benchmark turned `development-page` `repelling`. See `benchmarkClasses` in
 *  classVerdicts.ts for why the class's own onward count is the non-circular way
 *  to apply exactly this floor there. */
export const MIN_EXPECTED_ONWARD = 20;

/** A template class is flagged `repelling` when its onward-comparison rate is
 *  below this fraction of the BEST-performing class's rate. Deliberately
 *  relative to the best class, not to a site-wide average, because an average
 *  that includes the weak classes drags the bar down toward them. */
export const CLASS_RATE_FRACTION = 0.5;

export type PageDiagnosis = "invisible" | "buried" | "unclicked" | "healthy" | "unjudged";
export type ClassDiagnosis = "repelling" | "mute" | "healthy" | "unjudged";

/** `${locale}::${path}` — the join key across GSC, PageView and Lead.
 *
 *  `path` is the canonical URL path as served, NOT locale-prefix-stripped:
 *  English is prefix-less (`/projects/x`) while de/pl/ru keep their prefix
 *  (`/de/projects/x`), matching `deriveLocale` in `src/lib/gsc/client.ts`. So
 *  `locale` is partly redundant with `path` — on purpose, for a readable join
 *  key. Do NOT "clean up" the prefix out of `path`; stripping it collapses
 *  distinct locales onto the same key and breaks the join across GSC,
 *  PageView and Lead. This exact confusion cost 22% of clicks in the join
 *  before canonicalisation was applied. */
export type PageKey = string;

export const pageKey = (locale: Locale, path: string): PageKey => `${locale}::${path}`;

export type PageVerdict = {
  key: PageKey;
  locale: Locale;
  /** NOT locale-prefix-stripped — see the `PageKey` comment above. Do not
   *  "clean up" this prefix; it must stay exactly as served for the
   *  cross-table join to work. */
  path: string;
  impressions: number;
  clicks: number;
  /** percent, 0–100 */
  ctr: number;
  /** impression-weighted average; null when there are no impressions */
  position: number | null;
  diagnosis: PageDiagnosis;
  /** one sentence an admin can read without opening the code */
  reason: string;
  /** 28d vs the preceding 28d, for the admin trend arrow; null when the prior
   *  window is below MIN_IMPRESSIONS_TREND.
   *
   *  Known limitation of expressing growth as a ratio: the prior window is the
   *  denominator, so a page that went from 0 to 4,000 impressions — the single
   *  best outcome this feature can produce — yields null and shows NO ARROW AT
   *  ALL, while a page that went 400 → 380 shows one. The arrow answers "is
   *  this moving relative to where it was", which is undefined for a page that
   *  was nowhere. Do not paper over it by treating a prior of 0 as 1; that
   *  invents a +399,900% figure. If breakout pages need surfacing, that is a
   *  separate absolute-delta signal, not a repair to this one. */
  impressionsTrendPct: number | null;
};

export type ClassVerdict = {
  templateClass: TemplateClass;
  /** Sessions whose FIRST pageview was a page of this class. */
  enteringSessions: number;
  /** Sessions that entered on this class and then viewed COMPARISON_PROJECT_PAGES
   *  different PROPERTIES — Developments and legacy Projects alike, see
   *  COMPARISON_PROJECT_PAGES — OTHER THAN THE ONE THEY LANDED ON.
   *
   *  Both exclusions are load-bearing and neither may be quietly dropped: not
   *  the entry pageview, and not the entry PROPERTY. Excluding only the pageview
   *  still lets `land on x → view y → back to x` reach two on one further
   *  property, while a homepage session needs two — and returning to the
   *  property you landed on is ordinary browsing, not an edge case. Excluding
   *  the property itself makes the quantity identical across every class:
   *  two distinct properties that are not where the session started.
   *
   *  That last claim only became TRUE on 2026-08-23. While "property" meant
   *  "Development", it was not identical across classes at all: a session
   *  comparing two legacy properties scored nought and the same journey among
   *  Developments scored two, and sessions entering on a legacy property sat in
   *  `other-landing-page`'s denominator with their property browsing in no
   *  numerator — a one-directional push toward `repelling` for the class that
   *  absorbs 611 of the site's 758 property pages. The exclusion is what makes
   *  the funnel step the same; the property definition is what makes the
   *  COUNTING the same, and both are needed.
   *
   *  The site-level metric counts the entry page too, and counting it here would
   *  measure a different funnel step per class: a session entering ON a
   *  Development page needs to see only ONE further property to reach two,
   *  while a session entering on the homepage needs two. At a plausible ~0.3
   *  per-property continuation and ~0.4 homepage-to-property click-through that
   *  alone scores `development-page` ~30% against `homepage` ~12% — a ratio
   *  already under CLASS_RATE_FRACTION with IDENTICAL user behaviour. Since
   *  `development-page` would then set the bar essentially always, the artefact
   *  runs one way: manufactured `repelling` verdicts on homepage, blog-post and
   *  other-landing-page, each carrying an assertion about landing layout that
   *  the data never supported. */
  onwardComparisonSessions: number;
  /** percent of `enteringSessions` that became `onwardComparisonSessions` */
  onwardComparisonRate: number;
  /** Enquiries in the window whose `Lead.pageSource` resolves to a page of this
   *  class. NOT the enquiries this class produced, and NOT all enquiries:
   *  `pageSource` records the page the FORM sat on, so a journey spanning
   *  several classes is credited entirely to the last one, and an enquiry
   *  carrying no recoverable page is counted nowhere. Soft-deleted leads are
   *  excluded, as they are from every other lead query in this codebase.
   *
   *  How many carry no page is smaller than this comment used to say. It read
   *  "enquiries arriving by phone, WhatsApp or manual entry carry no page at all
   *  and are counted nowhere (148 of 179 leads since January 2025 were entered
   *  by hand)", which conflated source=MANUAL with having no page. Measured
   *  2026-08-23: 148 of 179 are indeed MANUAL, but 141 of the 179 carry a
   *  `pageSource` and 119 resolve to a path — the MANUAL rows are monday.com
   *  imports that kept the URL. Only 38 leads lack the field entirely.
   *
   *  Do not surface this under a bare "Leads" column — it will be read as the
   *  business's lead count, which it is not. */
  attributableLeads: number;
  diagnosis: ClassDiagnosis;
  reason: string;
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output, exit 0. (One pre-existing error in
`src/app/components/BrochureBlock/BrochureBlock.tsx` appears only when
`next-env.d.ts` is absent; if you see it, run `npx next build` once to
regenerate that file, then re-run.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/pagePower/types.ts
git commit -m "Page Power: types and measured thresholds"
```

---

## Task 2: The page inventory

The universe must come from the CMS, not from GSC. A page with zero impressions
has no `SearchMetric` row at all, so diagnosis 1 ("invisible") is impossible
without this.

Canonical URL forms, confirmed against production data on 2026-08-23: English is
**prefix-less** (`/projects/x`), every other locale carries its prefix
(`/de/projects/x`). This matches `redirect-mapping.csv`, whose 358 "EN-strip"
rows moved `/en/X` to `/X`.

**Files:**
- Create: `src/lib/seo/pagePower/inventory.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NEW_PROJECTS_INDEXABLE } from "@/lib/developmentSeo";
import { pageKey, type PageKey } from "./types";

export type InventoryPage = {
  key: PageKey;
  locale: Locale;
  /** canonical path, English without a locale prefix */
  path: string;
  kind: "development" | "project" | "blog" | "singlepage" | "developer" | "caseStudy" | "fixed";
  title: string;
  /** When this URL went live, or null when no field on the row means that.
   *
   *  Read `publishedAt` and nothing else. `createdAt` is on every one of these
   *  models and is NOT a publication date — measured 2026-08-23, the whole
   *  legacy corpus carries the SAME `createdAt` instant, 2026-06-16, because
   *  that is when the Sanity migration wrote the rows: 611 Projects, 207 Blogs,
   *  177 Singlepages, 88 Developers and 12 Case Studies, all of it. A
   *  Development's `createdAt` is when the feed sync first ingested it, which
   *  ran a median of 20 days and up to 49 days before the page was published.
   *  Judging page age on `createdAt` would report every page on the site as
   *  brand new and every Development as older than it is.
   *
   *  Null is returned rather than guessed for the three kinds with no usable
   *  field, and each null is a measured decision, not an oversight:
   *  - `singlepage`: 156 of 177 rows have `publishedAt` null and the other 21
   *    all carry one identical instant, 2026-07-07 — a backfill, not a
   *    publication. Using it would date 21 long-standing landing pages as
   *    published inside the window and quietly excuse them.
   *  - `developer`: the model has no `publishedAt` column at all, and no
   *    `status` either (every row is live).
   *  - `fixed`: hand-authored routes, no row to carry a date.
   *
   *  Consumers must treat null as "age unknown", never as "old" — see the
   *  publication-age guard in pageVerdicts.ts, which only ever uses this to
   *  WITHHOLD a claim, so an unknown date leaves the claim exactly as it was. */
  publishedAt: Date | null;
};

const LOCALES: Locale[] = ["en", "de", "pl", "ru"] as Locale[];

/** English is served prefix-less; every other locale carries its prefix. */
function localised(locale: Locale, path: string): string {
  return locale === ("en" as Locale) ? path : `/${locale}${path}`;
}

// Explicit, order-independent tie-break for a key collision (below): higher
// number wins regardless of which loop happened to run first. Only
// development-over-project is a real, documented case today; everything
// else defaults to the same tier because no other kind is known to collide.
const KIND_PRIORITY: Record<InventoryPage["kind"], number> = {
  development: 2,
  project: 1,
  blog: 0,
  singlepage: 0,
  developer: 0,
  caseStudy: 0,
  fixed: 0,
};

// Fixed, hand-authored pages the sitemap also emits by hand (src/app/sitemaps/[type]/route.ts):
// not CMS rows, but real indexable URLs with real GSC volume, so they must be in the
// inventory or the coverage metric would treat their clicks as unmatched.
//
// This list has now been caught short THREE times, which is why it is no longer
// trusted to be right by reading it — see the sitemap cross-check below.
//
// "Projects listing" was the second, and it is the one that bit hardest:
// `/projects` is the ONLY fixed page with a TemplateClass of its own
// (`projects-listing`, templateClass.ts), so leaving it out did not just lose one
// page — it emptied a whole class. Measured 2026-08-23: not one of the 1,675
// inventory pages carried that class, while `getClassVerdicts` was counting 112
// sessions entering it and the sitemap was emitting it in all four locales at
// priority 0.8, the highest of any listing. The class-level report could call the
// catalogue repelling and the page-level report could not name a single page of it
// to act on. It also had a diagnosis waiting — though NOT the one this comment
// used to claim. Re-measured through this module on 2026-08-23, `/projects` draws
// 694 impressions and 6 clicks at average position 56.3, so the diagnosis waiting
// for it is `buried`. Citing MIN_IMPRESSIONS_CTR and a CTR figure implied a CTR
// verdict, and at position 56 that branch is unreachable: `getPageVerdicts`
// reaches it only at a position of BURIED_POSITION or better. A listing page
// ranking in the fifties is a content-and-authority problem, not a title one, and
// the two asks are the opposite of each other.
//
// The three listings below were the third, added 2026-08-23. `${prefix}/blog`
// (sitemap priority 0.8), `${prefix}/developers` (0.7) and
// `${prefix}/case-studies` (0.8), in all four locales — twelve indexable URLs,
// none of them noindexed, none of them in this list. Coverage barely moved
// because they draw 377 impressions and ZERO clicks between them, and coverage
// is a share of clicks. That is exactly why coverage could not have caught this:
// a page with no clicks is invisible to the instrument the join is trusted on.
// The cost was verdicts, not coverage — `/ru/developers` sits at 131 impressions
// and average position 41.3, a `buried` verdict this module could not emit at all
// while the URL was absent.
//
// DERIVING this list from the sitemap generator was considered and rejected.
// Those routes are emitted inline inside five different generator functions,
// each interleaved with its own Sanity calls and carrying its own priority,
// changefreq and hreflang set; hoisting them into a shared constant means
// editing the live sitemap route to serve a diagnostic, and the two consumers
// want different fields (the sitemap wants priority and alternates, this wants a
// title). CHECKING is the cheaper half of the same idea and catches strictly
// more: `scripts/verify-page-power.mjs` now fetches all six sitemaps and asserts
// that every `<loc>` it emits is an inventory path. That covers every kind, not
// just the fixed ones, and it fails loudly on the next omission instead of
// waiting for a fourth review. Measured 2026-08-23 with the twelve added: 1,691
// sitemap URLs, 1,691 inventory paths, nothing on either side alone.
const FIXED_PAGES: ReadonlyArray<{ title: string; path: (locale: Locale) => string }> = [
  { title: "Homepage", path: (locale) => (locale === ("en" as Locale) ? "/" : `/${locale}`) },
  { title: "Projects listing", path: (locale) => localised(locale, "/projects") },
  { title: "Blog listing", path: (locale) => localised(locale, "/blog") },
  { title: "Developers listing", path: (locale) => localised(locale, "/developers") },
  { title: "Case studies listing", path: (locale) => localised(locale, "/case-studies") },
  { title: "FAQ", path: (locale) => localised(locale, "/faq") },
  { title: "Partners", path: (locale) => localised(locale, "/partners") },
];

// A nested Singlepage's real, served URL is its full parent chain (see
// nestedPageRedirects.json), not its own leaf slug — the catch-all route
// resolves it there and GSC indexes it there. Capped walk, same shape as
// getAllPathsForLang in src/sanity/sanity.utils.ts (map sanityId -> row,
// resolve parents iteratively) but done per-row so a broken/unpublished
// ancestor degrades gracefully instead of dropping the page outright.
const MAX_PARENT_DEPTH = 20;

type SinglepageRow = { slug: string; language: Locale; title: string; sanityId: string; parentSanityId: string | null };

function nestedSlugPath(row: SinglepageRow, byId: Map<string, SinglepageRow>): string {
  const segments: string[] = [row.slug];
  const visited = new Set<string>([row.sanityId]);
  let parentId = row.parentSanityId;
  let depth = 0;
  while (parentId && depth < MAX_PARENT_DEPTH) {
    if (visited.has(parentId)) return row.slug; // cycle in the parent chain — bail to the leaf slug rather than loop forever
    const parent = byId.get(parentId);
    if (!parent) break; // dangling/unpublished ancestor — use the chain resolved so far
    segments.unshift(parent.slug);
    visited.add(parentId);
    parentId = parent.parentSanityId;
    depth++;
  }
  if (parentId && depth >= MAX_PARENT_DEPTH) return row.slug; // chain never terminated within the cap — treat as pathological, fall back to the leaf
  return segments.join("/");
}

/**
 * Every publicly reachable, indexable page, as canonical `locale::path` keys.
 *
 * Developments carry ONE language-agnostic slug (see developmentSeo.ts) and are
 * therefore reachable in all four locales. Projects, Blogs, Singlepages,
 * Developers and CaseStudies are per-locale rows and exist only in the locale
 * they were authored in.
 */
export async function getInventory(): Promise<InventoryPage[]> {
  const [devs, projects, blogs, singles, developers, caseStudies] = await Promise.all([
    NEW_PROJECTS_INDEXABLE
      ? prisma.development.findMany({
          where: { publishStatus: "published", slug: { not: null } },
          select: { slug: true, publicName: true, publishedAt: true },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true, publishedAt: true },
    }),
    prisma.blog.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true, publishedAt: true },
    }),
    prisma.singlepage.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true, sanityId: true, parentSanityId: true },
    }),
    // Developer has no status column — every row is live (see src/app/sitemaps/[type]/route.ts).
    prisma.developer.findMany({
      where: { slug: { not: "" } },
      select: { slug: true, language: true, title: true },
    }),
    prisma.caseStudy.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true, publishedAt: true },
    }),
  ]);

  const out: InventoryPage[] = [];

  for (const d of devs) {
    for (const locale of LOCALES) {
      const path = localised(locale, `/projects/${d.slug}`);
      out.push({ key: pageKey(locale, path), locale, path, kind: "development", title: d.publicName, publishedAt: d.publishedAt });
    }
  }
  for (const p of projects) {
    const path = localised(p.language, `/projects/${p.slug}`);
    out.push({ key: pageKey(p.language, path), locale: p.language, path, kind: "project", title: p.title, publishedAt: p.publishedAt });
  }
  for (const b of blogs) {
    const path = localised(b.language, `/blog/${b.slug}`);
    out.push({ key: pageKey(b.language, path), locale: b.language, path, kind: "blog", title: b.title, publishedAt: b.publishedAt });
  }
  const singlesById = new Map(singles.map((s) => [s.sanityId, s]));
  for (const s of singles) {
    // Singlepage.slug is only the LEAF segment for a nested page — reconstruct
    // the full served path by walking parentSanityId (see nestedSlugPath above).
    const nested = nestedSlugPath(s, singlesById);
    const path = localised(s.language, `/${nested}`);
    out.push({ key: pageKey(s.language, path), locale: s.language, path, kind: "singlepage", title: s.title, publishedAt: null });
  }
  for (const dev of developers) {
    const path = localised(dev.language, `/developers/${dev.slug}`);
    out.push({ key: pageKey(dev.language, path), locale: dev.language, path, kind: "developer", title: dev.title, publishedAt: null });
  }
  for (const c of caseStudies) {
    const path = localised(c.language, `/case-studies/${c.slug}`);
    out.push({ key: pageKey(c.language, path), locale: c.language, path, kind: "caseStudy", title: c.title, publishedAt: c.publishedAt });
  }
  for (const locale of LOCALES) {
    for (const fixed of FIXED_PAGES) {
      const path = fixed.path(locale);
      out.push({ key: pageKey(locale, path), locale, path, kind: "fixed", title: fixed.title, publishedAt: null });
    }
  }

  // A Development slug can collide with a legacy Project slug during the
  // supersede window; the Development wins because it is what the dispatcher
  // serves (see src/app/[lang]/projects/[slug]/page.tsx). The priority is
  // explicit (KIND_PRIORITY above), not incidental to loop order, so a future
  // reordering of the loops above cannot silently flip the winner.
  const byKey = new Map<PageKey, InventoryPage>();
  for (const page of out) {
    const existing = byKey.get(page.key);
    if (!existing || KIND_PRIORITY[page.kind] > KIND_PRIORITY[existing.kind]) byKey.set(page.key, page);
  }
  return Array.from(byKey.values());
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/pagePower/inventory.ts
git commit -m "Page Power: CMS page inventory"
```

---

## Task 3: Per-page diagnoses

**Files:**
- Create: `src/lib/seo/pagePower/pageVerdicts.ts`
- Modify: `src/lib/seo/urlCanonical.ts` — add the exported `localeOfPath`
  helper (below). It lives there, not in `pagePower/`, because it is a shared
  join-key helper rather than a diagnosis concern: `urlCanonical.ts` already
  owns URL/locale canonicalisation, already imports `deriveLocale`, and is
  already server-only. It must NOT go in `pagePower/types.ts` — that file is a
  candidate for client-side import, and pulling `gsc/client` into it would drag
  server dependencies into a browser bundle.

```typescript
/**
 * The single locale derivation for everything joined on a `locale::path` key.
 *
 * `deriveLocale` only recognises a prefix that is FOLLOWED BY A SLASH
 * (`/de/x`), so a bare locale root (`/de`) derives as "en". That would key the
 * German, Polish and Russian homepages as `en::/de` on the GSC side while the
 * page inventory keys them as `de::/de` — the three localised homepages would
 * never match, their clicks would count as uncovered, and all three would be
 * reported as having no impressions while being among the highest-traffic
 * pages on the site. (Confirmed against production 2026-08-23: `/de` 123
 * impressions, `/pl` 29, `/ru` 491, none of which would have joined.)
 *
 * Fixed here rather than inside `deriveLocale` itself, because that function
 * also decides `SearchMetric.locale` at sync time and `locale` is part of that
 * table's unique key — changing it would fork every existing homepage series
 * into a second one. Any source joined on a page key (GSC, PageView, Lead)
 * must use THIS function, not `deriveLocale` directly.
 */
export function localeOfPath(path: string): Locale {
  if (path === "/de" || path === "/pl" || path === "/ru") return path.slice(1) as Locale;
  return deriveLocale(path);
}
```

- [ ] **Step 1: Create the file**

```typescript
import { prisma } from "@/lib/prisma";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { getInventory } from "./inventory";
import {
  BURIED_POSITION, CTR_MEDIAN_FRACTION, GSC_LAG_DAYS, MIN_BUCKET_IMPRESSIONS,
  MIN_BUCKET_PAGES, MIN_IMPRESSIONS_BURIED, MIN_IMPRESSIONS_CTR,
  MIN_IMPRESSIONS_TREND, MIN_IMPRESSIONS_VISIBLE, POSITION_BUCKETS,
  TREND_WINDOW_DAYS, WINDOW_DAYS,
  pageKey, type PageKey, type PageVerdict,
} from "./types";

const DAY = 86_400_000;

// Deliberately NOT reusing `accumulate`/`avgPosition`/`ctrPct` from
// src/lib/seo/queries.ts, whose header declares itself the single source of
// truth for page-level aggregation. The divergence is the point: `avgPosition`
// returns 0 for a page with no impressions, and 0 is the BEST possible position
// — a page with no data would read as ranking first and be judged against the
// CTR expectation for position 0. This module needs "no position" to be
// representable, so `positionOf` returns null and every caller is forced to
// handle it. Same reason `positionOf` rejects non-finite values below. If those
// helpers ever grow a null-returning variant, collapse this back onto them.

type Totals = { impressions: number; clicks: number; weightedPosition: number };

const emptyTotals = (): Totals => ({ impressions: 0, clicks: 0, weightedPosition: 0 });

/** Named `MetricWindow`, not `Window`: `lib.dom` is in scope in this project and
 *  a bare `Window` silently shadows the global DOM type. */
type MetricWindow = { since: Date; until: Date };

/** Named, not positional. An `Array<Map<…>>` destructured as
 *  `[main, recent, prior]` lets a swap of two window literals type-check, run,
 *  and invert the sign of every trend arrow on the site with nothing to catch
 *  it. Position must not carry meaning here.
 *
 *  WINDOW_NAMES is the single declaration and both record types are derived
 *  from it, so a fourth window cannot be added to the record without the
 *  compiler also demanding it in the array — the residual failure mode of the
 *  fix above, where a name missing from the array would silently yield an
 *  empty map for that window. */
const WINDOW_NAMES = ["main", "recent", "prior"] as const;
type WindowName = (typeof WINDOW_NAMES)[number];
type WindowSet = Record<WindowName, MetricWindow>;
type TotalsSet = Record<WindowName, Map<PageKey, Totals>>;

/**
 * Sums page-level GSC rows into one totals map per window.
 *
 * Takes the canonical map as a PARAMETER rather than building it: it reads
 * `redirect-mapping.csv` off disk and queries the legacy-redirect table, and
 * there are three windows, so building it per call would repeat that work three
 * times over.
 *
 * The windows are served from ONE query spanning their union for the same
 * reason — the trend windows are strictly inside the main window, so three
 * separate queries would pull the same tens of thousands of rows three times.
 */
async function gscTotals(canonicalMap: Map<string, string>, windows: WindowSet): Promise<TotalsSet> {
  const bounds = WINDOW_NAMES.map((name) => windows[name]);
  const since = new Date(Math.min(...bounds.map((w) => w.since.getTime())));
  const until = new Date(Math.max(...bounds.map((w) => w.until.getTime())));

  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: since, lt: until } },
    select: { date: true, page: true, impressions: true, clicks: true, position: true },
  });

  const outs: TotalsSet = { main: new Map(), recent: new Map(), prior: new Map() };
  for (const row of rows) {
    // Derive the locale from the PATH, not from SearchMetric.locale. All three
    // sources (GSC, PageView, Lead) must derive it identically or the join keys
    // will not line up — and the stored value is not reliable anyway: a German
    // article at a prefix-less URL is recorded with locale "en". `localeOfPath`
    // rather than `deriveLocale`: see its doc comment in urlCanonical.ts.
    // The locale argument below is inert — `target.locale` is deliberately
    // ignored, see the next line — but `canonicalize` requires one.
    const target = canonicalize(canonicalMap, localeOfPath(row.page), row.page);
    // Re-derived from the CANONICAL path, discarding `target.locale`, because
    // `canonicalize` fills that in with `deriveLocale` and inherits its
    // bare-root blind spot. Neither call is redundant: this one decides the key.
    const key = pageKey(localeOfPath(target.page), target.page);
    const at = row.date.getTime();
    for (const name of WINDOW_NAMES) {
      // `range`, not `window`: a local named `window` shadows the DOM global,
      // which is in scope here even though this module is server-only.
      const range = windows[name];
      if (at < range.since.getTime() || at >= range.until.getTime()) continue;
      const totals = outs[name].get(key) ?? emptyTotals();
      totals.impressions += row.impressions;
      totals.clicks += row.clicks;
      totals.weightedPosition += row.position * row.impressions;
      outs[name].set(key, totals);
    }
  }
  return outs;
}

/** Null rather than 0 when there is no usable position — see the note at the
 *  top of this file. Non-finite is rejected explicitly: `position` is Postgres
 *  `double precision`, which admits NaN and ±Infinity, and NaN compares false
 *  against everything, so a single poisoned row would otherwise carry a
 *  50,000-impression page silently past every threshold in `getPageVerdicts`. */
const positionOf = (t: Totals): number | null => {
  if (t.impressions <= 0) return null;
  const position = t.weightedPosition / t.impressions;
  return Number.isFinite(position) ? position : null;
};

const ctrOf = (t: Totals): number => (t.impressions > 0 ? (100 * t.clicks) / t.impressions : 0);

/** The top of the SECOND position bucket — the union of POSITION_BUCKETS[0] and
 *  POSITION_BUCKETS[1], i.e. "on the first page of results". Used only by the
 *  `invisible` reason below, to decide whether a page's own rank rules out the
 *  technical explanations.
 *
 *  Derived from the buckets rather than written as a literal 10 so the boundary
 *  stays tied to the ranking bands the rest of this module already reasons in;
 *  re-banding POSITION_BUCKETS moves this with it instead of leaving a stale
 *  number behind. It reads two fixed indices, so it assumes the buckets keep at
 *  least two bands — which POSITION_BUCKETS' own doc comment already requires,
 *  since `bucketStats` and `bucketKeyFor` depend on the same shape. */
const WELL_RANKED_POSITION = POSITION_BUCKETS[1][1];

/** Which bucket a position belongs to, or null if none — the ONE implementation
 *  of the half-open `[low, high)` membership rule documented on POSITION_BUCKETS
 *  in types.ts. `bucketStats` calls it too, so a page can never be compared
 *  against a median drawn from a population it was not itself eligible for. */
function bucketKeyFor(position: number): string | null {
  for (const [low, high] of POSITION_BUCKETS) if (position >= low && position < high) return `${low}-${high}`;
  return null;
}

/** True median. `sorted[Math.floor(n / 2)]` on its own is the UPPER of the two
 *  middle values on an even-length sample — the 67th percentile of a six-page
 *  bucket, not the median — which biases the expected-CTR bar upward and
 *  over-flags `unclicked`, while the reason text quotes a "typical" figure that
 *  is typical of nothing. MIN_BUCKET_PAGES is 5, so even-length buckets are the
 *  ordinary case, not an edge case. Input must be sorted ascending. */
function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** What a position bucket knows about itself. `median` alone was not enough:
 *  when it is null the page falls to a reason sentence that has to explain WHY
 *  there is no bar, and "too few comparable pages" without the counts reads as a
 *  temporary shortage that will fill in next month.
 *
 *  Measured against production on 2026-08-23, the 0–5 band is the case that
 *  forced this: 177 pages average a position there and only 3 of them clear
 *  MIN_BUCKET_IMPRESSIONS, against the 5 MIN_BUCKET_PAGES asks for. The site
 *  rarely ranks top-five on queries with volume, so its best-ranking pages —
 *  including the highest-impression page it has, at 7,018 impressions and
 *  position 3.5 — are structurally unjudgeable on CTR, not merely unjudged yet.
 *  Printing 177 beside 3 beside 5 is what tells those two facts apart.
 *
 *  This is NOT a case for lowering MIN_BUCKET_PAGES. A median drawn from three
 *  samples is the unfounded verdict this module exists to refuse; reporting the
 *  gap is the finding. */
type BucketStats = {
  low: number;
  high: number;
  /** Inventory pages whose impression-weighted average position falls in this
   *  band at all. Pages with no impressions have no position and are absent. */
  pagesInBand: number;
  /** Of those, the ones clearing MIN_BUCKET_IMPRESSIONS — the sample the median
   *  is actually drawn from. */
  comparablePages: number;
  /** null when `comparablePages` is below MIN_BUCKET_PAGES. */
  median: number | null;
};

/**
 * Median CTR per position bucket, and how many pages that median rests on,
 * computed over INVENTORY PAGES ONLY.
 *
 * The GSC side also carries keys that are not pages of this site any more:
 * parameterised and trailing-slash variants, URLs from before a migration that
 * no redirect covers, deleted content Google still remembers. Those skew one
 * way — they are dead or duplicate URLs, so their CTR is depressed — which
 * would drag each bucket median DOWN, and the median is the bar the `unclicked`
 * check is measured against. A dragged-down bar silently hides real
 * underperformers, and it does it without leaving a trace anywhere in the
 * output. The comparison is also only ever APPLIED to inventory pages, so
 * drawing "typical for this position" from a different population than the one
 * being judged is a category error regardless of which way the skew runs.
 *
 * The cost is sample size, and the cost is safe: a bucket that drops below
 * MIN_BUCKET_PAGES yields no median, and a page in it is reported `unjudged`
 * with a reason naming both counts — how many pages rank in the band and how
 * many of them have the volume to compare. Under-claiming is the correct
 * failure; leaving the reader unable to tell a thin band from a structurally
 * empty one is not, which is why the counts travel with the median.
 */
function bucketStats(totals: Map<PageKey, Totals>, inventoryKeys: Set<PageKey>): Map<string, BucketStats> {
  // Seeded from POSITION_BUCKETS rather than grown from the data, so a band no
  // page reached is present with zeroes instead of missing. A missing entry and
  // an empty one read identically at the call site, and the difference is the
  // whole sentence: "177 pages rank here and 3 have volume" against "nothing
  // ranks here at all".
  const byBucket = new Map<string, { stats: BucketStats; ctrs: number[] }>();
  for (const [low, high] of POSITION_BUCKETS) {
    byBucket.set(`${low}-${high}`, { stats: { low, high, pagesInBand: 0, comparablePages: 0, median: null }, ctrs: [] });
  }

  for (const [key, t] of Array.from(totals.entries())) {
    if (!inventoryKeys.has(key)) continue;
    const position = positionOf(t);
    if (position == null) continue;
    const bucket = bucketKeyFor(position);
    if (bucket == null) continue;
    const entry = byBucket.get(bucket);
    if (entry === undefined) continue; // unreachable: bucketKeyFor draws from the same POSITION_BUCKETS seeded above
    entry.stats.pagesInBand++;
    // The impression floor gates the MEDIAN's sample, not the band's population
    // — counted after `pagesInBand` on purpose, since the gap between the two is
    // the finding when a band has no bar.
    if (t.impressions < MIN_BUCKET_IMPRESSIONS) continue;
    entry.stats.comparablePages++;
    entry.ctrs.push(ctrOf(t));
  }

  const out = new Map<string, BucketStats>();
  for (const [bucket, entry] of Array.from(byBucket.entries())) {
    if (entry.ctrs.length >= MIN_BUCKET_PAGES) {
      entry.ctrs.sort((a, b) => a - b);
      entry.stats.median = medianOf(entry.ctrs);
    }
    out.set(bucket, entry.stats);
  }
  return out;
}

const fmt = (n: number): string => n.toLocaleString("en-GB");

/** "1 impression" / "9 impressions". Only the `invisible` branch can reach a
 *  count of one — every other diagnosis has an impression floor of 100 or more —
 *  but 137 of the 1,118 invisible pages read "1 impressions" without this, and
 *  a tool that miscounts its own noun is not believed about anything else.
 *  Same shape as `enquiries` in classVerdicts.ts. */
const impressions = (n: number): string => `${fmt(n)} impression${n === 1 ? "" : "s"}`;

/** SearchMetric.date is `@db.Date`, so every row sits at UTC midnight. Bounds
 *  carrying `now`'s time-of-day make `gte: windowStart` exclude the row on
 *  windowStart's own date, so the date handed back for display is one the window
 *  does not contain — and the injectable `now` parameter invites callers to pass
 *  a date-only value, which would flip that behaviour again.
 *
 *  DST is a non-issue and DAY = 86_400_000 is exact here: every bound produced
 *  by this function is a UTC-midnight instant and every comparison against it is
 *  absolute-ms, so no local calendar is ever consulted. Do not "fix" the
 *  arithmetic later with a timezone-aware subtraction. */
const utcMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * The publication date and the days of the window a page was actually live for
 * — but ONLY when that is fewer than the whole window. Null otherwise, which
 * covers both "published before this window opened" and "no usable publication
 * date" (`developer`, `singlepage` and `fixed` rows carry none — see
 * `InventoryPage.publishedAt`).
 *
 * Returning ONE nullable object rather than a nullable number plus the date is
 * what lets every call site below narrow both without re-testing the predicate
 * or casting; the predicate is stated once, here.
 *
 * The two nulls are collapsed deliberately. Every caller uses this only to
 * WITHHOLD a claim, so "unknown date" and "old enough" have to behave
 * identically: an unknown date must leave the existing wording and the existing
 * Action Center count exactly as they were, never excuse a page. Under-claiming
 * is the safe direction here and merging the cases makes it unmissable.
 *
 * `days` is clamped into [0, WINDOW_DAYS]: `publishedAt` can be set to a future
 * instant by the scheduled-publish flow (`scheduledAt` → `publishedAt`), and a
 * negative "live for −4 days" printed in a reason an admin reads is worse than
 * saying nothing.
 */
function partialWindowAge(publishedAt: Date | null, windowStart: Date, windowEnd: Date): { publishedAt: Date; days: number } | null {
  if (publishedAt == null) return null;
  const at = publishedAt.getTime();
  if (!Number.isFinite(at)) return null; // an unparseable date is unknown, not new
  if (at <= windowStart.getTime()) return null; // live for the whole window
  const days = Math.max(0, Math.min(WINDOW_DAYS, (windowEnd.getTime() - at) / DAY));
  return { publishedAt, days };
}

export type PageVerdictResult = {
  verdicts: PageVerdict[];
  coveragePct: number;
  /** INCLUSIVE, UTC midnight — the first day the window covers. */
  windowStart: Date;
  /** EXCLUSIVE, UTC midnight — the first day the window does NOT cover, i.e.
   *  the day after `today − GSC_LAG_DAYS`. Display code wanting a human
   *  "… to <last day>" must subtract one day. */
  windowEnd: Date;
  /**
   * Keys of the pages whose own publication date falls INSIDE the window, so
   * they were live for fewer than WINDOW_DAYS of it and their 90-day counts are
   * not comparable with the rest of the site's.
   *
   * Reported ALONGSIDE the verdicts rather than as a field on `PageVerdict`, and
   * not as a sixth diagnosis, because the diagnosis these pages carry is true:
   * a Development published nine days ago really is published and really is not
   * being shown. What is not true is the CAUSE the `invisible` reason used to
   * assert, and the WORK the Action Center used to ask for. So the admin screen
   * keeps listing them under their real diagnosis with a reason that names the
   * publication date, and actionCenter/rules/pagePower.ts subtracts this set
   * from the pile it asks for work on — see the note there for which diagnoses
   * it applies to and why not all of them.
   *
   * An ARRAY, not a Set, on purpose: this crosses a JSON boundary in the
   * verification harness (`scripts/verify-page-power.mjs` reads it off a probe
   * route) and `JSON.stringify(new Set())` is `{}` — a silent empty, which is
   * exactly the failure mode this whole result type exists to avoid. Callers
   * that need membership build their own Set from it.
   *
   * Pages with no usable publication date are NOT in here (`developer`,
   * `singlepage` and `fixed` have none — see `InventoryPage.publishedAt`), so
   * this set under-claims by construction. That is the correct direction: an
   * unknown date leaves a page in the pile being asked about.
   */
  publishedInsideWindow: PageKey[];
};

export async function getPageVerdicts(now: Date = new Date()): Promise<PageVerdictResult> {
  // The property to hold: the NEWEST day inside the window is exactly
  // `today − GSC_LAG_DAYS`. `windowEnd` is an exclusive bound, so it is the
  // midnight that FOLLOWS that day — expressed here as "newest covered day,
  // plus one" rather than as `(GSC_LAG_DAYS - 1) * DAY`, so the property is
  // stated outright instead of being left for the reader to reconstruct from
  // the arithmetic. That newest day is present in the data: the sync cron
  // (src/app/api/cron/gsc-sync/route.ts, LAG_DAYS = 2) fetches through
  // `now − 2 days` inclusive, one day fresher than this window needs.
  const newestCoveredDay = utcMidnight(new Date(now.getTime() - GSC_LAG_DAYS * DAY));
  const windowEnd = new Date(newestCoveredDay.getTime() + DAY);
  const windowStart = utcMidnight(new Date(windowEnd.getTime() - WINDOW_DAYS * DAY));
  const trendStart = utcMidnight(new Date(windowEnd.getTime() - TREND_WINDOW_DAYS * DAY));
  const priorStart = utcMidnight(new Date(trendStart.getTime() - TREND_WINDOW_DAYS * DAY));

  const [inventory, canonicalMap] = await Promise.all([getInventory(), buildCanonicalMap()]);
  const totals = await gscTotals(canonicalMap, {
    main: { since: windowStart, until: windowEnd },
    recent: { since: trendStart, until: windowEnd },
    prior: { since: priorStart, until: trendStart },
  });

  const inventoryKeys = new Set(inventory.map((p) => p.key));
  const buckets = bucketStats(totals.main, inventoryKeys);

  const publishedInsideWindow: PageKey[] = [];

  const verdicts: PageVerdict[] = inventory.map((page) => {
    const t = totals.main.get(page.key) ?? emptyTotals();
    const position = positionOf(t);
    const ctr = ctrOf(t);

    // Collected for EVERY page, not just the invisible ones, so the set this
    // function hands back is a fact about publication dates rather than about
    // one diagnosis — the Action Center decides which diagnoses it applies to.
    const young = partialWindowAge(page.publishedAt, windowStart, windowEnd);
    if (young != null) publishedInsideWindow.push(page.key);

    const recentImpressions = totals.recent.get(page.key)?.impressions ?? 0;
    const priorImpressions = totals.prior.get(page.key)?.impressions ?? 0;
    const impressionsTrendPct = priorImpressions >= MIN_IMPRESSIONS_TREND
      ? (100 * (recentImpressions - priorImpressions)) / priorImpressions
      : null;

    let diagnosis: PageVerdict["diagnosis"] = "unjudged";
    let reason = "Not enough data to judge.";

    if (t.impressions < MIN_IMPRESSIONS_VISIBLE) {
      diagnosis = "invisible";
      // The diagnosis is right either way; the CAUSE is not. Calibration on
      // 2026-08-23 found three of the ten highest-impression `invisible` pages
      // ranking in the top seven results — `/projects/ruby-project` and
      // `/de/projects/velaro-homes` at position 2.9, `/ru/projects/aura-konia`
      // at 6.3, each on 9 impressions and an 11.1% CTR. A page at position 2.9
      // is indexed and is being served: "indexing" and "internal links" are not
      // merely unlikely there, they are EXCLUDED by the same row the verdict is
      // computed from, and the one cause that does apply was listed third. So
      // the sentence splits on the page's own rank.
      //
      // A page with no impressions has no position — `positionOf` returns null
      // rather than 0 for exactly this reason (see the note at the top of this
      // file) — and falls to the original wording, where indexing and internal
      // links are still live hypotheses. A null must never be read as a good
      // rank here; that is what the explicit `!= null` buys.
      //
      // AGE IS TESTED FIRST, and it is the same defect one step earlier. The
      // rank split above rules out two of the three causes from the page's own
      // position; a publication date inside the window rules out all three from
      // the page's own row, because a page that has not had the window cannot
      // have failed to accumulate over it. Measured 2026-08-23: 548 of the 1,125
      // `invisible` pages were published inside the window — every one of the
      // 588 Development pages (147 Developments went live between 2026-07-06 and
      // today, 114 of them in the last 30 days) and 86 Blogs — and 430 of those
      // 548 had been live 30 days or less. 167 of them would otherwise have
      // reached the well-ranked sentence and been told "Nobody is searching for
      // this subject" on nine days of data, which is a demand verdict no
      // nine-day sample supports. Hence this order, not the other one.
      //
      // `createdAt` is NOT the field for this and using it would have produced a
      // wrong answer in both directions — see `InventoryPage.publishedAt` for
      // the measurement.
      if (young != null) {
        const days = Math.round(young.days);
        // `days` clamps to 0 for the 70 pages published after `windowEnd` — the
        // window ends GSC_LAG_DAYS behind today, so anything published this week
        // is genuinely outside it. "live for 0 of the 90 days" is arithmetically
        // right and reads like a bug, so that case gets its own clause.
        const livedFor = days < 1
          ? `it was not live for any of the ${WINDOW_DAYS} days this window measures`
          : `it has been live for ${days} of the ${WINDOW_DAYS} days this window measures`;
        const comparableFrom = ymd(new Date(young.publishedAt.getTime() + WINDOW_DAYS * DAY));
        reason = `Published ${ymd(young.publishedAt)}, so ${livedFor} — ${impressions(t.impressions)} so far. It is under the ${MIN_IMPRESSIONS_VISIBLE}-impression floor because it has not had the window, which says nothing about its indexing, its internal links or its demand. The work is to wait: its count is comparable with the rest of the site from ${comparableFrom}.`;
      } else {
        reason = position != null && position < WELL_RANKED_POSITION
          ? `${impressions(t.impressions)} in ${WINDOW_DAYS} days, but at average position ${position.toFixed(1)} — indexed and served on the first page, so indexing and internal links are ruled out. Nobody is searching for this subject: the work is demand-side (a subject with search volume), or accepting that this page will never carry traffic. Nothing technical will move it.`
          : `Fewer than ${MIN_IMPRESSIONS_VISIBLE} impressions in ${WINDOW_DAYS} days — indexing, internal links, or no demand for the subject.`;
      }
    } else if (t.impressions >= MIN_IMPRESSIONS_BURIED && position != null && position > BURIED_POSITION) {
      diagnosis = "buried";
      reason = `${fmt(t.impressions)} impressions at average position ${position.toFixed(1)} — nobody scrolls that far. Needs content and authority, not a new title.`;
    } else if (t.impressions >= MIN_IMPRESSIONS_CTR && position != null && position <= BURIED_POSITION) {
      const bucket = bucketKeyFor(position);
      // Branching on the whole `stats`, not on a `median` pulled out of it, so
      // the compiler narrows the band away in every branch that needs its
      // bounds. The alternative was a cast, and a cast is a claim the compiler
      // cannot check — this one would have invented a band's low and high
      // values into a sentence an admin reads as measurement.
      const stats = bucket == null ? undefined : buckets.get(bucket);
      if (stats === undefined) {
        // Position exactly BURIED_POSITION: the buckets are half-open and stop
        // at 20, so 20.0 belongs to no bucket while still passing the <= 20 test
        // above. Rare, but an impression-weighted average lands on a boundary
        // often enough to matter (see POSITION_BUCKETS in types.ts) — and "too
        // few comparable pages" would be a false explanation for it.
        //
        // Also the only branch a missing bucket entry could surface through, now
        // that `bucketStats` seeds every band from POSITION_BUCKETS. The
        // sentence stays true of that case: a position no band claims is outside
        // the comparison range by definition.
        reason = `Average position ${position.toFixed(1)} sits on the edge of the comparison range, so there is no expected CTR to measure against.`;
      } else if (stats.median == null) {
        // The counts are named, not summarised as "too few". On 2026-08-23 the
        // band this fires on was 0–5, where 177 pages rank and 3 have the volume
        // to be compared: a reader told only "too few comparable pages" hears a
        // shortage that next month's data will fix, when the truth is that this
        // site rarely ranks top-five on queries with volume and its best pages
        // may never be CTR-judgeable. Same treatment the `invisible` reason got
        // — the sentence has to leave the reader knowing which of the two they
        // are looking at.
        reason = `Position ${position.toFixed(1)} sits in the ${stats.low}–${stats.high} band. ${fmt(stats.pagesInBand)} of this site's pages average a position there, but only ${fmt(stats.comparablePages)} of them reach the ${MIN_BUCKET_IMPRESSIONS} impressions in ${WINDOW_DAYS} days a CTR comparison needs, against the ${MIN_BUCKET_PAGES} required to read a typical CTR off them at all. That is a gap in the site's own data, not a late measurement: it closes only when more pages rank in this band with enough volume to compare.`;
      } else if (!(stats.median > 0)) {
        // A median of 0 means at least half the bucket earned no clicks, so the
        // bar is 0 and `ctr < 0 * fraction` can never be true. Left to fall
        // through, the `unclicked` test becomes unfalsifiable and EVERY page in
        // the bucket is certified healthy — including a 5,000-impression page
        // with no clicks at all, which is the single most confidently wrong
        // sentence this module could emit, on exactly the pages the feature
        // exists to find. It is reachable: at positions 10–20 the expected
        // clicks over the window are around one, so a thin locale's bucket
        // crossing 50% zero-click pages is ordinary. Kept distinct from the
        // too-few-pages case above: there the sample is missing, here the
        // sample exists and has nothing to say.
        //
        // Written `!(stats.median > 0)` rather than `stats.median <= 0` so a
        // NaN bar is rejected rather than silently passed through, matching the
        // Number.isFinite discipline in `positionOf` — one habit, not two
        // standards.
        //
        // The sentence branches on THIS page's clicks: a zero median says
        // nothing about the page being judged, so "earned no clicks either" is
        // untrue of a page here with 500 impressions and 15 clicks.
        const noBar = `At least half the comparable pages at position ${position.toFixed(1)} earned no clicks, so there is no expected CTR to judge against`;
        reason = t.clicks > 0
          ? `${noBar} — this page's own ${ctr.toFixed(2)}% cannot be called high or low.`
          : `${noBar}, and this page earned none either.`;
      } else if (ctr < stats.median * CTR_MEDIAN_FRACTION) {
        diagnosis = "unclicked";
        reason = `CTR ${ctr.toFixed(2)}% against ${stats.median.toFixed(2)}% typical for position ${position.toFixed(1)} — title and meta description.`;
      } else {
        diagnosis = "healthy";
        reason = `CTR ${ctr.toFixed(2)}% is in line with position ${position.toFixed(1)}.`;
      }
    } else if (position == null) {
      // Visible, but no usable average position — with impressions above the
      // floor the only way in is a non-finite weighted average, i.e. corrupt
      // stored GSC data. Blaming the impression count here would contradict the
      // impression count printed in the same sentence.
      reason = `${fmt(t.impressions)} impressions, but the stored average position is not a usable number — the GSC data for this page needs re-syncing.`;
    } else if (position > BURIED_POSITION) {
      // A bad position with too few impressions to call it buried. NOT a CTR
      // question: a page at position 45 would never reach the CTR test however
      // many impressions it had, so quoting the CTR floor here would misdirect.
      reason = `${fmt(t.impressions)} impressions at average position ${position.toFixed(1)} — below the ${MIN_IMPRESSIONS_BURIED} impressions needed to call a page buried.`;
    } else {
      // A good position with too few impressions to judge CTR.
      reason = `${fmt(t.impressions)} impressions — below the ${MIN_IMPRESSIONS_CTR} needed to judge CTR.`;
    }

    return {
      key: page.key,
      locale: page.locale,
      path: page.path,
      impressions: t.impressions,
      clicks: t.clicks,
      ctr,
      position,
      diagnosis,
      reason,
      impressionsTrendPct,
    };
  });

  // Coverage: the share of GSC clicks that landed on a page we know about. If
  // this falls, redirects exist that the canonical map has not learned yet —
  // that is itself an alarm, so it is reported rather than silently absorbed.
  // Every unmatched click is a page being judged on partial data, or not judged
  // at all, so this number is the instrument the whole join is trusted on.
  let totalClicks = 0;
  let matchedClicks = 0;
  for (const [key, t] of Array.from(totals.main.entries())) {
    totalClicks += t.clicks;
    if (inventoryKeys.has(key)) matchedClicks += t.clicks;
  }
  const coveragePct = totalClicks > 0 ? (100 * matchedClicks) / totalClicks : 100;

  return { verdicts, coveragePct, windowStart, windowEnd, publishedInsideWindow };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/pagePower/pageVerdicts.ts src/lib/seo/urlCanonical.ts
git commit -m "Page Power: per-page diagnoses (invisible, buried, unclicked)"
```

---

## Task 4: Per-class diagnoses

Only 5 pages have 30+ clicks in 90 days, so per-page landing analysis is
impossible. These two diagnoses work per template class and are measured on
**sessions**, of which there are 3,853 in the same window.

**Files:**
- Create: `src/lib/seo/pagePower/classVerdicts.ts`

- [ ] **Step 1: Create the file**

```typescript
import { prisma } from "@/lib/prisma";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { templateClassOf, type TemplateClass } from "@/lib/seo/templateClass";
import {
  CLASS_RATE_FRACTION, COMPARISON_PROJECT_PAGES, MIN_COMPARISON_SESSIONS,
  MIN_ENTERING_SESSIONS, MIN_EXPECTED_ONWARD, WINDOW_DAYS, type ClassVerdict,
} from "./types";

// The two diagnoses that cannot work per page. Only 5 pages on this site clear
// 30 Google clicks in 90 days, so a per-page landing analysis would manufacture
// noise; these are measured on SESSIONS (3,824 in the same window) and reported
// per template class.
//
// EVERY production figure quoted in this file — 3,824 sessions, 276 comparison
// sessions, 37 page-attributable enquiries, 147 published Developments against
// 611 published legacy Projects — was measured on 2026-08-23 over the window
// this module now defines (2026-05-25 to 2026-08-22 inclusive), the same run as
// the thresholds in types.ts. See
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md. Re-measure before
// leaning on one; they are not preferences and they are not eternal.

const DAY = 86_400_000;

/**
 * The `mute` bar: how many enquiries this class would have to be EXPECTED to
 * produce before observing none is evidence of anything.
 *
 * This is not a measured production threshold like the ones in types.ts — it is
 * a derivation, which is why it lives here and not there. Under a Poisson null
 * with mean λ, the chance of seeing zero is e^-λ: at λ = 0.8 that is 45%, at
 * λ = 0.2 it is 82%. So for a thin class "no enquiry came from here" is the
 * ORDINARY outcome even when nothing is wrong, and a `mute` verdict gated only
 * on a comparison-session count — the plan's original shape — would fire on
 * classes carrying no information at all. e^-3 ≈ 5%, so λ ≥ 3 is the point at
 * which silence is surprising rather than expected.
 *
 * What that actually requires. Since
 * `expectedLeads_c = onwardComparisonSessions_c × siteLeadsPerComparisonSession`
 * and `onwardComparisonSessions_c ≤ siteComparisonSessions`, the tight bound is
 * just `expectedLeads_c ≤ attributedLeads`. So the precondition for `mute` is
 * THREE PAGE-ATTRIBUTABLE ENQUIRIES SITE-WIDE in the window, plus concentration.
 *
 * THIS BRANCH IS REACHABLE, AND THAT IS NEW. The comment this one replaces
 * argued the opposite, on two figures that did not survive checking (both
 * corrected 2026-08-23):
 *
 *  - It read "148 of 179 leads were entered by hand" as "and therefore carry no
 *    page". They do carry one: measured all-time, 141 of the 179 leads have a
 *    non-null `pageSource` and 119 of those resolve to a path — the MANUAL rows
 *    are monday.com imports that kept the URL. Only 38 leads lack the field
 *    entirely. src/lib/crm/compose/generate.ts already recorded "79% of leads
 *    have a pageSource" before this branch existed.
 *  - It put "the realistic page-attributable count in a 90-day window" at nought
 *    to two. In this window it is 47 with a `pageSource`, 38 of them not
 *    soft-deleted, 37 of those resolving to a path.
 *
 * Against 276 site comparison sessions those 37 give λ ≈ 0.134 per comparison
 * session, so a class needs roughly 23 onward comparison sessions before its
 * expectation reaches 3 — and MIN_COMPARISON_SESSIONS already demands 50 of
 * them, which on this window's figures predicts about 6.7. Measured 2026-08-23,
 * `other-landing-page` clears both preconditions outright: 117 onward comparison
 * sessions, expectation 15.7. It reads `healthy` rather than `mute` only because
 * 27 enquiries actually were traced to it. Had those 27 been zero, this module
 * would have emitted `mute` — as it should.
 *
 * So the honest statement is no longer "it cannot fire at this site's volume".
 * It is that one class is already eligible for it, and the next-closest is
 * nine onward sessions short: `homepage` sits at 41 against
 * MIN_COMPARISON_SESSIONS' 50, while its expectation of 5.5 clears THIS bar
 * comfortably. The binding constraint is now that floor, not this one. The
 * fall-through below still exists for the classes that cannot support the
 * verdict, and still says so in words rather than emitting a finding it cannot
 * support.
 */
const MUTE_MIN_EXPECTED_LEADS = 3;

/** Same helper as pageVerdicts.ts, for a different reason. There it is because
 *  `SearchMetric.date` is `@db.Date`; here it is because `PageView.visitorHash`
 *  is salted with the UTC DAY (see src/lib/visitorHash.ts), so a session starts
 *  at UTC midnight. A window bound carrying `now`'s time-of-day would slice the
 *  oldest day in half and hand back sessions whose FIRST ROW IS NOT THEIR ENTRY
 *  PAGE — every entry-page-derived number below would be silently wrong for that
 *  day.
 *
 *  Carries the same warning as the copy in pageVerdicts.ts, because this module
 *  performs exactly the arithmetic that warning protects: DST is a non-issue and
 *  `DAY = 86_400_000` is exact here, since every bound produced by this function
 *  is a UTC-midnight instant and every comparison against it is absolute-ms — no
 *  local calendar is ever consulted. Do NOT "fix" the subtraction below into a
 *  timezone-aware one. Duplicated rather than shared only because the two
 *  modules justify it differently; keep the two copies identical in behaviour. */
const utcMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * The span every figure below covers: WINDOW_DAYS COMPLETE UTC days, the newest
 * of which is yesterday. `windowEnd` is EXCLUSIVE — the first instant the window
 * does not cover — matching `PageVerdictResult.windowEnd`, so display code must
 * subtract a day before printing a date a reader would recognise.
 *
 * Exported because the admin screen shows this module's table directly beneath
 * the page layer's, and until 2026-08-23 it printed the PAGE layer's dates over
 * both. The two windows genuinely differ and the card has to say so itself.
 *
 * Deliberately NOT lagged by GSC_LAG_DAYS the way `getPageVerdicts` is. That lag
 * exists because Google backfills Search Console for two to three days; PageView
 * and Lead are first-party rows written at the moment they happen, so there is
 * nothing to wait for, and holding back three days of them would discard real
 * sessions to match an unrelated source's latency. The consequence is that the
 * two spans END three days apart. They are never joined — but both modules write
 * "in WINDOW_DAYS days" into reason strings an admin reads side by side, so say
 * which source a number came from before comparing them.
 *
 * The newest day IS excluded, and that is not the GSC lag by another name. Today
 * is only partly elapsed, and a session captured mid-visit is counted as an
 * entering session whose onward browsing has not happened yet — it lands in
 * every rate's denominator and in no numerator. One partial day out of ninety
 * cannot move a verdict, but it makes the reason strings' "in 90 days" false and
 * the printed window a day wider than the data, for nothing.
 */
export function classWindow(now: Date = new Date()): { windowStart: Date; windowEnd: Date } {
  const windowEnd = utcMidnight(now);
  return { windowStart: new Date(windowEnd.getTime() - WINDOW_DAYS * DAY), windowEnd };
}

/** Strips query and hash, then a trailing slash, so `/de/`, `/de?x=1` and `/de`
 *  are one path. Without it `/de/` misses the homepage regex in `templateClassOf`
 *  and lands in `other-landing-page`, which is both a wrong class for the entry
 *  page and a wrong denominator for two others. `/` survives as `/`. */
function normalisePath(path: string): string {
  const bare = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return bare === "" ? "/" : bare;
}

/**
 * `Lead.pageSource` is a FULL URL with origin and query string
 * (`https://cyprusvipestates.com/en/projects/x?utm_source=y`); GSC and PageView
 * carry paths. Null when nothing path-shaped can be recovered — such a lead is
 * counted nowhere rather than being silently attributed to the site root.
 *
 * Parsed with `URL` rather than by stripping one hard-coded origin: leads also
 * arrive from `www.`, from `http://`, and from preview deployments, and a
 * prefix check against a single origin would leave those whole URLs to be
 * treated as paths — classifying every one of them as `other-landing-page`,
 * invisibly. The host is deliberately not checked, because every host this
 * field can carry serves the same path structure.
 *
 * Not every non-null `pageSource` survives this: measured 2026-08-23, 141 leads
 * all-time carry the field and 119 resolve to a path, the rest holding free text
 * a monday.com import wrote there ("TikTok", "Friends"). In the 90-day window it
 * is 38 non-deleted with the field and 37 resolving.
 */
function pathFromLeadSource(pageSource: string): string | null {
  const raw = pageSource.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      return new URL(raw).pathname || "/";
    } catch {
      return null;
    }
  }
  return raw.startsWith("/") ? raw : null;
}

const fmt = (n: number): string => n.toLocaleString("en-GB");
const enquiries = (n: number): string => `${fmt(n)} ${n === 1 ? "enquiry" : "enquiries"}`;

/** Every URL shape that serves ONE property. Both a Development and a legacy
 *  Sanity Project live at `/projects/{slug}` in all four locales — the shape is
 *  shared, which is exactly why `templateClassOf` needs a slug set to tell the
 *  two apart and why this module needs one to tell a property from anything
 *  else. Kept beside `propertyOf` rather than reusing the copy inside
 *  `templateClassOf`, because the two answer different questions (see there). */
const PROPERTY_PATH = /^(?:\/(?:de|pl|ru))?\/projects\/([^/]+)$/;

/** Every class gets exactly one verdict, so this list must stay exhaustive.
 *  Declared as a `Record<TemplateClass, number>` and not an array literal: a
 *  sixth class added to the union would leave an array silently short — one
 *  class would vanish from the report with nothing to catch it — whereas the
 *  record fails to compile. The values fix the display order. */
const CLASS_ORDER: Record<TemplateClass, number> = {
  homepage: 1,
  "projects-listing": 2,
  "development-page": 3,
  "blog-post": 4,
  "other-landing-page": 5,
};
const ALL_CLASSES = (Object.keys(CLASS_ORDER) as TemplateClass[]).sort((a, b) => CLASS_ORDER[a] - CLASS_ORDER[b]);

/**
 * `entryClass` is non-nullable because a session cannot exist without one: a
 * Session is only ever constructed while processing a view, and
 * `templateClassOf` is total. The type carries that invariant so no reader has
 * to re-derive it, and so no dead null-branch has to be maintained.
 *
 * The two property sets are the SAME measurement at two scopes, and keeping them
 * apart is the point:
 *  - `properties` — every distinct property in the session, entry page included.
 *    This is the site-level comparison metric — the approved north-star figure,
 *    282 per quarter, 276 on the window this module now measures — and it is not
 *    redefined to suit anything here. See COMPARISON_PROJECT_PAGES in types.ts
 *    for what a property is and for what the Development-only reading cost.
 *  - `onwardProperties` — distinct properties OTHER THAN `entryProperty`, seen
 *    after the entry pageview. This is what a per-class rate must be built on,
 *    because counting the landing property measures a different funnel step for
 *    each class; see `onwardComparisonSessions` in types.ts for the full
 *    argument.
 *
 * `entryProperty` exists only to be excluded from `onwardProperties`, and is
 * null when the session did not land on a property at all — in which case there
 * is nothing to exclude and every property seen is onward.
 *
 * All three hold PROPERTY IDENTITIES, not paths — see `propertyOf`.
 */
type Session = {
  entryClass: TemplateClass;
  entryProperty: string | null;
  properties: Set<string>;
  onwardProperties: Set<string>;
};

export async function getClassVerdicts(now: Date = new Date()): Promise<ClassVerdict[]> {
  const { windowStart, windowEnd } = classWindow(now);

  const [map, developments, projects, views, leads] = await Promise.all([
    buildCanonicalMap(),
    // Deliberately NOT `getInventory()`, and deliberately NOT filtered by
    // `publishStatus`. This set exists to CLASSIFY 90 DAYS OF HISTORY, and the
    // published set is a snapshot of today: a Development unpublished, archived
    // or sold out mid-window would retroactively demote every pageview it ever
    // received to `other-landing-page`, deflating comparison sessions across
    // every class and inflating `other-landing-page`'s entering sessions — a
    // silent shift in `bestRate`, the bar all five classes are judged against,
    // for a reason that has nothing to do with any template. On a site where
    // properties routinely sell out and come down, that is not a corner case.
    // pageVerdicts.ts filtering to published IS correct there, because it only
    // ever classifies pages that are in today's inventory to begin with.
    prisma.development.findMany({ where: { slug: { not: null } }, select: { slug: true } }),
    // Legacy Sanity Projects, and the `status: "PUBLISHED"` filter here is NOT
    // an inconsistency with the unfiltered Development query above — it is the
    // same predicate `getInventory()` uses (inventory.ts), so the two modules
    // agree on which Projects are live, and the historical-classification
    // argument that forbids the filter for Developments does not bite here.
    // Measured 2026-08-23: including the 276 ARCHIVED rows as well changes the
    // site comparison-session count by nought (276 either way) and moves no
    // class figure at all, because archiving a legacy Project writes a
    // `legacy_project_redirects` row and `canonicalize` has already folded its
    // pageviews onto the Development that replaced it before this set is
    // consulted. A Development that comes down has no such successor to be
    // folded onto, which is the whole difference between the two queries.
    //
    // `translationGroupId` is selected because a Project is a PER-LOCALE ROW
    // with a per-locale slug, unlike a Development's one language-agnostic
    // slug — see `propertyOf` for what that costs and how it is paid.
    prisma.project.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, translationGroupId: true },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: windowStart, lt: windowEnd }, isBot: false, isPrefetch: false, isTest: false },
      select: { visitorHash: true, path: true, createdAt: true },
      // `id` is the tie-break, and it is load-bearing: `createdAt` alone leaves
      // rows sharing a timestamp in an order Postgres may return either way, and
      // the FIRST row of each session is read below as its entry page. `id` is
      // an autoincrement written in insertion order, so it settles ties the same
      // way on every run.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.lead.findMany({
      // Three filters, each excluding a different kind of non-evidence.
      //
      // `deletedAt: null` — the soft-delete flag set by the /admin/crm trash
      // flow, documented on the column itself (prisma/schema.prisma) as
      // "excluded from all normal queries", and excluded by every other lead
      // query in this codebase. It was missing here until 2026-08-23, and it
      // was not academic: 9 of the 47 leads carrying a `pageSource` in this
      // window are trashed. `healthy` is gated on nothing more than
      // `leadCount > 0`, so a class whose only traced enquiry was one the
      // operator had explicitly thrown away was certified healthy and printed
      // "1 enquiry came from pages of this class" to say so.
      //
      // `pageSource: { not: null }` — a lead with no page cannot be attributed
      // to a class and is excluded here rather than defaulted anywhere. It is a
      // smaller exclusion than this file used to claim: 141 of 179 leads
      // all-time DO carry the field, monday.com's MANUAL imports included.
      //
      // `Lead.status` is never read: the operator ruled it unusable as a
      // scoring basis.
      where: { createdAt: { gte: windowStart, lt: windowEnd }, deletedAt: null, pageSource: { not: null } },
      select: { pageSource: true },
    }),
  ]);

  const devSlugs = new Set(developments.map((d) => d.slug).filter((slug): slug is string => slug !== null));

  /**
   * Slug → property identity, for legacy Projects only.
   *
   * A Development carries ONE language-agnostic slug and is reachable in all
   * four locales under it (developmentSeo.ts), so its slug IS its identity. A
   * Project is a per-locale row carrying a per-locale slug, so one property can
   * appear as up to four different slugs — measured 2026-08-23, 11 of the 154
   * published translation groups do:
   * `villas-cap-st-georges-resort` / `villen-…` / `wille-…` / `villy-…` are one
   * property in four languages. Keyed by slug, a visitor using the language
   * switcher on a single legacy property would register as having compared two,
   * which is precisely the buying signal this module exists to count.
   * `translationGroupId` is that property's identity across locales and every
   * published Project row has one.
   *
   * Namespaced with a `project:` prefix so the fallback for a row without a
   * group can never collide with a Development slug used as an identity.
   */
  const projectProperties = new Map<string, string>();
  for (const project of projects) {
    projectProperties.set(project.slug, `project:${project.translationGroupId ?? project.slug}`);
  }

  /**
   * "Is this path a property page, and if so WHICH property" — the question
   * this module needs, and it is NOT the question `templateClassOf` answers.
   *
   * `templateClassOf` returns `development-page` only for a slug that is a known
   * Development, and that is right for what it is for: a legacy Project at
   * `/projects/{slug}` renders through completely different components, so
   * grouping the two together would mix two unrelated templates' Core Web Vitals
   * into one number, and `development-page` as a CLASS LABEL honestly names
   * Development pages. This module reused that class to mean "this pageview is a
   * property", and it is not. Measured 2026-08-23: 147 published Developments
   * against 611 published legacy Projects, and in this window 1,296 pageviews on
   * Development property pages against 1,526 on legacy ones. Reading only the
   * Developments made more than half of all property browsing invisible to the
   * onward metric, put every session entering on a legacy property into
   * `other-landing-page`'s denominator with its property browsing in no
   * numerator, and scored a session comparing two legacy properties at nought
   * while the same journey among Developments scored two. It also failed to
   * reproduce the module's own approved north-star: this window holds 276
   * comparison sessions on the spec's definition and the Development-only
   * reading found 106.
   *
   * The two concepts are genuinely different and must stay separate. Do not
   * "simplify" this back into a call to `templateClassOf`, and do not widen
   * `templateClassOf` to match it — that would put legacy Projects into the
   * Development CWV bucket, which is the defect it was written to prevent.
   *
   * The Development wins a slug collision, which is the same rule and the same
   * reason as `KIND_PRIORITY` in inventory.ts: during a supersede window both
   * rows can hold one slug, and the Development is what the dispatcher actually
   * serves (src/app/[lang]/projects/[slug]/page.tsx). Because the identity IS
   * the slug on that branch, the collision collapses to one property rather than
   * being counted as two. A Project superseded by a Development under a
   * DIFFERENT slug is handled a step earlier — `canonicalize` folds the old path
   * onto the new one before this is called. (Measured 2026-08-23: 16 published Project rows
   * carry a slug that is also a Development slug, none of them inside a
   * multi-slug translation group.)
   */
  const propertyOf = (path: string): string | null => {
    const match = path.match(PROPERTY_PATH);
    if (match === null) return null;
    const slug = match[1];
    if (devSlugs.has(slug)) return slug;
    return projectProperties.get(slug) ?? null;
  };

  const classify = (rawPath: string): { path: string; cls: TemplateClass } => {
    const path = normalisePath(rawPath);
    // The locale here is INERT — `canonicalize` returns it untouched when
    // nothing matches and re-derives it from the final path when something
    // does, and this module reads only `target.page`. `localeOfPath` rather
    // than `deriveLocale` all the same: that is the join-key convention for
    // every source (see its doc comment in urlCanonical.ts), and a module that
    // quietly uses the other one is one edit away from being wrong.
    const target = canonicalize(map, localeOfPath(path), path);
    return { path: target.page, cls: templateClassOf(target.page, devSlugs) };
  };

  // `visitorHash` is sha256(salt | UTC-day | ip | userAgent) — see
  // src/lib/visitorHash.ts. It biases in BOTH directions and both belong on the
  // record, because everything below is built on it:
  //  - It DEFLATES. The hash rotates at UTC midnight, so a "session" is one
  //    visitor-DAY. Multi-day research counts more than once, and returning
  //    visitors — a return to the same property being one of the strongest
  //    buying signals there is — are invisible entirely.
  //  - It INFLATES. The identity is really one (IP, user-agent)-day, not one
  //    person. Two people behind a single NAT or CGNAT egress on the same
  //    user-agent — two iPhones on one carrier, an office, a household — merge
  //    into one pseudo-session that inherits the UNION of their property views
  //    and the entry class of whichever loaded first. That manufactures
  //    comparison sessions out of unrelated visitors and misattributes the
  //    grouping key, hitting the numerator and the denominator at once.
  // Both are ceilings of a deliberately cookieless, PII-free design, not defects
  // to route around here. The day sitting inside the preimage does make the hash
  // alone a safe key ACROSS days — that, and nothing more, is what it buys.
  const sessions = new Map<string, Session>();
  for (const view of views) {
    // A row with no hash cannot be grouped into a session at all. Treated as a
    // session of its own it would add a phantom entering session that can never
    // become a comparison one, deflating every rate; dropped, it costs only
    // itself. The current writer always sets the field
    // (src/app/api/analytics/track/route.ts computes it unconditionally on every
    // insert), so a null can only be historical, and the column is nullable for
    // that history alone.
    if (!view.visitorHash) continue;
    const { path, cls } = classify(view.path);
    // Keyed by PROPERTY, not path — see `propertyOf`. A property is one property
    // in all four locales, so `/projects/x` and `/de/projects/x` must not count
    // as two.
    const property = propertyOf(path);

    const session = sessions.get(view.visitorHash);
    if (session === undefined) {
      // Rows arrive oldest-first, so the first one seen for a hash is the entry
      // pageview. `templateClassOf` is total — anything it does not recognise
      // becomes `other-landing-page` — so no session is ever dropped for having
      // entered on an unknown page. The cost is that `other-landing-page` is a
      // catch-all that also absorbs utility pages (/book/<token>, thank-you
      // pages) and, because `templateClassOf` splits by RENDERING TEMPLATE, every
      // legacy `/projects/<slug>` page too. Those legacy entries are property
      // entries and are handled as such by `propertyOf` above — the class label
      // is about the template, not about whether a property was seen.
      // Filtering entries down to the CMS inventory instead would shrink the
      // session denominator invisibly, which is the worse trade.
      sessions.set(view.visitorHash, {
        entryClass: cls,
        entryProperty: property,
        properties: property === null ? new Set<string>() : new Set<string>([property]),
        // The entry pageview is by definition not onward, so this starts empty
        // even when the session landed ON a property.
        onwardProperties: new Set<string>(),
      });
      continue;
    }
    if (property !== null) {
      session.properties.add(property);
      // The landing property is excluded from the onward set for the whole
      // session, not just for its first pageview. `land on x → view y → back to
      // x` is ordinary browsing, and counting that return would let a session
      // entering on a property reach the threshold on ONE further property
      // while every other class still needs two — the same asymmetry, smaller,
      // and running the same direction.
      if (property !== session.entryProperty) session.onwardProperties.add(property);
    }
  }

  const entering = new Map<TemplateClass, number>();
  const onwardComparing = new Map<TemplateClass, number>();
  let siteComparisonSessions = 0;
  for (const session of Array.from(sessions.values())) {
    entering.set(session.entryClass, (entering.get(session.entryClass) ?? 0) + 1);
    // Two different counts on purpose — see the `Session` doc comment. A session
    // reaching COMPARISON_PROJECT_PAGES onward necessarily reaches it overall,
    // so the onward counts are a subset of the site total, never a rival to it.
    if (session.properties.size >= COMPARISON_PROJECT_PAGES) siteComparisonSessions++;
    if (session.onwardProperties.size >= COMPARISON_PROJECT_PAGES) {
      onwardComparing.set(session.entryClass, (onwardComparing.get(session.entryClass) ?? 0) + 1);
    }
  }

  // A lead is attributed to the class of the page its FORM sat on, because that
  // is the only link the data supports — PageView and Lead share no session key,
  // so a lead can never be traced back to the journey that produced it. The
  // limitation is real and worth stating: a comparison session spans several
  // classes, and this credits the last one. A blog post that started the
  // research and a development page that closed it both count as the
  // development page. Read the count as "enquiries sent FROM this class", never
  // as "enquiries this class earned".
  //
  // A second mismatch follows from it and matters to `mute` below: the lead
  // count is scoped by the page the FORM sat on, while the expectation it is
  // judged against is built from sessions that ENTERED on the class. A class
  // that hosts most of the site's enquiry forms but receives few entries is
  // therefore measured against an expectation built from someone else's traffic,
  // in both directions. The two cannot be reconciled without a session-to-lead
  // key, which the data does not have — so the bar is set where a mismatch of
  // this size cannot manufacture a verdict on its own.
  const leadsByClass = new Map<TemplateClass, number>();
  let attributedLeads = 0;
  for (const lead of leads) {
    // The `where` clause already excludes nulls; checked again rather than cast
    // away, because a cast is a claim the compiler cannot check and this one
    // would fail as an empty-string path if the filter were ever loosened.
    if (lead.pageSource === null) continue;
    const path = pathFromLeadSource(lead.pageSource);
    if (path === null) continue;
    const { cls } = classify(path);
    leadsByClass.set(cls, (leadsByClass.get(cls) ?? 0) + 1);
    attributedLeads++;
  }

  /**
   * The null model behind `mute`: page-attributable enquiries spread across the
   * classes in proportion to onward-comparison volume. A yardstick for "would
   * zero have been surprising", not a causal claim.
   *
   * ITS NAME IS AN AMBITION, NOT A MEASUREMENT, and the gap runs both ways.
   * The numerator counts every page-attributable enquiry on the site, from ALL
   * sessions — one-page visits and comparison sessions alike — while the
   * denominator counts comparison sessions only. It is therefore an upper bound
   * on the real enquiries-per-comparison-session, and an upper bound in the
   * expectation makes `mute` EASIER to reach, which is the unsafe direction.
   * Running against it, the volume this figure multiplies is onward-only while
   * the denominator is the site-level metric, so the per-class expectations sum
   * to LESS than `attributedLeads` rather than exactly to it: measured
   * 2026-08-23 they sum to 28.2 against 37 attributed. Net, the arithmetic still
   * under-claims, but not by construction — check both halves before leaning on
   * it, and re-check them if either scope changes.
   *
   * It cannot be MADE what its name says: `Lead` and `PageView` share no session
   * key, so the enquiries produced BY comparison sessions are not identifiable
   * at all (the same missing key documented above the attribution loop). Naming
   * it for the scope of its denominator is the closest honest description. The
   * site-level metric is the approved north-star figure and is not rescoped to
   * tidy up this arithmetic.
   */
  const siteLeadsPerComparisonSession = siteComparisonSessions > 0 ? attributedLeads / siteComparisonSessions : 0;

  // The true observed rate for EVERY class, including those below the floor —
  // it is a fact about the class either way, and reporting it keeps NaN out of
  // the record entirely (a NaN would serialise to null and break any consumer
  // calling toFixed on it). The floors govern whether it may be JUDGED and
  // whether it may set the bar, both decided below.
  const rates = new Map<TemplateClass, number>();
  for (const cls of ALL_CLASSES) {
    const e = entering.get(cls) ?? 0;
    rates.set(cls, e > 0 ? (100 * (onwardComparing.get(cls) ?? 0)) / e : 0);
  }

  /**
   * Which classes are allowed to SET the bar — the same evidence floor the bar
   * then imposes on everyone else, applied to the class setting it.
   *
   * Until 2026-08-23 only MIN_ENTERING_SESSIONS gated this, and MIN_EXPECTED_ONWARD
   * gated the class being JUDGED. So a class the module refused to judge could
   * still decide what everybody else was judged against. That is not a
   * hypothetical: on this window `projects-listing` is `unjudged` — 12 onward
   * sessions cannot support a verdict either way — and its 11.0% is the highest
   * rate on the site, so as the benchmark it would make `development-page`
   * `repelling` at 5.1% against a bar drawn from evidence the tool would not
   * accept about `projects-listing` itself. A bar nobody is allowed to be judged on is not a
   * bar.
   *
   * Measured on the class's OWN onward count rather than on `expectedOnward`,
   * which would be circular — `expectedOnward` is defined in terms of `bestRate`
   * and `bestRate` is what this is choosing. The two coincide exactly where it
   * matters: for the class that sets the bar,
   * `expectedOnward = enteringSessions × rate = onwardComparisonSessions`. So
   * this is MIN_EXPECTED_ONWARD evaluated at the benchmark class, not a second,
   * looser floor wearing its name.
   */
  const benchmarkClasses = ALL_CLASSES.filter(
    (cls) => (entering.get(cls) ?? 0) >= MIN_ENTERING_SESSIONS && (onwardComparing.get(cls) ?? 0) >= MIN_EXPECTED_ONWARD,
  );
  const bestRate = Math.max(0, ...benchmarkClasses.map((cls) => rates.get(cls) ?? 0));

  return ALL_CLASSES.map((cls): ClassVerdict => {
    const enteringSessions = entering.get(cls) ?? 0;
    const onwardComparisonSessions = onwardComparing.get(cls) ?? 0;
    const onwardComparisonRate = rates.get(cls) ?? 0;
    const leadCount = leadsByClass.get(cls) ?? 0;
    const expectedLeads = onwardComparisonSessions * siteLeadsPerComparisonSession;
    // What this class WOULD have produced at the best class's rate. The bar the
    // `repelling` test moves against, and therefore the right quantity to size
    // the evidence on: a rate can only be told from the bar when the bar itself
    // predicts enough events. For the best class it equals its own observed
    // count exactly, which is the sanity check on the formula — and, since
    // 2026-08-23, also the eligibility test for setting the bar at all.
    const expectedOnward = (enteringSessions * bestRate) / 100;
    const base = {
      templateClass: cls,
      enteringSessions,
      onwardComparisonSessions,
      onwardComparisonRate,
      attributableLeads: leadCount,
    };

    if (enteringSessions < MIN_ENTERING_SESSIONS) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `Only ${fmt(enteringSessions)} sessions entered the site here in ${WINDOW_DAYS} days — below the ${MIN_ENTERING_SESSIONS} needed to judge.`,
      };
    }

    // A zero bar means no class cleared BOTH benchmark floors with a single
    // session going onward to two properties. Left to fall through, every
    // comparison of the form `0 < 0 * 0.5` is false and each of these classes
    // would be certified against a benchmark that does not exist. Today the
    // MIN_COMPARISON_SESSIONS branch below would happen to catch them — but on a
    // floor over a different quantity, by coincidence, and coincidence is not a
    // guard.
    if (!(bestRate > 0)) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `No template class carries enough evidence to set a benchmark — that needs ${MIN_ENTERING_SESSIONS} entering sessions and ${MIN_EXPECTED_ONWARD} of them going on to two or more properties other than the one they landed on, and in ${WINDOW_DAYS} days none did — so there is nothing to measure this one against.`,
      };
    }

    // Gates the WHOLE engagement axis, not just `repelling`. MIN_ENTERING_SESSIONS
    // bounds the denominator of the rate and nothing bounded the numerator, so a
    // class could clear that floor and still be judged on a handful of onward
    // sessions — measured 2026-08-23, `projects-listing` is judged on 12 (see
    // MIN_EXPECTED_ONWARD in types.ts for the false-alarm table). Blocking only
    // the `repelling` branch would hand the same class `healthy` on the same
    // non-evidence with the sign flipped, since that branch asks only for a
    // traced enquiry. Thin evidence is no more evidence for healthy than against
    // it, so neither verdict is available here and the reason says so outright.
    //
    // Returning `unjudged` rather than falling through to the lead axis hides
    // nothing: `onwardComparisonSessions >= MIN_COMPARISON_SESSIONS` would force
    // this class's own rate to at least 50/enteringSessions, hence
    // `expectedOnward = enteringSessions × bestRate ≥ 50` since `bestRate` is the
    // maximum over benchmark-eligible classes — well above this floor. A class
    // gated here can therefore never have been eligible for `mute` anyway.
    if (expectedOnward < MIN_EXPECTED_ONWARD) {
      const engagement = `${fmt(onwardComparisonSessions)} of the ${fmt(enteringSessions)} sessions entering here went on to two or more properties other than their landing page, where the strongest class's rate predicts about ${expectedOnward.toFixed(0)} — below the ${MIN_EXPECTED_ONWARD} expected needed before that gap can be told from chance, so this class is not judged on engagement in either direction.`;
      return {
        ...base,
        diagnosis: "unjudged",
        reason: leadCount > 0
          ? `${engagement} ${enquiries(leadCount)} came from pages of this class, too few to stand as a verdict alone.`
          : engagement,
      };
    }

    if (onwardComparisonRate < bestRate * CLASS_RATE_FRACTION) {
      return {
        ...base,
        diagnosis: "repelling",
        reason: `${onwardComparisonRate.toFixed(1)}% of the ${fmt(enteringSessions)} sessions entering here go on to view two or more different properties OTHER THAN the page they landed on, against ${bestRate.toFixed(1)}% for the strongest class — landing layout and internal routes to further properties.`,
      };
    }

    // Positive evidence needs no sample-size floor: MIN_COMPARISON_SESSIONS
    // exists to stop an ABSENCE of leads being read as a finding, and there is
    // no absence here.
    if (leadCount > 0) {
      return {
        ...base,
        diagnosis: "healthy",
        reason: `${onwardComparisonRate.toFixed(1)}% of sessions entering here go on to two or more properties other than their landing page, in line with the ${bestRate.toFixed(1)}% best, and ${enquiries(leadCount)} came from pages of this class.`,
      };
    }

    if (onwardComparisonSessions < MIN_COMPARISON_SESSIONS) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `${fmt(onwardComparisonSessions)} sessions entered here and went on to two or more properties other than their landing page — below the ${MIN_COMPARISON_SESSIONS} needed to judge whether this class produces enquiries.`,
      };
    }

    if (expectedLeads >= MUTE_MIN_EXPECTED_LEADS) {
      return {
        ...base,
        diagnosis: "mute",
        reason: `${fmt(onwardComparisonSessions)} sessions entered here and went on to two or more properties other than their landing page, which at the site's own rate of enquiries traceable to a page should have produced about ${expectedLeads.toFixed(1)} — none came from a page of this class. Offer, call to action, contact path.`,
      };
    }

    // Where the plan would have emitted `mute` unconditionally. See
    // MUTE_MIN_EXPECTED_LEADS: for a class this thin, zero is the expected
    // outcome even when nothing is wrong, so the honest report is what the
    // evidence cannot support, not a finding.
    return {
      ...base,
      diagnosis: "unjudged",
      reason: `The whole site produced ${enquiries(attributedLeads)} traceable to a page from ${fmt(siteComparisonSessions)} comparison sessions in ${WINDOW_DAYS} days (enquiries reaching us by phone or WhatsApp carry no page and are not counted), so the ${fmt(onwardComparisonSessions)} sessions that entered here and went on to two or more properties other than their landing page would be expected to produce about ${expectedLeads.toFixed(1)} — too few for its zero to mean anything.`,
    };
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/pagePower/classVerdicts.ts
git commit -m "Page Power: per-class diagnoses (repelling, mute)"
```

---

## Task 5: Verify against live data

**Requires the production tunnel on `localhost:5433`.** Read-only.

**Files:**
- Create (temporary, deleted in this task): `src/app/api/page-power-probe/route.ts`
- Create: `scripts/verify-page-power.mjs`

- [ ] **Step 1: Create the temporary probe route**

A folder starting with `_` is a Next.js private folder and will not route — name
it exactly as below.

It stays out of the repo on purpose: it dumps every page's search performance
with no auth, and there is no reason to carry that on a production build for the
sake of a diagnostic. The script in Step 2 holds this exact source and prints it
on every failure path, so re-creating it later is a copy rather than a search
through this plan.

```typescript
// TEMPORARY — created and deleted around a run of scripts/verify-page-power.mjs.
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { getInventory } from "@/lib/seo/pagePower/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const [pages, classes, inventory] = await Promise.all([
    getPageVerdicts(), getClassVerdicts(), getInventory(),
  ]);
  return Response.json({ ...pages, classes, inventory: inventory.map((p) => p.path) });
}
```

- [ ] **Step 2: Write the invariant script**

```javascript
// READ-ONLY. Checks the Page Power output against the invariants in
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md.
//
// THIS SCRIPT NEEDS A ROUTE THAT IS NOT IN THE REPO, ON PURPOSE. TypeScript
// modules cannot be imported from a plain .mjs script, so the only way to
// exercise the real modules rather than a re-implementation of them is through
// the running app — and a permanently mounted route that dumps every page's
// search performance is not something to leave on a production build for the
// sake of a diagnostic. Task 5 of the plan therefore creates it, uses it and
// deletes it.
//
// What used to happen when someone ran this afterwards was a JSON parse error
// on Next's 404 page and no hint at all. Now the route's full source is below
// and every failure path prints it. Re-create it, run this, delete it again.
const PROBE_PATH = "src/app/api/page-power-probe/route.ts";
const PROBE_SOURCE = `// TEMPORARY — created and deleted around a run of scripts/verify-page-power.mjs.
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { getInventory } from "@/lib/seo/pagePower/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const [pages, classes, inventory] = await Promise.all([
    getPageVerdicts(), getClassVerdicts(), getInventory(),
  ]);
  return Response.json({ ...pages, classes, inventory: inventory.map((p) => p.path) });
}
`;

const BASE = process.env.PROBE_BASE ?? "http://localhost:3011";

// Recorded from production on 2026-08-23, with the tunnel on localhost:5433 and
// NEW_PROJECTS_INDEXABLE=true. Diagnosis counts move every day — they are
// printed against this, never asserted against it. The PAGE COUNT is asserted,
// loosely, because the one way it moves by tens of percent is a misconfigured
// run rather than a changed site: with NEW_PROJECTS_INDEXABLE unset the
// inventory silently drops all 588 Development pages and every count below is
// wrong in a way that reads like a finding. That is not hypothetical; it is how
// this baseline was first mis-measured.
const BASELINE = {
  measured: "2026-08-23",
  pages: 1691,
  coveragePct: 99.1,
  publishedInsideWindow: 690,
  sitemapUrls: 1691,
  diagnoses: { buried: 79, healthy: 39, invisible: 1125, unclicked: 12, unjudged: 436 },
};
const PAGE_COUNT_DRIFT = 0.25;

const SITEMAP_TYPES = ["projects", "blog", "pages", "developers", "case-studies", "developments"];
const SITE_ORIGIN = "https://cyprusvipestates.com";

function bail(what, detail) {
  console.error(`\nCANNOT VERIFY: ${what}`);
  console.error(`  ${detail}\n`);
  console.error(`The probe route this script reads is deliberately not committed. To run this:`);
  console.error(`\n  1. Create ${PROBE_PATH} containing exactly:\n`);
  console.error(PROBE_SOURCE.split("\n").map((l) => `     ${l}`).join("\n"));
  console.error(`  2. Open the production tunnel on localhost:5433 and start the app with the`);
  console.error(`     repo-root .env.local in place and NEW_PROJECTS_INDEXABLE=true:\n`);
  console.error(`       NEW_PROJECTS_INDEXABLE=true npx next dev -p 3011\n`);
  console.error(`  3. node scripts/verify-page-power.mjs        (PROBE_BASE overrides ${BASE})`);
  console.error(`  4. rm -rf ${PROBE_PATH.replace(/\/route\.ts$/, "")}\n`);
  process.exit(2);
}

async function getJson(path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(180000) });
  } catch (err) {
    bail(`${BASE}${path} is not answering`, `${err.name}: ${err.message} — is the dev server up on ${BASE}?`);
  }
  // 500 rather than 404 is the EXPECTED shape of "the route is not there": an
  // unmatched `/api/...` path falls through to the `[lang]/[...slug]` catch-all,
  // which asks Prisma for a Singlepage in the locale "api" and throws. So both
  // statuses point at the same missing file, and neither is worth telling apart.
  if (!res.ok) bail(`${BASE}${path} returned HTTP ${res.status}`, "almost certainly the probe route is not mounted — it is not committed, see below");
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    bail(`${BASE}${path} did not return JSON`, `first 120 characters: ${JSON.stringify(text.slice(0, 120))}`);
  }
}

const r = await getJson("/api/page-power-probe");
if (!Array.isArray(r.verdicts)) bail("the probe returned JSON without a `verdicts` array", `keys: ${Object.keys(r).join(", ")}`);
if (!Array.isArray(r.inventory)) bail("the probe returned no `inventory` array", "re-create the route from the source above — it gained an `inventory` field on 2026-08-23");

// "What we tell Google exists" against "what Page Power judges". This is the
// check that exists because the fixed-page list was caught short three times
// (see FIXED_PAGES in src/lib/seo/pagePower/inventory.ts): coverage cannot catch
// an omission, because coverage is a share of CLICKS and the pages that go
// missing are the ones with none. Every `<loc>` the sitemap emits must be an
// inventory path, and nothing may be in the inventory that the sitemap does not
// advertise — the second direction catches a page being judged that the site is
// not asking to have indexed.
const sitemapPaths = new Set();
for (const type of SITEMAP_TYPES) {
  let res;
  try {
    res = await fetch(`${BASE}/sitemaps/${type}.xml`, { signal: AbortSignal.timeout(180000) });
  } catch (err) {
    bail(`${BASE}/sitemaps/${type}.xml is not answering`, `${err.name}: ${err.message}`);
  }
  if (!res.ok) bail(`${BASE}/sitemaps/${type}.xml returned HTTP ${res.status}`, "the sitemap route is part of the app, not of the probe");
  const xml = await res.text();
  for (const m of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) {
    if (!m[1].startsWith(SITE_ORIGIN)) continue;
    sitemapPaths.add(m[1].slice(SITE_ORIGIN.length) || "/");
  }
}

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const counts = {};
for (const v of r.verdicts) counts[v.diagnosis] = (counts[v.diagnosis] ?? 0) + 1;
console.log(`pages: ${r.verdicts.length}`);
for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k.padEnd(10)} ${n}`);
console.log(`coverage: ${r.coveragePct.toFixed(1)}%`);
console.log(`window: ${r.windowStart.slice(0, 10)} .. ${r.windowEnd.slice(0, 10)}`);
console.log(`published inside the window: ${r.publishedInsideWindow?.length ?? "(field missing)"}`);
console.log(`sitemap URLs: ${sitemapPaths.size}`);
console.log("\nclasses:");
for (const c of r.classes) console.log(`  ${c.templateClass.padEnd(20)} ${c.diagnosis.padEnd(9)} entering=${c.enteringSessions} onward=${c.onwardComparisonSessions} tracedLeads=${c.attributableLeads}`);

// Printed, not asserted: these move with the site. A run that looks nothing like
// this one is worth a second look before its numbers are quoted anywhere.
const drift = (now, then) => (now === then ? " (unchanged)" : ` (${now > then ? "+" : ""}${(now - then).toLocaleString("en-GB")} vs ${BASELINE.measured})`);
console.log(`\nagainst the ${BASELINE.measured} baseline:`);
console.log(`  pages      ${r.verdicts.length}${drift(r.verdicts.length, BASELINE.pages)}`);
console.log(`  coverage   ${r.coveragePct.toFixed(1)}% (was ${BASELINE.coveragePct}%)`);
console.log(`  sitemap    ${sitemapPaths.size}${drift(sitemapPaths.size, BASELINE.sitemapUrls)}`);
console.log(`  too young  ${r.publishedInsideWindow?.length ?? 0}${drift(r.publishedInsideWindow?.length ?? 0, BASELINE.publishedInsideWindow)}`);
for (const [k, then] of Object.entries(BASELINE.diagnoses)) console.log(`  ${k.padEnd(10)} ${counts[k] ?? 0}${drift(counts[k] ?? 0, then)}`);

const VALID = ["invisible", "buried", "unclicked", "healthy", "unjudged"];
check(r.verdicts.every((v) => VALID.includes(v.diagnosis)), "a page carries a diagnosis outside the allowed set");
check(r.verdicts.every((v) => v.key === `${v.locale}::${v.path}`), "a page key does not match its locale and path");
check(new Set(r.verdicts.map((v) => v.key)).size === r.verdicts.length, "duplicate page keys — the inventory is not deduplicated");
check(r.coveragePct >= 85, `coverage ${r.coveragePct.toFixed(1)}% is below the 85% floor — new redirects the canonical map does not know`);
check(r.verdicts.filter((v) => v.diagnosis === "buried").every((v) => v.position > 20), "a buried page has a position of 20 or better");
check(r.verdicts.filter((v) => v.diagnosis === "unclicked").every((v) => v.impressions >= 300), "an unclicked page is below the 300-impression floor");
check(r.verdicts.filter((v) => v.diagnosis === "invisible").every((v) => v.impressions < 10), "an invisible page has 10 or more impressions");
check(r.verdicts.every((v) => v.reason && v.reason.length > 0), "a verdict has no reason text");

const inventoryPaths = new Set(r.inventory);
const missingFromInventory = Array.from(sitemapPaths).filter((p) => !inventoryPaths.has(p));
const missingFromSitemap = Array.from(inventoryPaths).filter((p) => !sitemapPaths.has(p));
check(missingFromInventory.length === 0, `${missingFromInventory.length} URL(s) the sitemap advertises are not in the inventory, so no verdict can ever be emitted for them — add them to FIXED_PAGES or to the query that should have produced them: ${missingFromInventory.slice(0, 12).join(", ")}`);
check(missingFromSitemap.length === 0, `${missingFromSitemap.length} inventory page(s) the sitemap does not advertise, so Page Power is judging pages the site is not asking Google to index: ${missingFromSitemap.slice(0, 12).join(", ")}`);

const young = new Set(r.publishedInsideWindow ?? []);
const verdictKeys = new Set(r.verdicts.map((v) => v.key));
check(Array.isArray(r.publishedInsideWindow), "the probe returned no `publishedInsideWindow` array — the publication-age guard is not reporting");
check(young.size === (r.publishedInsideWindow ?? []).length, "duplicate keys in publishedInsideWindow");
check(Array.from(young).every((k) => verdictKeys.has(k)), "publishedInsideWindow names a key that is not a verdict");
// The guard must never CHANGE a diagnosis, only the sentence under it and the
// Action Center's count — see PageVerdictResult.publishedInsideWindow.
check(
  r.verdicts.filter((v) => v.diagnosis === "invisible" && young.has(v.key)).every((v) => v.reason.startsWith("Published ")),
  "an invisible page published inside the window does not carry the publication-age reason",
);
check(
  r.verdicts.filter((v) => v.diagnosis === "invisible" && !young.has(v.key)).every((v) => !v.reason.startsWith("Published ")),
  "a page carries the publication-age reason without being in publishedInsideWindow",
);

check(
  Math.abs(r.verdicts.length - BASELINE.pages) <= BASELINE.pages * PAGE_COUNT_DRIFT,
  `the inventory is ${r.verdicts.length} pages against ${BASELINE.pages} on ${BASELINE.measured}, more than ${PAGE_COUNT_DRIFT * 100}% apart. The usual cause is NEW_PROJECTS_INDEXABLE being unset, which drops every Development page from the inventory and makes every count above wrong`,
);

console.log(failures.length ? `\n${failures.length} FAILURE(S):` : "\nall invariants hold");
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 3: Start the dev server and run the script**

```bash
ln -sfn /Users/sashadith/cvp-analysis/node_modules node_modules
cp /Users/sashadith/cvp-analysis/.env.local .env.local
NEW_PROJECTS_INDEXABLE=true nohup npx next dev -p 3011 > /tmp/pp-dev.log 2>&1 & disown
sleep 25
node scripts/verify-page-power.mjs
```

`NEW_PROJECTS_INDEXABLE=true` is not optional and is not in `.env.local`.
Without it `getInventory` returns no Development pages at all and the run is
1,107 pages instead of 1,691 — every count below is then wrong in a way that
reads like a finding rather than like a misconfiguration. The script fails on a
page count more than 25% from its recorded baseline and names this as the likely
cause.

Expected on first run: it may fail. Read each failure and fix the module it
names — do not relax an invariant to make it pass. The coverage floor in
particular is a real signal: if it reports below 85%, the canonical map is
missing redirects and the join is wrong, not the threshold. The sitemap check is
the same kind of signal for the opposite failure: it compares the inventory with
every `<loc>` the six sitemaps emit, and a mismatch means a URL the site asks
Google to index that Page Power can never emit a verdict for — the omission that
has been caught three times by hand.

- [ ] **Step 4: Re-run until every invariant holds**

Run: `node scripts/verify-page-power.mjs`
Expected: `all invariants hold`, exit 0.

Recorded on 2026-08-23, and printed as a drift comparison on every later run:
1,691 pages, coverage 99.1%, 690 published inside the window, 1,691 sitemap
URLs, and `invisible` 1,125 / `unjudged` 436 / `buried` 79 / `healthy` 39 /
`unclicked` 12.

- [ ] **Step 5: Remove the probe route and stop the server**

```bash
pkill -f "next dev -p 3011"
rm -rf src/app/api/page-power-probe .next node_modules .env.local
```

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-page-power.mjs
git commit -m "Page Power: live-data invariant checks"
```

---

## Task 6: Calibration gate

Nothing surfaces to a user until this passes. This is the step that caught
`abiete-2` (a development named "Abiete 2", read as a unit count) and
velaro-homes' furniture package in the stale-figures work — both would have
shipped as confident nonsense.

**Files:** none created. This task produces a written verdict.

- [ ] **Step 1: Re-create the probe route and dump the top entries**

Re-create `src/app/api/page-power-probe/route.ts` exactly as in Task 5 Step 1,
start the dev server as in Task 5 Step 3, then:

```bash
node -e '
const r = await (await fetch("http://localhost:3011/api/page-power-probe",{signal:AbortSignal.timeout(180000)})).json();
for (const d of ["buried","unclicked","invisible"]) {
  const rows = r.verdicts.filter(v=>v.diagnosis===d).sort((a,b)=>b.impressions-a.impressions).slice(0,10);
  console.log(`\n=== ${d} — top 10 of ${r.verdicts.filter(v=>v.diagnosis===d).length}`);
  for (const v of rows) console.log(`  ${String(v.impressions).padStart(6)} impr  pos ${(v.position??0).toFixed(1).padStart(5)}  CTR ${v.ctr.toFixed(2).padStart(5)}%  ${v.key}`);
}' --input-type=module
```

- [ ] **Step 2: Judge each entry by hand**

For each of the 30 rows, open the URL and decide: is this diagnosis correct?
Record a yes or no per row. Precision must be **at least 80% per diagnosis**.

Known-good anchors from the spec — if these do not appear as `buried`, the
implementation is wrong:

```
/off-plan-properties-in-paphos    5,078 impressions, position 33.2
/villas-in-cyprus                 2,270 impressions, position 39.9
/off-plan-properties-in-limassol  1,660 impressions, position 47.2
```

- [ ] **Step 3: If precision is below 80%, adjust and return to Task 5**

Adjust the thresholds in `src/lib/seo/pagePower/types.ts` — never the
invariants. Record what changed and why in the commit message. Then re-run
Task 5 Step 4 before returning here.

- [ ] **Step 4: Record the result and clean up**

```bash
pkill -f "next dev -p 3011"
rm -rf src/app/api/page-power-probe .next node_modules .env.local
```

Append the calibration result to the spec under a new "Calibration
2026-xx-xx" heading: the counts per diagnosis, the precision per diagnosis, and
any threshold that moved.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-23-seo-page-power-design.md src/lib/seo/pagePower/types.ts
git commit -m "Page Power: calibration result and threshold adjustments"
```

---

## Task 7: Admin screen

**Files:**
- Create: `src/app/admin/(panel)/analytics/seo/power/page.tsx`
- Create: `src/app/admin/(panel)/analytics/seo/power/PagePowerTable.tsx`
- Modify: `src/app/admin/(panel)/layout.tsx` (nav entry — the screen is otherwise
  reachable only by typing the URL; Task 8's deep links assume it is in the panel)

- [ ] **Step 1: Create the table client component**

```tsx
"use client";

import { useMemo, useState } from "react";
import { templateClassOf } from "@/lib/seo/templateClass";
import type { PageDiagnosis } from "@/lib/seo/pagePower/types";

/** Exactly the fields this table renders — deliberately narrower than
 *  `PageVerdict`. Every field crosses the RSC boundary 1,679 times: measured
 *  against production on 2026-08-23 the nine below serialise to 581KB, and
 *  carrying `clicks` and `templateClass` too — neither is displayed, and the
 *  by-class table under this one answers the template question — took it to
 *  658KB for nothing. Add a field here when a column shows it, not before. */
export type Row = {
  key: string;
  locale: string;
  /** As served, locale prefix included — see `PageKey` in pagePower/types.ts.
   *  English is prefix-less, de/pl/ru are not. */
  path: string;
  impressions: number;
  /** percent, 0–100 */
  ctr: number;
  position: number | null;
  diagnosis: PageDiagnosis;
  reason: string;
  impressionsTrendPct: number | null;
};

/** Keyed by `PageDiagnosis`, not by `string`, so a sixth diagnosis added to
 *  pagePower/types.ts fails the build here rather than silently producing a
 *  bucket of pages with no tab to reach it from. */
const DIAGNOSIS_LABEL: Record<PageDiagnosis, string> = {
  buried: "Buried",
  unclicked: "Unclicked",
  invisible: "Invisible",
  healthy: "Healthy",
  unjudged: "Not enough data",
};

/** Derived from the literal above rather than hand-written a second time:
 *  non-numeric string keys enumerate in insertion order, so that one literal is
 *  both the label table and the tab order and the two cannot drift. The order
 *  is triage order — the three diagnoses that name work to do, then the two
 *  that are only ever context. */
const TABS = Object.keys(DIAGNOSIS_LABEL) as PageDiagnosis[];

const SITE_URL = "https://cyprusvipestates.com";

const LocaleBadge = ({ locale }: { locale: string }) => (
  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded shrink-0">{locale}</span>
);

/** The four homepages render as `/`, `/de`, `/pl`, `/ru` — a bare slash is a
 *  four-pixel click target and reads as punctuation next to a 115-character
 *  blog path. Not hypothetical: `/` and `/de` are both in the buried pile
 *  today. `templateClassOf` rather than a second root-URL regex, so the set of
 *  paths that count as a homepage is defined in one place. */
const pathLabel = (path: string): string => (templateClassOf(path) === "homepage" ? `${path} (homepage)` : path);

export default function PagePowerTable({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<PageDiagnosis>("buried");

  const counts = useMemo(() => {
    const c = new Map<PageDiagnosis, number>();
    for (const r of rows) c.set(r.diagnosis, (c.get(r.diagnosis) ?? 0) + 1);
    return c;
  }, [rows]);

  const shown = useMemo(
    () =>
      rows
        .filter((r) => r.diagnosis === filter)
        // Tie-broken on path, not left to impressions alone: 618 pages have
        // zero impressions and `sort` is stable, so ties fall back to inventory
        // order — which comes from Prisma `findMany` calls with no `orderBy`,
        // i.e. whatever order Postgres happened to return. Without the
        // tie-break the 1,118-row `invisible` tab reshuffles between loads.
        .sort((a, b) => b.impressions - a.impressions || a.path.localeCompare(b.path)),
    [rows, filter],
  );

  return (
    <div>
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-4 flex-wrap">
        {TABS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilter(d)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${filter === d ? "border-[#1B4B43] text-[#111827] font-medium" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}
          >
            {DIAGNOSIS_LABEL[d]} <span className="text-[#9CA3AF] tabular-nums">({counts.get(d) ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#6B7280] uppercase tracking-wide">
              <th className="pb-2 font-semibold">Page</th>
              <th className="pb-2 font-semibold text-right">Impressions</th>
              <th className="pb-2 font-semibold text-right" title="Impressions in the last 28 days against the 28 days before them">28d</th>
              <th className="pb-2 font-semibold text-right">CTR</th>
              <th className="pb-2 font-semibold text-right">Position</th>
              <th className="pb-2 font-semibold">Why</th>
            </tr>
          </thead>
          {/* Every matching row, uncapped. `invisible` is 1,118 rows today and
              renders in well under a second, while a cap would hide exactly
              what makes that pile worth opening — the handful of pages ranking
              on the first page of results whose reason says the demand is
              missing, not the indexing. The default tab is `buried` (78 rows),
              so the long list only renders when someone asks for it. */}
          <tbody className="divide-y divide-[#F3F4F6]">
            {shown.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="py-2 pr-3">
                  <div className="flex items-baseline gap-2">
                    <LocaleBadge locale={r.locale} />
                    <a href={`${SITE_URL}${r.path}`} target="_blank" rel="noreferrer" className="text-[#374151] hover:text-[#1B4B43] hover:underline break-words" title={r.path}>
                      {pathLabel(r.path)}
                    </a>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.impressions.toLocaleString("en-GB")}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${r.impressionsTrendPct == null ? "text-[#9CA3AF]" : r.impressionsTrendPct >= 0 ? "text-[#1B4B43]" : "text-[#B3261E]"}`}>
                  {/* Null on 1,584 of 1,679 pages — the prior 28 days must clear
                      MIN_IMPRESSIONS_TREND before a percentage means anything,
                      and an invisible page never will. Empty is the honest
                      reading; see `impressionsTrendPct` in pagePower/types.ts. */}
                  {r.impressionsTrendPct == null ? "—" : `${r.impressionsTrendPct >= 0 ? "+" : ""}${r.impressionsTrendPct.toFixed(0)}%`}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.ctr.toFixed(2)}%</td>
                {/* Null exactly when the page drew no impressions (618 pages).
                    Rendering 0 there would read as "ranked first". */}
                <td className="py-2 pr-3 text-right tabular-nums">{r.position == null ? "—" : r.position.toFixed(1)}</td>
                <td className="py-2 text-[#6B7280]">{r.reason}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-[#9CA3AF]">No pages with this diagnosis.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
import Link from "next/link";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts, classWindow } from "@/lib/seo/pagePower/classVerdicts";
import { templateClassLabel } from "@/lib/seo/templateClass";
import { COMPARISON_PROJECT_PAGES, type ClassDiagnosis } from "@/lib/seo/pagePower/types";
import PagePowerTable, { type Row } from "./PagePowerTable";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg border border-[#E5E7EB] p-5 ${className}`}>{children}</div>
);

/** The class verdict is the point of the table below it, so it is shown rather
 *  than left for the reader to infer from the reason sentence. Exhaustive over
 *  `ClassDiagnosis` for the same reason `DIAGNOSIS_LABEL` is in the table
 *  component: a new diagnosis must not render as unstyled text. */
const CLASS_DIAGNOSIS_COLOR: Record<ClassDiagnosis, string> = {
  repelling: "text-[#B3261E]",
  mute: "text-[#B3261E]",
  healthy: "text-[#1B4B43]",
  unjudged: "text-[#9CA3AF]",
};

const day = (d: Date): string => d.toISOString().slice(0, 10);

export default async function PagePowerPage() {
  // One `now` for both layers. Two `new Date()` calls either side of a slow
  // query can straddle UTC midnight, and this page would then print two windows
  // derived from two different "todays" — the one mismatch a reader has no way
  // to spot.
  const now = new Date();
  const [pages, classes] = await Promise.all([getPageVerdicts(now), getClassVerdicts(now)]);
  const classSpan = classWindow(now);

  // Only the fields the table renders — see the `Row` comment in
  // PagePowerTable.tsx for why this is not a spread of the verdict.
  const rows: Row[] = pages.verdicts.map((v) => ({
    key: v.key,
    locale: String(v.locale),
    path: v.path,
    impressions: v.impressions,
    ctr: v.ctr,
    position: v.position,
    diagnosis: v.diagnosis,
    reason: v.reason,
    impressionsTrendPct: v.impressionsTrendPct,
  }));

  // `windowEnd` is EXCLUSIVE — the first day the window does NOT cover — so
  // printing it would name a date whose data is not in any number on this page
  // (2026-08-21 for a window ending 2026-08-20). Its doc comment in
  // pagePower/pageVerdicts.ts says display code must subtract a day; this is
  // that code. DAY is exact here because both bounds are UTC midnights.
  const lastCoveredDay = new Date(pages.windowEnd.getTime() - DAY);
  // The by-class card runs on PageView and Lead, which have no ingestion lag, so
  // `getClassVerdicts` does not hold back the GSC_LAG_DAYS the page layer must —
  // its window ends three days later than the one in the header above. Until
  // 2026-08-23 this card printed no window of its own and inherited that header,
  // naming a span its own numbers do not cover. Both are dated for the same
  // reason `classVerdicts.ts` gives: say which source a number came from before
  // comparing them.
  const classLastCoveredDay = new Date(classSpan.windowEnd.getTime() - DAY);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Page Power</h1>
          <p className="text-sm text-[#6B7280] mt-1 max-w-prose">
            One diagnosis per page over {day(pages.windowStart)} to {day(lastCoveredDay)}. Coverage{" "}
            {pages.coveragePct.toFixed(1)}% of search clicks — below 85% means redirects the canonical map has not
            learned.
          </p>
        </div>
        <Link href="/admin/analytics/seo" className="text-sm text-[#1B4B43] hover:underline shrink-0">← Back to SEO</Link>
      </div>

      <Card className="mb-6">
        <PagePowerTable rows={rows} />
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold">By template class</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Site visits and enquiries over {day(classSpan.windowStart)} to {day(classLastCoveredDay)} — a different
              window from the one above, which waits for Google to finish reporting.
            </p>
          </div>
          {/* Both columns are routinely misread, and both misreadings are
              recorded on `ClassVerdict` in pagePower/types.ts: "onward" counts
              only properties OTHER than the one the session landed on (so every
              class is measured at the same funnel step), and the enquiry count
              is only those whose form page resolves to this class — measured
              2026-08-23, 60 of 179 leads carry no recoverable page and appear
              in no class. A property here is a Development OR a legacy
              project page; both are counted, which they were not before
              2026-08-23. */}
          <span className="text-xs text-[#6B7280] text-right">
            Onward = entered here, then viewed {COMPARISON_PROJECT_PAGES}+ properties other than the landing page ·
            enquiries are only those whose form page resolves to this class
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#6B7280] uppercase tracking-wide">
                <th className="pb-2 font-semibold">Class</th>
                <th className="pb-2 font-semibold text-right">Entering</th>
                <th className="pb-2 font-semibold text-right">Onward {COMPARISON_PROJECT_PAGES}+</th>
                <th className="pb-2 font-semibold text-right">Rate</th>
                <th className="pb-2 font-semibold text-right">Traceable enquiries</th>
                <th className="pb-2 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {classes.map((c) => (
                <tr key={c.templateClass} className="align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-[#111827] capitalize">{templateClassLabel(c.templateClass)}</div>
                    <div className={`text-xs font-semibold uppercase tracking-wide ${CLASS_DIAGNOSIS_COLOR[c.diagnosis]}`}>{c.diagnosis}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.enteringSessions.toLocaleString("en-GB")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.onwardComparisonSessions.toLocaleString("en-GB")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.onwardComparisonRate.toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.attributableLeads.toLocaleString("en-GB")}</td>
                  <td className="py-2 text-[#6B7280]">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles and renders**

```bash
ln -sfn /Users/sashadith/cvp-analysis/node_modules node_modules
cp /Users/sashadith/cvp-analysis/.env.local .env.local
npx tsc --noEmit
nohup npx next dev -p 3011 > /tmp/pp-dev.log 2>&1 & disown
sleep 25
node -e 'const r = await fetch("http://localhost:3011/admin/analytics/seo/power",{signal:AbortSignal.timeout(120000)}); console.log("HTTP", r.status); const h = await r.text(); console.log("has table:", h.includes("Page Power"));' --input-type=module
pkill -f "next dev -p 3011"; rm -rf .next node_modules .env.local
```

Expected: `HTTP 200` (or a redirect to the admin login, which also proves the
route resolves) and `has table: true` when authenticated.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(panel)/analytics/seo/power" "src/app/admin/(panel)/layout.tsx" docs/superpowers/plans/2026-08-23-seo-page-power.md
git commit -m "Page Power: admin screen"
```

---

## Task 8: Action Center rule

Grouped items, never one per page: three diagnoses plus one per flagged
template class — four in total on 2026-08-23. Seventy-eight individual items for
the buried pile alone would bury the existing CRM and SEO rules.

The two diagnoses whose work is a title/meta rewrite (`buried`, `unclicked`) also
honour the sweep-log suppression window that the CTR rule already applies, so an
item never asks for a rewrite that shipped five weeks ago and is still being
measured. `invisible` does not: its work is indexing, links and demand, which a
rewritten snippet says nothing about.

**Files:**
- Create: `src/lib/actionCenter/rules/pagePower.ts`
- Modify: `src/lib/actionCenter/index.ts`

- [ ] **Step 1: Create the rule**

```typescript
import type { ActionItem, Severity } from "../types";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts, classWindow } from "@/lib/seo/pagePower/classVerdicts";
import { templateClassLabel } from "@/lib/seo/templateClass";
import type { PageDiagnosis } from "@/lib/seo/pagePower/types";
import { pagesInSuppressionWindow } from "@/lib/seo/titleSweepLog";
import { REMEASURE_WINDOW_DAYS } from "@/lib/seo/titleSweepRemeasure";

// One item per DIAGNOSIS, not per page. On 2026-08-23 the buried pile alone
// held 78 pages; seventy-eight items would drown every other rule in the panel.
// The detail belongs on /admin/analytics/seo/power, which each item links to.
//
// Severity follows impressions at stake rather than page count: eight of the
// nine commercial city/type landing pages sit in the buried pile at positions
// 27-51, which matters more than a long tail of forgotten blog posts.
//
// `honoursSweep` marks the diagnoses whose WORK is a title/meta rewrite, and
// which therefore must not ask for that work again on a page a sweep already
// rewrote and is currently measuring — the same suppression getCtrWatchlist
// applies in src/lib/seo/queries.ts, from the same log
// (docs/SEO-TITLE-SWEEP-LOG.md, 42-day window). Measured against production on
// 2026-08-23: 7 of the 12 `unclicked` pages and 7 of the 78 `buried` ones sit
// inside a window — batches 2026-07-18 and 2026-07-27, closing 2026-08-29 and
// 2026-09-07 — so without this the `unclicked` item would tell the team to
// rewrite seven titles that were rewritten five weeks ago, and the whole point
// of the 42 days is to wait and see.
//
// `invisible` is false on purpose, and it is not an oversight to revisit. A
// rewritten snippet says nothing about whether a page is indexed, linked to, or
// has any search demand — the work that diagnosis asks for — so an in-flight
// sweep is no reason to go quiet about it. It would also be a no-op: none of
// the 1,118 invisible pages is in a window on 2026-08-23, and none plausibly
// could be, since a page under 10 impressions in 90 days was never a sweep
// candidate.
//
// Suppression only ever removes pages from the ITEM. The diagnosis itself is
// true of them — they really are getting impressions and not clicks — so
// pageVerdicts.ts is deliberately left unaware of the sweep log and the admin
// screen keeps listing them.
//
// `honoursAge` marks the diagnoses whose WORK is falsified by the page's own
// publication date, and it is the same shape of defect the sweep suppression
// above fixes: asking for work the data already rules out. `invisible` asks for
// indexing and internal links, and a page published inside the window did not
// fail to accumulate 90 days of impressions — it never had 90 days. Measured
// 2026-08-23: 548 of the 1,125 `invisible` pages were published inside the
// window, 430 of them within 30 days, so nearly half of what this item used to
// demand was work nobody could do.
//
// `buried` and `unclicked` are false on purpose. Both rest on impressions the
// page ACTUALLY received — 100 and 300 of them — so a young page reaching either
// has demonstrably been crawled, indexed and served, and its position or its CTR
// is a real measurement rather than a missing one. Only 3 `buried` and 1
// `unclicked` page were young on 2026-08-23 in any case; the flag is per
// diagnosis so that stays a decision rather than a coincidence.
const PAGE_DIAGNOSES: Array<{ diagnosis: PageDiagnosis; title: string; work: string; honoursSweep: boolean; honoursAge: boolean }> = [
  { diagnosis: "buried", title: "buried below position 20", work: "content depth, authority and internal links — not a new title", honoursSweep: true, honoursAge: false },
  { diagnosis: "unclicked", title: "getting impressions but not clicks", work: "title and meta description", honoursSweep: true, honoursAge: false },
  { diagnosis: "invisible", title: "published but not being shown", work: "indexing and internal links", honoursSweep: false, honoursAge: true },
];

/**
 * The coarse magnitude band a pile's page count sits in — the largest rung at or
 * below it — which is what the item id carries so that a snooze cannot outlive
 * the pile it was taken against. See the id comment in `pagePowerRules`.
 *
 * A 1-2-5 ladder: each rung is roughly double the last, so it takes a materially
 * bigger (or materially smaller) pile to change the band, and day-to-day drift
 * cannot. Measured against production on 2026-08-23 by recomputing the verdicts
 * with `now` set back, and comparing the piles these items actually ask for work
 * on (after both exclusions):
 *
 *              today   7 days back   14 days back
 *   buried        72        70 (50)       69 (50)
 *   unclicked      5         5  (5)        4  (2)
 *   invisible    577       577 (500)     555 (500)
 *
 * — band in brackets, and today's bands are 50, 5 and 500. So the 1d and 7d
 * snoozes the panel offers (ActionCenterPanel.tsx) all survive, and the 30d one
 * survives on every pile big enough for a page or two not to matter. `unclicked`
 * at five pages is the exception and it is inherent: on a pile that small any
 * band coarse enough to hold for a month is coarse enough to hide a doubling.
 * It fails in the safe direction — the snooze expires early and a true condition
 * comes back — which is the opposite of the failure this id scheme exists to fix.
 *
 * A fingerprint of the page set would keep the promise exactly and make timed
 * snoozes useless. Over the same seven days every pile changed membership:
 * `buried` 4 in and 2 out, `unclicked` 2 in and 2 out, `invisible` 12 in and 12
 * out — the last with no net change at all. A set-hash id would have broken a
 * seven-day snooze on all three, and `invisible`'s within a day or two.
 *
 * `n` cannot exceed the top rung today — the whole inventory is 1,691 pages —
 * but the clamp is explicit rather than left to `undefined`, because a pile
 * bigger than the site would be a bug worth surviving rather than crashing on.
 */
const PILE_RUNGS: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000];

function pileBand(n: number): number {
  let band = PILE_RUNGS[0];
  for (const rung of PILE_RUNGS) if (n >= rung) band = rung;
  return band;
}

export async function pagePowerRules(): Promise<ActionItem[]> {
  // Matched on `path` rather than on the `locale::path` key: the sweep log
  // records paths exactly as served — English prefix-less, de/pl/ru prefixed —
  // which is the shape PageVerdict.path carries too (see the PageKey comment in
  // pagePower/types.ts). Checked against production on 2026-08-23 rather than
  // assumed: all 34 entries the log holds inside a window matched an inventory
  // path, none left over. A mismatch would fail OPEN — suppressing nothing,
  // which reads exactly like a clean run.
  const [pages, classes, sweptPaths] = await Promise.all([
    getPageVerdicts(), getClassVerdicts(), pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS),
  ]);
  // Keyed on `key`, not `path`, unlike the sweep log above: this set comes from
  // the same `getPageVerdicts` call as the verdicts, so the exact join key is
  // available and there is no reason to match on the weaker half of it.
  const youngKeys = new Set(pages.publishedInsideWindow);
  const items: ActionItem[] = [];

  for (const { diagnosis, title, work, honoursSweep, honoursAge } of PAGE_DIAGNOSES) {
    const diagnosed = pages.verdicts.filter((v) => v.diagnosis === diagnosis);
    const afterSweep = honoursSweep ? diagnosed.filter((v) => !sweptPaths.has(v.path)) : diagnosed;
    const matching = honoursAge ? afterSweep.filter((v) => !youngKeys.has(v.key)) : afterSweep;
    const swept = diagnosed.length - afterSweep.length;
    const tooYoung = afterSweep.length - matching.length;
    if (matching.length === 0) continue;
    // Count, impressions, severity and examples are all computed AFTER both
    // exclusions, so the item never quotes a pile it is not asking for work on.
    const impressions = matching.reduce((sum, v) => sum + v.impressions, 0);
    const examples = matching.slice().sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((v) => v.path);
    const severity: Severity = impressions >= 20_000 ? "URGENT" : impressions >= 5_000 ? "ACTION" : "INFO";
    // Said out loud, with the number: the reader is looking at a smaller pile
    // than the screen behind the link shows, and silently shrinking it would
    // make the two surfaces look like they disagree.
    const sweptNote = swept === 0 ? ""
      : swept === 1 ? " 1 more is left out: its title was rewritten by a sweep still inside its re-measurement window (docs/SEO-TITLE-SWEEP-LOG.md)."
      : ` ${swept} more are left out: their titles were rewritten by a sweep still inside its re-measurement window (docs/SEO-TITLE-SWEEP-LOG.md).`;
    // Same treatment, same reason. The admin screen still lists these pages under
    // this diagnosis with a reason naming their publication date — they are not
    // hidden, they are just not work.
    const youngNote = tooYoung === 0 ? ""
      : tooYoung === 1 ? " 1 more is left out: it was published inside the 90-day window, so it has not had the window to be counted over."
      : ` ${tooYoung.toLocaleString("en-GB")} more are left out: they were published inside the 90-day window, so they have not had the window to be counted over.`;
    items.push({
      // Diagnosis AND the pile's magnitude band, not the diagnosis alone.
      //
      // The bare `page-power:${diagnosis}` this replaced could not keep the
      // promise the design spec makes for it. `dismissForeverItem` writes
      // `snoozedUntil = 2099` (../snooze.ts), so one dismissal of "72 pages
      // buried below position 20" silenced the buried diagnosis for good —
      // including every page that became buried afterwards, which is exactly the
      // "an old snooze cannot hide a new problem" case the spec rules out.
      //
      // Reverting to one item per page would keep the promise and lose the panel:
      // 72 items for `buried` alone and 577 for `invisible`, measured 2026-08-23.
      // The band is the third option. It changes when the pile roughly doubles or
      // halves, so a dismissal covers the pile it was actually taken against and
      // expires the moment that pile becomes a materially different one — while
      // surviving the churn a timed snooze has to survive. See `pileBand` for
      // both measurements, and for why a fingerprint of the page set was
      // rejected even though it would keep the promise exactly.
      //
      // The band is the count AFTER both exclusions, i.e. of the pile this item
      // actually asks for work on — the same rule the title, the impressions and
      // the severity already follow.
      id: `page-power:${diagnosis}:${pileBand(matching.length)}+`,
      severity,
      category: "SEO",
      // Grouped, like the impression count in the very next sentence and like
      // `fmt` on the screen this links to: `invisible` is a four-digit pile, and
      // "1118 pages … 1,463 impressions" in one item reads as two tools.
      title: `${matching.length.toLocaleString("en-GB")} page${matching.length === 1 ? "" : "s"} ${title}`,
      description: `${impressions.toLocaleString("en-GB")} impressions behind them. Work: ${work}. Largest: ${examples.join(", ")}.${sweptNote}${youngNote}`,
      deepLink: "/admin/analytics/seo/power",
      // APPROXIMATION, declared as `ActionItem.since` requires each rule to.
      // Nothing records when a page became buried, unclicked or invisible: the
      // verdict is a 90-day aggregate recomputed from scratch on every call, and
      // there is no history table behind it. So this is the first day the
      // evidence covers, NOT the first day the condition held, and every Page
      // Power item consequently renders as 90 days old and always will. Read it
      // as "measured over the window starting here". Making it truthful needs a
      // stored per-page verdict history, which is a feature, not a fix — and one
      // the Action Center's no-persisted-items contract (../types.ts) rules out
      // as it stands.
      since: pages.windowStart,
    });
  }

  for (const cls of classes) {
    if (cls.diagnosis !== "repelling" && cls.diagnosis !== "mute") continue;
    items.push({
      id: `page-power:class:${cls.templateClass}:${cls.diagnosis}`,
      severity: "ACTION",
      category: "SEO",
      title: `${templateClassLabel(cls.templateClass)} — ${cls.diagnosis === "repelling" ? "visitors arrive but do not browse on" : "visitors compare properties but do not enquire"}`,
      description: cls.reason,
      deepLink: "/admin/analytics/seo/power",
      // Same approximation as the page items above, but the CLASS layer's own
      // window start rather than the page layer's. They are not the same date:
      // `getClassVerdicts` deliberately does not hold back GSC_LAG_DAYS (see
      // `classWindow`), so its window ends today and starts three days later
      // than the page window does. Quoting the page window on a class item would
      // date it to evidence it was not computed from.
      since: classWindow().windowStart,
    });
  }

  return items;
}
```

- [ ] **Step 2: Register the rule**

In `src/lib/actionCenter/index.ts`, add the import beside the existing rule
imports:

```typescript
import { pagePowerRules } from "./rules/pagePower";
```

and change `getActionCenterItems` to include it:

```typescript
export async function getActionCenterItems(): Promise<ActionItem[]> {
  const [developers, crm, system, seo, seoAdvisor, pagePower] = await Promise.all([
    developerRules(), crmRules(), systemRules(), seoRules(), seoAdvisorRules(), pagePowerRules(),
  ]);
  const all = await filterSnoozed([...developers, ...crm, ...system, ...seo, ...seoAdvisor, ...pagePower]);
  return sortItems(all);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actionCenter/rules/pagePower.ts src/lib/actionCenter/index.ts
git commit -m "Page Power: Action Center rule, grouped by diagnosis"
```

---

## Task 9: Feed the weekly advisor

The spec lists the advisor as a consumer: it should discuss named piles instead
of raw metrics. Without this task that requirement has no implementation.

Two constraints pull against each other here and both are load-bearing. SIZE:
there are 1,679 verdicts and 1,118 of them are `invisible` pages carrying 1,463
impressions between them, so sending everything is 658 kB of which two thirds is
noise. HONESTY: several verdicts carry caveats the model must not strip — the
homepage reads `buried` at position 22.2 on a 4.92% CTR, `projects-listing` is
`unjudged` because its onward sessions cannot support a verdict either way, and
`mute` fires for at most one class. The reason strings carry that nuance, so
they travel verbatim and the prompt is told to treat them as the evidence rather
than the label.

(Both class-level figures above were re-measured in the pre-merge correction
batch of 2026-08-23. `projects-listing` was `unjudged` on ONE onward session
before "property" was corrected to cover legacy Projects as well as
Developments, and 12 after; `mute` was believed unreachable on a lead census
that turned out to be wrong. The note this task writes into the advisor payload
is worded from the corrected figures — see `MIN_COMPARISON_SESSIONS` in
types.ts.)

One caveat is NOT in a reason string and must be carried as data: 7 of the 12
`unclicked` pages sit inside a live title-sweep re-measurement window, and
`unclicked` is the diagnosis whose stated work is a title rewrite. Task 8 gave
the Action Center the same guard for the same reason. Leaving the model to
cross-reference paths against `titleSweep[].urls` is a control that fails
silently the first time it is skipped, so the flag rides on the row.

**Files:**
- Modify: `src/lib/seoAdvisor/gather.ts` — extend `AdvisorPayload` and populate it
- Modify: `src/lib/seoAdvisor/analyze.ts` — one prompt principle for reading it

- [ ] **Step 1: Add the imports**

At the top of `src/lib/seoAdvisor/gather.ts`, beside the existing imports:

```typescript
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { MIN_COMPARISON_SESSIONS, WINDOW_DAYS as PAGE_POWER_WINDOW_DAYS, type PageDiagnosis, type ClassDiagnosis } from "@/lib/seo/pagePower/types";
```

`pagesInSuppressionWindow` and `REMEASURE_WINDOW_DAYS` join the existing
`loadSweepEntries` / `computeTitleSweepComparison` imports on their own lines.

- [ ] **Step 2: Add the size discipline, beside `CHANGELOG_LOOKBACK_DAYS`**

What is sent, and what is deliberately not:

```typescript
// The three diagnoses that name WORK. `healthy` and `unjudged` are reported as
// counts further down rather than dropped — see PAGE_POWER_OTHER_DIAGNOSES.
const PAGE_POWER_ACTIONABLE: readonly PageDiagnosis[] = ["buried", "unclicked", "invisible"];
const PAGE_POWER_OTHER_DIAGNOSES: readonly PageDiagnosis[] = ["healthy", "unjudged"];

/** Impression floor for LISTING a diagnosed page as its own row, as opposed to
 *  counting it inside its pile.
 *
 *  Not a tuned knob. The diagnoses' own floors leave the range [10, 100) empty
 *  of every actionable diagnosis, so this number can neither drop a `buried`
 *  page (which needs MIN_IMPRESSIONS_BURIED = 100 impressions to exist at all)
 *  nor keep an `invisible` one (which needs fewer than MIN_IMPRESSIONS_VISIBLE
 *  = 10). Measured against production on 2026-08-23 it listed 78 of 78 buried
 *  and 12 of 12 unclicked pages, and 0 of 1,118 invisible ones.
 *
 *  That last figure is why it exists. The invisible pile is 67% of the 1,679
 *  verdicts and carries 1,463 impressions between them — 1.3 each — so its
 *  "largest" pages are ten rows of nine impressions apiece, each paying the full
 *  cost of a reason sentence to describe a page no suggestion could ever be
 *  justified on. The PILE is actionable; its individual pages are not. It
 *  therefore arrives as counts, which is the shape the work it asks for
 *  (indexing, internal links) acts on anyway. */
const ADVISOR_MIN_LISTED_IMPRESSIONS = 100;

/** Listed rows per diagnosis, after the floor. Half the `slice(0, 20)` the GSC
 *  lists below use, because the rows are not comparable: a striking-distance row
 *  is ~100 bytes of numbers, while a listed verdict carries a whole reason
 *  sentence. Measured 2026-08-23: at 10 the pagePower block serialises to 9.3 kB
 *  and the payload grows from 10.6 kB to 19.9 kB — the largest single block after
 *  the GSC lists, which is the right order for the only field that names the work
 *  rather than the metric. The cap binds hardest on `buried` (78 pages), where
 *  the ten listed carry 28,611 of the pile's 62,982 impressions and the other
 *  34,371 are disclosed in `omittedImpressions` rather than implied by silence. */
const ADVISOR_MAX_LISTED_PAGES = 10;

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
```

- [ ] **Step 3: Extend the payload type**

Add this field to the `AdvisorPayload` type, after `titleSweep` and before
`siteChangelog`:

```typescript
  // Page Power diagnoses, so the ANALYZE step reasons about named piles ("78
  // pages buried below position 20") rather than re-deriving them from raw
  // metrics and inventing its own thresholds. The full table lives at
  // /admin/analytics/seo/power; serialised whole on 2026-08-23 the 1,679
  // verdicts are 658 kB against a 10.6 kB payload — sixty times the rest of it,
  // two thirds of that the invisible pile at 1.3 impressions a page.
  //
  // `notes` is not decoration. Everything a truncated, threshold-derived summary
  // is SILENT about is stated there, because silence reads to a model as "no
  // caveat" — that a pile is longer than the rows shown, that `unjudged` is
  // unmeasured rather than fine, what `mute` needs before it may fire at all,
  // and that a `reason` is the evidence while the diagnosis word is only the
  // label of the threshold it crossed.
  pagePower: {
    /** Both INCLUSIVE, YYYY-MM-DD. Deliberately not `PageVerdictResult.windowEnd`,
     *  which is exclusive: this payload is read by a model that will quote the
     *  dates it is given, and an exclusive bound quoted as a date is wrong. */
    firstDay: string;
    lastDay: string;
    windowDays: number;
    coveragePct: number;
    totalPages: number;
    pages: {
      diagnosis: PageDiagnosis;
      count: number;
      impressions: number;
      /** `titleRewriteBlockedByLiveSweep` is on the ROW, not left to the model
       *  to derive by matching the path against `titleSweep[].urls`. Measured
       *  2026-08-23: 7 of the 12 `unclicked` pages sit inside a 42-day
       *  re-measurement window (batches closing 2026-08-29 and 2026-09-07), and
       *  `unclicked` is the diagnosis whose stated work IS a title rewrite. A
       *  cross-reference the model has to perform is a control that fails
       *  silently the first time it is skipped, and the failure corrupts an
       *  experiment the team is actively running. Same source as the Action
       *  Center's suppression (pagesInSuppressionWindow, docs/SEO-TITLE-SWEEP-LOG.md),
       *  surfaced as data instead of inference — the row stays in the pile
       *  because the diagnosis is true of it; only the title work is blocked. */
      listed: { path: string; impressions: number; clicks: number; ctr: number; position: number | null; reason: string; titleRewriteBlockedByLiveSweep: boolean }[];
      omittedPages: number;
      omittedImpressions: number;
    }[];
    otherDiagnoses: { diagnosis: PageDiagnosis; count: number; impressions: number }[];
    /** EVERY class, healthy ones included — not just the ones with a finding. A
     *  filtered list cannot be told apart from a short one, so a class that
     *  simply did not appear would be read as certified. */
    classes: { templateClass: TemplateClass; diagnosis: ClassDiagnosis; reason: string }[];
    notes: string[];
  };
```

- [ ] **Step 4: Populate it**

Beside the other `gather*` helpers in `src/lib/seoAdvisor/gather.ts`:

```typescript
async function gatherPagePower(): Promise<AdvisorPayload["pagePower"]> {
  // Matched on `path`, the shape the sweep log records and PageVerdict carries
  // (see the PageKey comment in pagePower/types.ts) — the same join
  // pagePowerRules() makes, checked against production there on 2026-08-23 with
  // all 34 in-window entries matching an inventory path. A mismatch fails OPEN:
  // every flag reads false, which looks exactly like a clean run.
  const [pageResult, classes, sweptPaths] = await Promise.all([
    getPageVerdicts(), getClassVerdicts(), pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS),
  ]);
  const impressionsOf = (rows: { impressions: number }[]) => rows.reduce((sum, v) => sum + v.impressions, 0);

  const pages = PAGE_POWER_ACTIONABLE.map((diagnosis) => {
    const matching = pageResult.verdicts
      .filter((v) => v.diagnosis === diagnosis)
      .sort((a, b) => b.impressions - a.impressions);
    const listable = matching.filter((v) => v.impressions >= ADVISOR_MIN_LISTED_IMPRESSIONS);
    const listed = listable.slice(0, ADVISOR_MAX_LISTED_PAGES);
    return {
      diagnosis,
      count: matching.length,
      impressions: impressionsOf(matching),
      listed: listed.map((v) => ({
        path: v.path,
        impressions: v.impressions,
        clicks: v.clicks,
        // Rounded to what the reason sentences already print. Full precision
        // here would put "4.919977924" beside the reason's "4.92" and invite the
        // model to treat two renderings of one number as two measurements.
        ctr: Number(v.ctr.toFixed(2)),
        position: v.position == null ? null : Number(v.position.toFixed(1)),
        // Verbatim, never re-summarised. The reason is where the nuance lives:
        // that an `invisible` page at position 2.9 has ruled indexing OUT, that
        // a zero bucket median means a CTR cannot be called high or low. A
        // paraphrase would keep the diagnosis and drop exactly the sentence that
        // stops it being over-claimed.
        reason: v.reason,
        titleRewriteBlockedByLiveSweep: sweptPaths.has(v.path),
      })),
      omittedPages: matching.length - listed.length,
      omittedImpressions: impressionsOf(matching) - impressionsOf(listed),
    };
  });

  const otherDiagnoses = PAGE_POWER_OTHER_DIAGNOSES.map((diagnosis) => {
    const matching = pageResult.verdicts.filter((v) => v.diagnosis === diagnosis);
    return { diagnosis, count: matching.length, impressions: impressionsOf(matching) };
  });

  // The last day the window COVERS. `windowEnd` is exclusive (see
  // PageVerdictResult), so the human date is one day earlier.
  const lastDay = new Date(pageResult.windowEnd.getTime() - DAY);

  return {
    firstDay: isoDay(pageResult.windowStart),
    lastDay: isoDay(lastDay),
    windowDays: PAGE_POWER_WINDOW_DAYS,
    coveragePct: Number(pageResult.coveragePct.toFixed(1)),
    totalPages: pageResult.verdicts.length,
    pages,
    otherDiagnoses,
    classes: classes.map((c) => ({ templateClass: c.templateClass, diagnosis: c.diagnosis, reason: c.reason })),
    notes: [
      `Window: ${PAGE_POWER_WINDOW_DAYS} days, ${isoDay(pageResult.windowStart)} to ${isoDay(lastDay)} inclusive — longer than, and ending earlier than, the ${ADVISOR_PERIOD_DAYS}-day GSC figures elsewhere in this payload. The two never sum and are not comparable page by page.`,
      `Truncated on purpose: a pile lists only its pages with at least ${ADVISOR_MIN_LISTED_IMPRESSIONS} impressions, largest first, at most ${ADVISOR_MAX_LISTED_PAGES} of them. 'omittedPages' and 'omittedImpressions' say exactly what each 'listed' array leaves out, so an empty or short 'listed' is never an empty or short pile. The full table is at /admin/analytics/seo/power.`,
      `'reason' is the measured evidence; the diagnosis word is only the label of the threshold that evidence crossed. Build rationales from the reason text and carry its qualifications with it — do not restate the label as if it were the finding.`,
      `'position' is impression-weighted across every query a page ranks for, so a page can carry a poor average position and a healthy CTR at the same time when its clicks come from a few strong queries and its impressions from a long tail of deep ones. That pairing is a query mix, not a contradiction and not a data error: read the CTR before proposing work on a buried page.`,
      `'unjudged' means below a measurement floor, not healthy — those pages are unmeasured, and 'otherDiagnoses' carries the impressions sitting in them. Never report unjudged pages, or an unjudged template class, as fine.`,
      `'titleRewriteBlockedByLiveSweep' means this page's title and meta description were rewritten by a sweep that is still inside its ${REMEASURE_WINDOW_DAYS}-day re-measurement window. The diagnosis stands and the page is genuinely underperforming — but the title work does NOT: rewriting it again destroys the measurement in flight. Do not propose title or meta changes for such a page; wait for the window to close (see the titleSweep field for when).`,
      `The class diagnosis 'mute' — comparison traffic arriving but no enquiry traceable to it — needs both ${MIN_COMPARISON_SESSIONS} onward comparison sessions and an expectation of at least three page-attributable enquiries before it may fire. Measured 2026-08-23 exactly one class clears both, so for the other four a 'mute' that never appears is a floor being reported, not lead production being healthy; those read 'unjudged' and their reason says which floor.`,
      `Every page here is published and in the CMS inventory; ${Number(pageResult.coveragePct.toFixed(1))}% of GSC clicks in the window resolved onto one. The rest landed on URLs the canonical map does not know, so a page's figures can understate it.`,
    ],
  };
}
```

Add `gatherPagePower()` to the `Promise.all` in `gatherAdvisorPayload`:

```typescript
export async function gatherAdvisorPayload(): Promise<AdvisorPayload> {
  const [perLocale, movers, ctrWatchlist, strikingDistance, cwvPerClass, platform, titleSweep, pagePower] = await Promise.all([
    getLocalePeriodComparison(ADVISOR_PERIOD_DAYS),
    getClickDeltaMovers(ADVISOR_PERIOD_DAYS, 15),
    getCtrWatchlist(),
    getStrikingDistance(ADVISOR_PERIOD_DAYS),
    gatherCwvSummary(),
    gatherPlatformStats(),
    gatherTitleSweepStatus(),
    gatherPagePower(),
  ]);
```

and add `pagePower,` to the returned object, after `titleSweep,`.

- [ ] **Step 5: Tell the ANALYZE step how to read it**

A payload field the prompt never mentions is a field the model will summarise in
its own words. Add principle 9 to `SYSTEM_PROMPT` in
`src/lib/seoAdvisor/analyze.ts`:

```typescript
9. The pagePower field carries a per-page and per-template-class DIAGNOSIS with a one-sentence \`reason\`. The reason is the evidence; the diagnosis word ("buried", "unclicked", "invisible", "repelling", "unjudged") is only the label of the threshold that evidence crossed. Cite the reason text and carry its qualifications into your rationale — never restate the label as though it were an established fact, and never assert something the reason explicitly rules out. Read pagePower.notes before using the field: it states what the summary is truncated to, what "unjudged" does and does not mean, and which verdicts cannot be reached at this site's traffic volume at all. Prefer discussing these named piles over re-deriving your own thresholds from the raw metrics.
```

and name the new field in the paragraph listing what the payload contains:

```typescript
You'll receive a compact JSON data payload (GSC 28-day period-over-period stats per locale, click winners/losers, the CTR watchlist, a striking-distance list, Core Web Vitals status per template class, platform/publishing stats, title-sweep status, a truncated Page Power diagnosis summary with its caveats in pagePower.notes, and a site changelog of recent structural changes). Analyze it and produce AT MOST 5 suggestions — quality over quantity; if the data doesn't support 5 good ideas, return fewer.
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 7: Verify the payload against production**

Serialise `gatherAdvisorPayload()` and check the block, rather than trusting the
shape. Measured 2026-08-23: `pagePower` is 9,283 bytes inside a 19,921-byte
payload; `buried` lists 10 of 78 and discloses `omittedPages: 68`,
`omittedImpressions: 34371`; `unclicked` lists 10 of 12; `invisible` lists 0 of
1,118 and discloses all 1,463 impressions as omitted; all five template classes
are present, including the three `healthy` ones; and
`titleRewriteBlockedByLiveSweep` is true on 6 of the 10 listed `unclicked` rows
and 3 of the 10 listed `buried` ones, the homepage among them.

- [ ] **Step 8: Commit**

```bash
git add src/lib/seoAdvisor/gather.ts src/lib/seoAdvisor/analyze.ts docs/superpowers/plans/2026-08-23-seo-page-power.md
git commit -m "Page Power: feed the diagnosis summary to the weekly advisor"
```

---

## Task 10: Production build and hand-off

- [ ] **Step 1: Full build**

```bash
ln -sfn /Users/sashadith/cvp-analysis/node_modules node_modules
cp /Users/sashadith/cvp-analysis/.env.local .env.local
npx next build
```

Expected: exit 0. `PrismaClientKnownRequestError: P2037 (too many clients)`
lines during prerender come from building against the production DB over the
tunnel and are not caused by this work — the build still succeeds. Do not
re-run the build repeatedly; it loads the production connection pool.

- [ ] **Step 2: Clean up**

```bash
rm -rf .next node_modules .env.local
git status --porcelain
```

Expected: empty.

- [ ] **Step 3: Report to the operator**

State: the counts per diagnosis from Task 6, the calibration precision, the
coverage percentage, and that the Action Center will surface up to five new
items on the next digest. Deployment of `main` is the operator's call — the
diagnoses read live data, so they take effect immediately on deploy.

---

## What this plan does not build

Held back deliberately, recorded so nobody adds them mid-flight:

- **No composite score.** "SEO Power: 43" hides which work is outstanding.
- **No automated content changes.** The system diagnoses; people decide.
- **No DataForSEO.** `src/lib/seo-sources/dataforseo.ts` stays a stub.
- **No rollup table.** Trends come later, once the diagnoses show which metrics
  are worth freezing.
- **No new alerting path for movement.** The 28-day arrow is feedback only;
  `actionCenter/rules/seo.ts` already reports week-over-week ranking drops.
