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
  templateClass: TemplateClass;
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
