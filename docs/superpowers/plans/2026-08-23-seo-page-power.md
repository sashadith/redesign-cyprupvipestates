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
| `src/lib/actionCenter/rules/pagePower.ts` | Five grouped Action Center items. |
| `src/app/admin/(panel)/analytics/seo/power/page.tsx` | Admin screen (server component). |
| `src/app/admin/(panel)/analytics/seo/power/PagePowerTable.tsx` | Filter/sort table (client component). |

**Modify:**

| File | Change |
|---|---|
| `src/lib/actionCenter/index.ts:5,26` | Import and call `pagePowerRules()`. |
| `src/lib/seoAdvisor/gather.ts:26,140` | Add `pagePower` to `AdvisorPayload` and populate it. |

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
export const MIN_BUCKET_PAGES = 5;

/** Bucket-level sample-size floor for a valid CTR median — independently
 *  derived from, and only coincidentally equal to, MIN_IMPRESSIONS_BURIED
 *  above (that one is a page-level eligibility floor for the `buried`
 *  diagnosis). Re-measuring one is not license to update the other. */
export const MIN_BUCKET_IMPRESSIONS = 100;

/** A comparison session views this many DIFFERENT project pages. Comparing two
 *  properties is what a buyer does; reading five articles is what a researcher
 *  does.
 *
 *  Applied at TWO scopes, which classVerdicts.ts keeps apart under two names
 *  because they are not the same number: the site-level metric counts distinct
 *  Development pages across the WHOLE session (the approved north-star figure,
 *  282 per quarter, measured 2026-08-23 — see the design spec), while the
 *  per-class rate counts only distinct properties OTHER THAN the one the
 *  session landed on. Counting the landing property in a per-class rate compares
 *  different funnel steps across classes — see `onwardComparisonSessions`
 *  below. */
export const COMPARISON_PROJECT_PAGES = 2;
export const MIN_ENTERING_SESSIONS = 100;

/** Floor for judging LEAD production, i.e. the `mute` diagnosis. Measured on
 *  `onwardComparisonSessions`, not on the site-level metric.
 *
 *  DORMANT AT CURRENT VOLUME, AND DELIBERATELY LEFT SO. Measured against
 *  production on 2026-08-23 over a 90-day window, the five classes produced
 *  onward counts of 1, 2, 14, 22 and 31. The largest is 31, so NO class reaches
 *  50 and the `mute` branch cannot fire at all: every class with no traced
 *  enquiry reads `unjudged`, however badly it actually converts.
 *
 *  That is the safe direction and the constant is NOT to be lowered to make the
 *  branch reachable. At counts like these a lead-production verdict would be a
 *  coin flip — the same defect, in a different place, as declaring a class
 *  `repelling` on one onward session (see MIN_EXPECTED_ONWARD below). It becomes
 *  reachable on its own as traffic or the window grows. If you are here because
 *  `mute` never fires: this is why, and it is not a bug. */
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
 *  and the same run's five classes:
 *
 *    homepage            expected 22.0  observed 14  false alarm 0.36%
 *    projects-listing    expected  4.0  observed  1  false alarm 9.35%
 *    development-page    expected 22.0  observed 22  false alarm 0.35%
 *    blog-post           expected 40.5  observed  2  false alarm 0.03%
 *    other-landing-page  expected 49.1  observed 31  false alarm 0.01%
 *
 *  20 bounds the false alarm at 0.5% and, on that data, gates exactly the one
 *  class that could not support a verdict — a 1-in-11 fluke — while leaving the
 *  other four judgeable, each at or below 0.36%. Re-measure before changing it.
 *
 *  It gates the WHOLE engagement axis, not just `repelling`. One onward session
 *  is no more evidence for `healthy` than against it, so a class below this
 *  floor is reported `unjudged` on engagement rather than certified by silence. */
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
   *  different Development pages OTHER THAN THE ONE THEY LANDED ON.
   *
   *  Both exclusions are load-bearing and neither may be quietly dropped: not
   *  the entry pageview, and not the entry PROPERTY. Excluding only the pageview
   *  still lets `land on x → view y → back to x` reach two on one further
   *  property, while a homepage session needs two — and returning to the
   *  property you landed on is ordinary browsing, not an edge case. Excluding
   *  the property itself makes the quantity identical across every class:
   *  two distinct properties that are not where the session started.
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
   *  several classes is credited entirely to the last one, and enquiries
   *  arriving by phone, WhatsApp or manual entry carry no page at all and are
   *  counted nowhere (148 of 179 leads since January 2025 were entered by
   *  hand). Do not surface this under a bare "Leads" column — it will be read
   *  as the business's lead count, which it is not. */
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
// "Projects listing" is here for a second reason, and it is the one that bit:
// `/projects` is the ONLY fixed page with a TemplateClass of its own
// (`projects-listing`, templateClass.ts), so leaving it out did not just lose one
// page — it emptied a whole class. Measured 2026-08-23: not one of the 1,675
// inventory pages carried that class, while `getClassVerdicts` was counting 112
// sessions entering it and the sitemap was emitting it in all four locales at
// priority 0.8, the highest of any listing. The class-level report could call the
// catalogue repelling and the page-level report could not name a single page of it
// to act on. It also had a diagnosis waiting: `/projects` alone drew 574
// impressions and 4 clicks in 90 days, over MIN_IMPRESSIONS_CTR, at 0.7% CTR.
const FIXED_PAGES: ReadonlyArray<{ title: string; path: (locale: Locale) => string }> = [
  { title: "Homepage", path: (locale) => (locale === ("en" as Locale) ? "/" : `/${locale}`) },
  { title: "Projects listing", path: (locale) => localised(locale, "/projects") },
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
          select: { slug: true, publicName: true },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true },
    }),
    prisma.blog.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true },
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
      select: { slug: true, language: true, title: true },
    }),
  ]);

  const out: InventoryPage[] = [];

  for (const d of devs) {
    for (const locale of LOCALES) {
      const path = localised(locale, `/projects/${d.slug}`);
      out.push({ key: pageKey(locale, path), locale, path, kind: "development", title: d.publicName });
    }
  }
  for (const p of projects) {
    const path = localised(p.language, `/projects/${p.slug}`);
    out.push({ key: pageKey(p.language, path), locale: p.language, path, kind: "project", title: p.title });
  }
  for (const b of blogs) {
    const path = localised(b.language, `/blog/${b.slug}`);
    out.push({ key: pageKey(b.language, path), locale: b.language, path, kind: "blog", title: b.title });
  }
  const singlesById = new Map(singles.map((s) => [s.sanityId, s]));
  for (const s of singles) {
    // Singlepage.slug is only the LEAF segment for a nested page — reconstruct
    // the full served path by walking parentSanityId (see nestedSlugPath above).
    const nested = nestedSlugPath(s, singlesById);
    const path = localised(s.language, `/${nested}`);
    out.push({ key: pageKey(s.language, path), locale: s.language, path, kind: "singlepage", title: s.title });
  }
  for (const dev of developers) {
    const path = localised(dev.language, `/developers/${dev.slug}`);
    out.push({ key: pageKey(dev.language, path), locale: dev.language, path, kind: "developer", title: dev.title });
  }
  for (const c of caseStudies) {
    const path = localised(c.language, `/case-studies/${c.slug}`);
    out.push({ key: pageKey(c.language, path), locale: c.language, path, kind: "caseStudy", title: c.title });
  }
  for (const locale of LOCALES) {
    for (const fixed of FIXED_PAGES) {
      const path = fixed.path(locale);
      out.push({ key: pageKey(locale, path), locale, path, kind: "fixed", title: fixed.title });
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
import { templateClassOf } from "@/lib/seo/templateClass";
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
 *  since `bucketMedians` and `bucketKeyFor` depend on the same shape. */
const WELL_RANKED_POSITION = POSITION_BUCKETS[1][1];

/** Which bucket a position belongs to, or null if none — the ONE implementation
 *  of the half-open `[low, high)` membership rule documented on POSITION_BUCKETS
 *  in types.ts. `bucketMedians` calls it too, so a page can never be compared
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

/**
 * Median CTR per position bucket, computed over INVENTORY PAGES ONLY.
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
 * with a reason saying exactly that. Under-claiming is the correct failure.
 */
function bucketMedians(totals: Map<PageKey, Totals>, inventoryKeys: Set<PageKey>): Map<string, number> {
  const byBucket = new Map<string, number[]>();
  for (const [key, t] of Array.from(totals.entries())) {
    if (!inventoryKeys.has(key)) continue;
    if (t.impressions < MIN_BUCKET_IMPRESSIONS) continue;
    const position = positionOf(t);
    if (position == null) continue;
    const bucket = bucketKeyFor(position);
    if (bucket == null) continue;
    const ctrs = byBucket.get(bucket) ?? [];
    ctrs.push(ctrOf(t));
    byBucket.set(bucket, ctrs);
  }

  const medians = new Map<string, number>();
  for (const [bucket, ctrs] of Array.from(byBucket.entries())) {
    if (ctrs.length < MIN_BUCKET_PAGES) continue;
    ctrs.sort((a, b) => a - b);
    medians.set(bucket, medianOf(ctrs));
  }
  return medians;
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

export type PageVerdictResult = {
  verdicts: PageVerdict[];
  coveragePct: number;
  /** INCLUSIVE, UTC midnight — the first day the window covers. */
  windowStart: Date;
  /** EXCLUSIVE, UTC midnight — the first day the window does NOT cover, i.e.
   *  the day after `today − GSC_LAG_DAYS`. Display code wanting a human
   *  "… to <last day>" must subtract one day. */
  windowEnd: Date;
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
  const medians = bucketMedians(totals.main, inventoryKeys);
  const devSlugs = new Set(inventory.filter((p) => p.kind === "development").map((p) => p.path.split("/").pop() as string));

  const verdicts: PageVerdict[] = inventory.map((page) => {
    const t = totals.main.get(page.key) ?? emptyTotals();
    const position = positionOf(t);
    const ctr = ctrOf(t);

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
      reason = position != null && position < WELL_RANKED_POSITION
        ? `${impressions(t.impressions)} in ${WINDOW_DAYS} days, but at average position ${position.toFixed(1)} — indexed and served on the first page, so indexing and internal links are ruled out. Nobody is searching for this subject: the work is demand-side (a subject with search volume), or accepting that this page will never carry traffic. Nothing technical will move it.`
        : `Fewer than ${MIN_IMPRESSIONS_VISIBLE} impressions in ${WINDOW_DAYS} days — indexing, internal links, or no demand for the subject.`;
    } else if (t.impressions >= MIN_IMPRESSIONS_BURIED && position != null && position > BURIED_POSITION) {
      diagnosis = "buried";
      reason = `${fmt(t.impressions)} impressions at average position ${position.toFixed(1)} — nobody scrolls that far. Needs content and authority, not a new title.`;
    } else if (t.impressions >= MIN_IMPRESSIONS_CTR && position != null && position <= BURIED_POSITION) {
      const bucket = bucketKeyFor(position);
      const median = bucket == null ? undefined : medians.get(bucket);
      if (bucket == null) {
        // Position exactly BURIED_POSITION: the buckets are half-open and stop
        // at 20, so 20.0 belongs to no bucket while still passing the <= 20 test
        // above. Rare, but an impression-weighted average lands on a boundary
        // often enough to matter (see POSITION_BUCKETS in types.ts) — and "too
        // few comparable pages" would be a false explanation for it.
        reason = `Average position ${position.toFixed(1)} sits on the edge of the comparison range, so there is no expected CTR to measure against.`;
      } else if (median == null) {
        reason = `Position ${position.toFixed(1)} has too few comparable pages to set an expected CTR.`;
      } else if (!(median > 0)) {
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
        // Written `!(median > 0)` rather than `median <= 0` so a NaN bar is
        // rejected rather than silently passed through, matching the
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
      } else if (ctr < median * CTR_MEDIAN_FRACTION) {
        diagnosis = "unclicked";
        reason = `CTR ${ctr.toFixed(2)}% against ${median.toFixed(2)}% typical for position ${position.toFixed(1)} — title and meta description.`;
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
      templateClass: templateClassOf(page.path, devSlugs),
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

  return { verdicts, coveragePct, windowStart, windowEnd };
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
// noise; these are measured on SESSIONS (3,853 in the same window) and reported
// per template class.
//
// EVERY production figure quoted in this file — 3,853 sessions, 282 comparison
// sessions, ~26 website leads in 19 months, 148 of 179 leads entered by hand —
// was measured on 2026-08-23, the same run as the thresholds in types.ts. See
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md. Re-measure before
// leaning on one; they are not preferences and they are not eternal.

const DAY = 86_400_000;

/**
 * The `mute` bar: how many enquiries this class would have to be EXPECTED to
 * produce before observing none is evidence of anything.
 *
 * This is not a measured production threshold like the ones in types.ts — it is
 * a derivation, which is why it lives here and not there. The site produced ~26
 * website leads in 19 months, i.e. on the order of four per 90-day window across
 * all five classes. Under a Poisson null with mean λ, the chance of seeing zero
 * is e^-λ: at λ = 0.8 that is 45%, at λ = 0.2 it is 82%. So "this class produced
 * no lead" is the ORDINARY outcome for a perfectly healthy class, and a `mute`
 * verdict gated only on a comparison-session count — the plan's original shape —
 * would fire on nearly every class that clears the floor while carrying no
 * information at all. e^-3 ≈ 5%, so λ ≥ 3 is the point at which silence is
 * surprising rather than expected. Below it this module says so, in words,
 * instead of emitting a finding it cannot support.
 *
 * What that actually requires. Since
 * `expectedLeads_c = onwardComparisonSessions_c × attributedLeads / siteComparisonSessions`
 * and `onwardComparisonSessions_c ≤ siteComparisonSessions`, the tight bound is
 * just `expectedLeads_c ≤ attributedLeads`. So the precondition for `mute` is
 * THREE PAGE-ATTRIBUTABLE LEADS SITE-WIDE in the window, plus concentration: at
 * four leads against 282 comparison sessions, one class would need about 212 of
 * those 282. Hundreds, not thousands, and within reach of the traffic this site
 * already has.
 *
 * The practical consequence, stated plainly: at the site's current lead volume
 * `mute` will not fire, and the reason is the numerator, not the traffic.
 * `attributedLeads` counts only leads carrying a resolvable `pageSource`, and
 * most arrive by phone, WhatsApp or manual entry — 148 of 179 since January 2025
 * were entered by hand — so the realistic page-attributable count in a 90-day
 * window is nought to two, short of three on its own. That is the honest state
 * of the evidence, and the design spec predicted it ("Diagnosis 5 will read
 * unjudged for most classes at first, and that is the honest output"). The
 * diagnosis becomes reachable on its own as page-attributable lead volume grows
 * — no threshold edit needed.
 */
const MUTE_MIN_EXPECTED_LEADS = 3;

/** Same helper as pageVerdicts.ts, for a different reason. There it is because
 *  `SearchMetric.date` is `@db.Date`; here it is because `PageView.visitorHash`
 *  is salted with the UTC DAY (see src/lib/visitorHash.ts), so a session starts
 *  at UTC midnight. A window bound carrying `now`'s time-of-day would slice the
 *  oldest day in half and hand back sessions whose FIRST ROW IS NOT THEIR ENTRY
 *  PAGE — every entry-page-derived number below would be silently wrong for that
 *  day. Truncating the newest day is harmless by comparison: a session's first
 *  row is still its first row.
 *
 *  Carries the same warning as the copy in pageVerdicts.ts, because this module
 *  performs exactly the arithmetic that warning protects: DST is a non-issue and
 *  `DAY = 86_400_000` is exact here, since every bound produced by this function
 *  is a UTC-midnight instant and every comparison against it is absolute-ms — no
 *  local calendar is ever consulted. Do NOT "fix" the subtraction below into a
 *  timezone-aware one. Duplicated rather than shared only because the two
 *  modules justify it differently; keep the two copies identical in behaviour. */
const utcMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

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
 * The two slug sets are the SAME measurement at two scopes, and keeping them
 * apart is the point:
 *  - `projects` — every distinct Development slug in the session, entry page
 *    included. This is the site-level comparison metric, the approved north-star
 *    figure (282 per quarter), and it is not redefined to suit anything here.
 *  - `onwardProjects` — distinct properties OTHER THAN `entrySlug`, seen after
 *    the entry pageview. This is what a per-class rate must be built on, because
 *    counting the landing property measures a different funnel step for each
 *    class; see `onwardComparisonSessions` in types.ts for the full argument.
 *
 * `entrySlug` exists only to be excluded from `onwardProjects`, and is null when
 * the session did not land on a property at all — in which case there is nothing
 * to exclude and every property seen is onward.
 *
 * All three hold SLUGS, not paths — see the note where they are filled.
 */
type Session = {
  entryClass: TemplateClass;
  entrySlug: string | null;
  projects: Set<string>;
  onwardProjects: Set<string>;
};

export async function getClassVerdicts(now: Date = new Date()): Promise<ClassVerdict[]> {
  // The last WINDOW_DAYS UTC calendar days, the newest of which is today and is
  // therefore only partly elapsed. Deliberately NOT the GSC-lagged window
  // `getPageVerdicts` uses: PageView and Lead are written live, so there is
  // nothing to wait for, and holding back three days of them would discard real
  // sessions to match an unrelated source's latency. The two windows are never
  // joined — but both modules write "in WINDOW_DAYS days" into reason strings an
  // admin reads side by side, and those two spans END three days apart. Say
  // which source a number came from before comparing them.
  const since = new Date(utcMidnight(now).getTime() - (WINDOW_DAYS - 1) * DAY);

  const [map, developments, views, leads] = await Promise.all([
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
    prisma.pageView.findMany({
      where: { createdAt: { gte: since }, isBot: false, isPrefetch: false, isTest: false },
      select: { visitorHash: true, path: true, createdAt: true },
      // `id` is the tie-break, and it is load-bearing: `createdAt` alone leaves
      // rows sharing a timestamp in an order Postgres may return either way, and
      // the FIRST row of each session is read below as its entry page. `id` is
      // an autoincrement written in insertion order, so it settles ties the same
      // way on every run.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.lead.findMany({
      // Leads with no `pageSource` (phone, WhatsApp, manually entered — 148 of
      // 179 since January 2025 were manual) carry no page to attribute to and
      // are excluded here rather than defaulted anywhere. `Lead.status` is never
      // read: the operator ruled it unusable as a scoring basis.
      where: { createdAt: { gte: since }, pageSource: { not: null } },
      select: { pageSource: true },
    }),
  ]);

  const devSlugs = new Set(developments.map((d) => d.slug).filter((slug): slug is string => slug !== null));

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
    // Keyed by SLUG, not path. A Development is reachable in all four locales,
    // so `/projects/x` and `/de/projects/x` are one property: a visitor using
    // the language switcher on a single property would otherwise register as
    // having compared two, which is precisely the buying signal this whole
    // module is built on. `templateClassOf` only returns `development-page`
    // when the last segment is a known Development slug, so the segment is safe
    // to use as the identity.
    const slug = cls === "development-page" ? (path.split("/").pop() as string) : null;

    const session = sessions.get(view.visitorHash);
    if (session === undefined) {
      // Rows arrive oldest-first, so the first one seen for a hash is the entry
      // pageview. `templateClassOf` is total — anything it does not recognise
      // becomes `other-landing-page` — so no session is ever dropped for having
      // entered on an unknown page. The cost is that `other-landing-page` is a
      // catch-all that also absorbs utility pages (/book/<token>, thank-you
      // pages) and legacy `/projects/<slug>` pages that are not Developments.
      // Filtering entries down to the CMS inventory instead would shrink the
      // session denominator invisibly, which is the worse trade.
      sessions.set(view.visitorHash, {
        entryClass: cls,
        entrySlug: slug,
        projects: slug === null ? new Set<string>() : new Set<string>([slug]),
        // The entry pageview is by definition not onward, so this starts empty
        // even when the session landed ON a property.
        onwardProjects: new Set<string>(),
      });
      continue;
    }
    if (slug !== null) {
      session.projects.add(slug);
      // The landing property is excluded from the onward set for the whole
      // session, not just for its first pageview. `land on x → view y → back to
      // x` is ordinary browsing, and counting that return would let a session
      // entering on a property reach the threshold on ONE further property
      // while every other class still needs two — the same asymmetry, smaller,
      // and running the same direction because `development-page` sets the bar.
      if (slug !== session.entrySlug) session.onwardProjects.add(slug);
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
    if (session.projects.size >= COMPARISON_PROJECT_PAGES) siteComparisonSessions++;
    if (session.onwardProjects.size >= COMPARISON_PROJECT_PAGES) {
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

  // The null model behind `mute`: page-attributable leads spread across the
  // classes in proportion to onward-comparison volume. A yardstick for "would
  // zero have been surprising", not a causal claim.
  //
  // The denominator is the SITE-LEVEL comparison metric (entry page included)
  // while the volume it multiplies is onward-only, so the per-class expectations
  // sum to LESS than `attributedLeads` rather than exactly to it. That is the
  // deliberate direction: it makes `mute` harder to reach, never easier, and
  // under-claiming is the correct failure here. The site-level metric is the
  // approved north-star figure and is not rescoped to tidy up this arithmetic.
  const leadsPerComparisonSession = siteComparisonSessions > 0 ? attributedLeads / siteComparisonSessions : 0;

  // The true observed rate for EVERY class, including those below the floor —
  // it is a fact about the class either way, and reporting it keeps NaN out of
  // the record entirely (a NaN would serialise to null and break any consumer
  // calling toFixed on it). The floor governs whether it may be JUDGED, which
  // is decided per class below; only classes clearing it may set the bar.
  const rates = new Map<TemplateClass, number>();
  for (const cls of ALL_CLASSES) {
    const e = entering.get(cls) ?? 0;
    rates.set(cls, e > 0 ? (100 * (onwardComparing.get(cls) ?? 0)) / e : 0);
  }
  const bestRate = Math.max(
    0,
    ...ALL_CLASSES.filter((cls) => (entering.get(cls) ?? 0) >= MIN_ENTERING_SESSIONS).map((cls) => rates.get(cls) ?? 0),
  );

  return ALL_CLASSES.map((cls): ClassVerdict => {
    const enteringSessions = entering.get(cls) ?? 0;
    const onwardComparisonSessions = onwardComparing.get(cls) ?? 0;
    const onwardComparisonRate = rates.get(cls) ?? 0;
    const leadCount = leadsByClass.get(cls) ?? 0;
    const expectedLeads = onwardComparisonSessions * leadsPerComparisonSession;
    // What this class WOULD have produced at the best class's rate. The bar the
    // `repelling` test moves against, and therefore the right quantity to size
    // the evidence on: a rate can only be told from the bar when the bar itself
    // predicts enough events. For the best class it equals its own observed
    // count exactly, which is the sanity check on the formula.
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

    // Reached only when this class itself cleared the floor, so it is one of the
    // classes the bar is drawn from: a zero bar means NO judgeable class sent a
    // single session onward to two properties. Left to fall through, every
    // comparison of the form `0 < 0 * 0.5` is false and each of those classes
    // would be certified against a benchmark that does not exist. Today the
    // MIN_COMPARISON_SESSIONS branch below would happen to catch them — but on a
    // floor over a different quantity, by coincidence, and coincidence is not a
    // guard.
    if (!(bestRate > 0)) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `No template class with enough entering sessions to judge sent a single session on to two or more properties other than the one it landed on in ${WINDOW_DAYS} days, so there is no benchmark to measure this one against.`,
      };
    }

    // Gates the WHOLE engagement axis, not just `repelling`. MIN_ENTERING_SESSIONS
    // bounds the denominator of the rate and nothing bounded the numerator, so a
    // class could clear that floor and still be judged on a handful of onward
    // sessions — measured 2026-08-23, `projects-listing` was called `repelling`
    // on ONE, a 1-in-11 fluke (see MIN_EXPECTED_ONWARD in types.ts for the
    // false-alarm table). Blocking only the `repelling` branch would have handed
    // the same class `healthy` on the same non-evidence with the sign flipped,
    // since that branch asks only for a traced enquiry. One onward session is no
    // more evidence for healthy than against it, so neither verdict is available
    // here and the reason says so outright.
    //
    // Returning `unjudged` rather than falling through to the lead axis hides
    // nothing: `onwardComparisonSessions >= MIN_COMPARISON_SESSIONS` would force
    // this class's own rate to at least 50/enteringSessions, hence
    // `expectedOnward = enteringSessions × bestRate ≥ 50` since `bestRate` is the
    // maximum over judgeable classes — well above this floor. A class gated here
    // can therefore never have been eligible for `mute` anyway.
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

    // Where the plan would have emitted `mute`. See MUTE_MIN_EXPECTED_LEADS: at
    // this site's lead volume zero is the expected outcome for a healthy class,
    // so the honest report is what the evidence cannot support, not a finding.
    return {
      ...base,
      diagnosis: "unjudged",
      reason: `The whole site produced ${enquiries(attributedLeads)} traceable to a page from ${fmt(siteComparisonSessions)} comparison sessions in ${WINDOW_DAYS} days (enquiries by phone, WhatsApp or manual entry carry no page and are not counted), so the ${fmt(onwardComparisonSessions)} sessions that entered here and went on to two or more properties other than their landing page would be expected to produce about ${expectedLeads.toFixed(1)} — too few for its zero to mean anything.`,
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

```typescript
// TEMPORARY — created and deleted inside Task 5 of the Page Power plan.
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";

export const dynamic = "force-dynamic";

export async function GET() {
  const [pages, classes] = await Promise.all([getPageVerdicts(), getClassVerdicts()]);
  return Response.json({ ...pages, classes });
}
```

- [ ] **Step 2: Write the invariant script**

```javascript
// READ-ONLY. Checks the Page Power output against the invariants in
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md.
const BASE = process.env.PROBE_BASE ?? "http://localhost:3011";
const r = await (await fetch(`${BASE}/api/page-power-probe`, { signal: AbortSignal.timeout(180000) })).json();

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const counts = {};
for (const v of r.verdicts) counts[v.diagnosis] = (counts[v.diagnosis] ?? 0) + 1;
console.log(`pages: ${r.verdicts.length}`);
for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k.padEnd(10)} ${n}`);
console.log(`coverage: ${r.coveragePct.toFixed(1)}%`);
console.log(`window: ${r.windowStart.slice(0, 10)} .. ${r.windowEnd.slice(0, 10)}`);
console.log("\nclasses:");
for (const c of r.classes) console.log(`  ${c.templateClass.padEnd(20)} ${c.diagnosis.padEnd(9)} entering=${c.enteringSessions} onward=${c.onwardComparisonSessions} tracedLeads=${c.attributableLeads}`);

const VALID = ["invisible", "buried", "unclicked", "healthy", "unjudged"];
check(r.verdicts.every((v) => VALID.includes(v.diagnosis)), "a page carries a diagnosis outside the allowed set");
check(r.verdicts.every((v) => v.key === `${v.locale}::${v.path}`), "a page key does not match its locale and path");
check(new Set(r.verdicts.map((v) => v.key)).size === r.verdicts.length, "duplicate page keys — the inventory is not deduplicated");
check(r.coveragePct >= 85, `coverage ${r.coveragePct.toFixed(1)}% is below the 85% floor — new redirects the canonical map does not know`);
check(r.verdicts.filter((v) => v.diagnosis === "buried").every((v) => v.position > 20), "a buried page has a position of 20 or better");
check(r.verdicts.filter((v) => v.diagnosis === "unclicked").every((v) => v.impressions >= 300), "an unclicked page is below the 300-impression floor");
check(r.verdicts.filter((v) => v.diagnosis === "invisible").every((v) => v.impressions < 10), "an invisible page has 10 or more impressions");
check(r.verdicts.every((v) => v.reason && v.reason.length > 0), "a verdict has no reason text");

console.log(failures.length ? `\n${failures.length} FAILURE(S):` : "\nall invariants hold");
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 3: Start the dev server and run the script**

```bash
ln -sfn /Users/sashadith/cvp-analysis/node_modules node_modules
cp /Users/sashadith/cvp-analysis/.env.local .env.local
nohup npx next dev -p 3011 > /tmp/pp-dev.log 2>&1 & disown
sleep 25
node scripts/verify-page-power.mjs
```

Expected on first run: it may fail. Read each failure and fix the module it
names — do not relax an invariant to make it pass. The coverage floor in
particular is a real signal: if it reports below 85%, the canonical map is
missing redirects and the join is wrong, not the threshold.

- [ ] **Step 4: Re-run until every invariant holds**

Run: `node scripts/verify-page-power.mjs`
Expected: `all invariants hold`, exit 0.

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
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
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
  const [pages, classes] = await Promise.all([getPageVerdicts(), getClassVerdicts()]);

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
          <h2 className="text-sm font-semibold">By template class</h2>
          {/* Both columns are routinely misread, and both misreadings are
              recorded on `ClassVerdict` in pagePower/types.ts: "onward" counts
              only properties OTHER than the one the session landed on (so every
              class is measured at the same funnel step), and the enquiry count
              is only those whose form page resolves to this class — 148 of 179
              leads since January 2025 were entered by hand and appear in no
              class at all. */}
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

Five grouped items, never one per page. Ninety individual items would bury the
existing CRM and SEO rules.

**Files:**
- Create: `src/lib/actionCenter/rules/pagePower.ts`
- Modify: `src/lib/actionCenter/index.ts`

- [ ] **Step 1: Create the rule**

```typescript
import type { ActionItem, Severity } from "../types";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { templateClassLabel } from "@/lib/seo/templateClass";
import type { PageDiagnosis } from "@/lib/seo/pagePower/types";

// One item per DIAGNOSIS, not per page. On 2026-08-23 the buried pile alone
// held 90 pages; ninety items would drown every other rule in the panel. The
// detail belongs on /admin/analytics/seo/power, which each item links to.
//
// Severity follows impressions at stake rather than page count: eight of the
// nine commercial city/type landing pages sit in the buried pile at positions
// 27-51, which matters more than a long tail of forgotten blog posts.
const PAGE_DIAGNOSES: Array<{ diagnosis: PageDiagnosis; title: string; work: string }> = [
  { diagnosis: "buried", title: "buried below position 20", work: "content depth, authority and internal links — not a new title" },
  { diagnosis: "unclicked", title: "getting impressions but not clicks", work: "title and meta description" },
  { diagnosis: "invisible", title: "published but not being shown", work: "indexing and internal links" },
];

export async function pagePowerRules(): Promise<ActionItem[]> {
  const [pages, classes] = await Promise.all([getPageVerdicts(), getClassVerdicts()]);
  const items: ActionItem[] = [];

  for (const { diagnosis, title, work } of PAGE_DIAGNOSES) {
    const matching = pages.verdicts.filter((v) => v.diagnosis === diagnosis);
    if (matching.length === 0) continue;
    const impressions = matching.reduce((sum, v) => sum + v.impressions, 0);
    const examples = matching.sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((v) => v.path);
    const severity: Severity = impressions >= 20_000 ? "URGENT" : impressions >= 5_000 ? "ACTION" : "INFO";
    items.push({
      id: `page-power:${diagnosis}`,
      severity,
      category: "SEO",
      title: `${matching.length} page${matching.length === 1 ? "" : "s"} ${title}`,
      description: `${impressions.toLocaleString("en-GB")} impressions behind them. Work: ${work}. Largest: ${examples.join(", ")}.`,
      deepLink: "/admin/analytics/seo/power",
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
      since: pages.windowStart,
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

**Files:**
- Modify: `src/lib/seoAdvisor/gather.ts` — extend `AdvisorPayload` and populate it

- [ ] **Step 1: Extend the payload type**

In `src/lib/seoAdvisor/gather.ts`, add this field to the `AdvisorPayload` type,
after `titleSweep` and before `siteChangelog`:

```typescript
  // Page Power diagnosis counts, so the ANALYZE step reasons about named piles
  // ("90 pages buried below position 20") rather than re-deriving them from raw
  // metrics and inventing its own thresholds. Detail lives at
  // /admin/analytics/seo/power; only the summary belongs in the prompt.
  pagePower: {
    pages: { diagnosis: string; count: number; impressions: number; examples: string[] }[];
    classes: { templateClass: string; diagnosis: string; reason: string }[];
    coveragePct: number;
  };
```

- [ ] **Step 2: Add the import**

At the top of `src/lib/seoAdvisor/gather.ts`, beside the existing imports:

```typescript
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
```

- [ ] **Step 3: Populate it in `gatherAdvisorPayload`**

Inside `gatherAdvisorPayload`, before the return, compute:

```typescript
  const [pagePowerPages, pagePowerClasses] = await Promise.all([getPageVerdicts(), getClassVerdicts()]);
  const pagePowerSummary = {
    pages: (["buried", "unclicked", "invisible"] as const).map((diagnosis) => {
      const matching = pagePowerPages.verdicts.filter((v) => v.diagnosis === diagnosis);
      return {
        diagnosis,
        count: matching.length,
        impressions: matching.reduce((sum, v) => sum + v.impressions, 0),
        examples: matching.sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((v) => v.path),
      };
    }),
    classes: pagePowerClasses
      .filter((c) => c.diagnosis === "repelling" || c.diagnosis === "mute")
      .map((c) => ({ templateClass: String(c.templateClass), diagnosis: c.diagnosis, reason: c.reason })),
    coveragePct: pagePowerPages.coveragePct,
  };
```

and add `pagePower: pagePowerSummary,` to the returned object.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seoAdvisor/gather.ts
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
