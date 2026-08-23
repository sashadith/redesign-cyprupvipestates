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
 *  does. */
export const COMPARISON_PROJECT_PAGES = 2;
export const MIN_ENTERING_SESSIONS = 100;
export const MIN_COMPARISON_SESSIONS = 50;

/** A template class is flagged `repelling` when its comparison rate is below
 *  this fraction of the BEST-performing class's rate. Deliberately relative
 *  to the best class, not to a site-wide average, because an average that
 *  includes the weak classes drags the bar down toward them. */
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
  enteringSessions: number;
  comparisonSessions: number;
  /** percent of entering sessions that became comparison sessions */
  comparisonRate: number;
  leads: number;
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
const FIXED_PAGES: ReadonlyArray<{ title: string; path: (locale: Locale) => string }> = [
  { title: "Homepage", path: (locale) => (locale === ("en" as Locale) ? "/" : `/${locale}`) },
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
 *  it. Position must not carry meaning here. */
type WindowSet = { main: MetricWindow; recent: MetricWindow; prior: MetricWindow };
type TotalsSet = { main: Map<PageKey, Totals>; recent: Map<PageKey, Totals>; prior: Map<PageKey, Totals> };

const WINDOW_NAMES = ["main", "recent", "prior"] as const;

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
      const window = windows[name];
      if (at < window.since.getTime() || at >= window.until.getTime()) continue;
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
  /** Inclusive, UTC midnight — the first day the window covers. */
  windowStart: Date;
  /** EXCLUSIVE, UTC midnight — the first day the window does NOT cover. Display
   *  code wanting a human "… to <last day>" must subtract one day. */
  windowEnd: Date;
};

export async function getPageVerdicts(now: Date = new Date()): Promise<PageVerdictResult> {
  const windowEnd = utcMidnight(new Date(now.getTime() - GSC_LAG_DAYS * DAY));
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
      reason = `Fewer than ${MIN_IMPRESSIONS_VISIBLE} impressions in ${WINDOW_DAYS} days — indexing, internal links, or no demand for the subject.`;
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
      } else if (median <= 0) {
        // Every comparable page in this bucket earned zero clicks too, so the
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
        reason = `The comparable pages at position ${position.toFixed(1)} earned no clicks either, so there is no expected CTR to judge against.`;
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
import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCanonicalMap, canonicalize } from "@/lib/seo/urlCanonical";
import { deriveLocale } from "@/lib/gsc/client";
import { templateClassOf, type TemplateClass } from "@/lib/seo/templateClass";
import { getInventory } from "./inventory";
import {
  CLASS_RATE_FRACTION, COMPARISON_PROJECT_PAGES, MIN_COMPARISON_SESSIONS,
  MIN_ENTERING_SESSIONS, WINDOW_DAYS, type ClassVerdict,
} from "./types";

const DAY = 86_400_000;
const SITE_ORIGIN = "https://cyprusvipestates.com";

/** Lead.pageSource is a full URL with query string; GSC and PageView are paths. */
function pathFromLeadSource(pageSource: string): string {
  const withoutOrigin = pageSource.startsWith(SITE_ORIGIN) ? pageSource.slice(SITE_ORIGIN.length) : pageSource;
  return (withoutOrigin.replace(/[?#].*$/, "").replace(/\/$/, "") || "/");
}

type Session = { entry: string | null; projectPages: Set<string>; classes: Set<TemplateClass> };

export async function getClassVerdicts(now: Date = new Date()): Promise<ClassVerdict[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY);
  const [map, inventory, views, leads] = await Promise.all([
    buildCanonicalMap(),
    getInventory(),
    prisma.pageView.findMany({
      where: { createdAt: { gte: since }, isBot: false, isPrefetch: false, isTest: false },
      select: { visitorHash: true, path: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: since }, pageSource: { not: null } },
      select: { pageSource: true },
    }),
  ]);

  const devSlugs = new Set(inventory.filter((p) => p.kind === "development").map((p) => p.path.split("/").pop() as string));
  const classify = (rawPath: string): { path: string; cls: TemplateClass } => {
    const locale = deriveLocale(rawPath) as Locale;
    const target = canonicalize(map, locale, rawPath);
    return { path: target.page, cls: templateClassOf(target.page, devSlugs) };
  };

  // visitorHash rotates DAILY, so one "session" is really one visitor-day. This
  // is a ceiling of the analytics design (cookieless, no PII), not a defect —
  // multi-day research counts more than once and returning visitors are
  // invisible. Rows arrive ordered by time, so the first is the entry page.
  const sessions = new Map<string, Session>();
  for (const view of views) {
    if (!view.visitorHash) continue;
    const { path, cls } = classify(view.path);
    const session = sessions.get(view.visitorHash) ?? { entry: null, projectPages: new Set<string>(), classes: new Set<TemplateClass>() };
    if (session.entry === null) session.entry = path;
    if (cls === "development-page") session.projectPages.add(path);
    session.classes.add(cls);
    sessions.set(view.visitorHash, session);
  }

  const leadsByClass = new Map<TemplateClass, number>();
  for (const lead of leads) {
    const { cls } = classify(pathFromLeadSource(lead.pageSource as string));
    leadsByClass.set(cls, (leadsByClass.get(cls) ?? 0) + 1);
  }

  const entering = new Map<TemplateClass, number>();
  const comparing = new Map<TemplateClass, number>();
  for (const session of Array.from(sessions.values())) {
    const isComparison = session.projectPages.size >= COMPARISON_PROJECT_PAGES;
    if (session.entry) {
      const cls = classify(session.entry).cls;
      entering.set(cls, (entering.get(cls) ?? 0) + 1);
      if (isComparison) comparing.set(cls, (comparing.get(cls) ?? 0) + 1);
    }
  }

  const classes: TemplateClass[] = ["homepage", "projects-listing", "development-page", "blog-post", "other-landing-page"];
  const rates = new Map<TemplateClass, number>();
  for (const cls of classes) {
    const e = entering.get(cls) ?? 0;
    rates.set(cls, e >= MIN_ENTERING_SESSIONS ? (100 * (comparing.get(cls) ?? 0)) / e : NaN);
  }
  const bestRate = Math.max(...Array.from(rates.values()).filter((r) => !Number.isNaN(r)), 0);

  return classes.map((cls) => {
    const enteringSessions = entering.get(cls) ?? 0;
    const comparisonSessions = comparing.get(cls) ?? 0;
    const comparisonRate = rates.get(cls) ?? NaN;
    const leadCount = leadsByClass.get(cls) ?? 0;

    if (enteringSessions < MIN_ENTERING_SESSIONS) {
      return {
        templateClass: cls, enteringSessions, comparisonSessions,
        comparisonRate: Number.isNaN(comparisonRate) ? 0 : comparisonRate, leads: leadCount,
        diagnosis: "unjudged" as const,
        reason: `Only ${enteringSessions} entering sessions in ${WINDOW_DAYS} days — below the ${MIN_ENTERING_SESSIONS} needed to judge.`,
      };
    }
    if (bestRate > 0 && comparisonRate < bestRate * CLASS_RATE_FRACTION) {
      return {
        templateClass: cls, enteringSessions, comparisonSessions, comparisonRate, leads: leadCount,
        diagnosis: "repelling" as const,
        reason: `${comparisonRate.toFixed(1)}% of entering sessions go on to compare properties, against ${bestRate.toFixed(1)}% for the best class — landing layout and internal routes.`,
      };
    }
    if (comparisonSessions >= MIN_COMPARISON_SESSIONS && leadCount === 0) {
      return {
        templateClass: cls, enteringSessions, comparisonSessions, comparisonRate, leads: leadCount,
        diagnosis: "mute" as const,
        reason: `${comparisonSessions} sessions compared properties and produced no enquiry — offer, call to action, contact path.`,
      };
    }
    if (comparisonSessions < MIN_COMPARISON_SESSIONS) {
      return {
        templateClass: cls, enteringSessions, comparisonSessions, comparisonRate, leads: leadCount,
        diagnosis: "unjudged" as const,
        reason: `${comparisonSessions} comparison sessions — below the ${MIN_COMPARISON_SESSIONS} needed to judge lead production.`,
      };
    }
    return {
      templateClass: cls, enteringSessions, comparisonSessions, comparisonRate, leads: leadCount,
      diagnosis: "healthy" as const,
      reason: `${comparisonRate.toFixed(1)}% comparison rate and ${leadCount} enquiries.`,
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
for (const c of r.classes) console.log(`  ${c.templateClass.padEnd(20)} ${c.diagnosis.padEnd(9)} entering=${c.enteringSessions} comparing=${c.comparisonSessions} leads=${c.leads}`);

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

- [ ] **Step 1: Create the table client component**

```tsx
"use client";

import { useMemo, useState } from "react";

export type Row = {
  key: string;
  locale: string;
  path: string;
  templateClass: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number | null;
  diagnosis: string;
  reason: string;
  impressionsTrendPct: number | null;
};

const DIAGNOSIS_LABEL: Record<string, string> = {
  buried: "Buried",
  unclicked: "Unclicked",
  invisible: "Invisible",
  healthy: "Healthy",
  unjudged: "Not enough data",
};

const BADGE: Record<string, string> = {
  buried: "bg-[#FEF3C7] text-[#92400E]",
  unclicked: "bg-[#FEE2E2] text-[#991B1B]",
  invisible: "bg-[#F3F4F6] text-[#374151]",
  healthy: "bg-[#DCFCE7] text-[#166534]",
  unjudged: "bg-[#F3F4F6] text-[#9CA3AF]",
};

export default function PagePowerTable({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<string>("buried");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.diagnosis] = (c[r.diagnosis] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = useMemo(
    () => rows.filter((r) => r.diagnosis === filter).sort((a, b) => b.impressions - a.impressions),
    [rows, filter],
  );

  return (
    <div>
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-4 flex-wrap">
        {Object.keys(DIAGNOSIS_LABEL).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilter(d)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${filter === d ? "border-[#1B4B43] text-[#111827] font-medium" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}
          >
            {DIAGNOSIS_LABEL[d]} <span className="text-[#9CA3AF]">({counts[d] ?? 0})</span>
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#6B7280] border-b border-[#E5E7EB]">
            <th className="py-2 font-medium">Page</th>
            <th className="py-2 font-medium text-right">Impressions</th>
            <th className="py-2 font-medium text-right">28d</th>
            <th className="py-2 font-medium text-right">CTR</th>
            <th className="py-2 font-medium text-right">Position</th>
            <th className="py-2 font-medium">Why</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-b border-[#F3F4F6] align-top">
              <td className="py-2 pr-3">
                <a href={`https://cyprusvipestates.com${r.path}`} target="_blank" rel="noopener noreferrer" className="text-[#1B4B43] hover:underline">
                  {r.path}
                </a>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${BADGE[r.diagnosis] ?? ""}`}>{r.locale}</span>
              </td>
              <td className="py-2 text-right tabular-nums">{r.impressions.toLocaleString("en-GB")}</td>
              <td className={`py-2 text-right tabular-nums ${r.impressionsTrendPct == null ? "text-[#9CA3AF]" : r.impressionsTrendPct >= 0 ? "text-[#166534]" : "text-[#991B1B]"}`}>
                {r.impressionsTrendPct == null ? "—" : `${r.impressionsTrendPct >= 0 ? "+" : ""}${r.impressionsTrendPct.toFixed(0)}%`}
              </td>
              <td className="py-2 text-right tabular-nums">{r.ctr.toFixed(2)}%</td>
              <td className="py-2 text-right tabular-nums">{r.position == null ? "—" : r.position.toFixed(1)}</td>
              <td className="py-2 text-[#6B7280]">{r.reason}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-center text-[#9CA3AF]">No pages with this diagnosis.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { templateClassLabel } from "@/lib/seo/templateClass";
import PagePowerTable, { type Row } from "./PagePowerTable";

export const dynamic = "force-dynamic";

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">{children}</div>
);

export default async function PagePowerPage() {
  const [pages, classes] = await Promise.all([getPageVerdicts(), getClassVerdicts()]);
  const rows: Row[] = pages.verdicts.map((v) => ({ ...v, locale: String(v.locale), templateClass: String(v.templateClass) }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#111827]">Page Power</h1>
        <p className="text-sm text-[#6B7280]">
          One diagnosis per page over {pages.windowStart.toISOString().slice(0, 10)} to{" "}
          {pages.windowEnd.toISOString().slice(0, 10)}. Coverage {pages.coveragePct.toFixed(1)}% of
          search clicks — below 85% means redirects the canonical map has not learned.
        </p>
      </div>

      <Card>
        <PagePowerTable rows={rows} />
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-[#111827] mb-3">By template class</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#6B7280] border-b border-[#E5E7EB]">
              <th className="py-2 font-medium">Class</th>
              <th className="py-2 font-medium text-right">Entering</th>
              <th className="py-2 font-medium text-right">Comparing</th>
              <th className="py-2 font-medium text-right">Rate</th>
              <th className="py-2 font-medium text-right">Enquiries</th>
              <th className="py-2 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.templateClass} className="border-b border-[#F3F4F6] align-top">
                <td className="py-2 pr-3">{templateClassLabel(c.templateClass)}</td>
                <td className="py-2 text-right tabular-nums">{c.enteringSessions}</td>
                <td className="py-2 text-right tabular-nums">{c.comparisonSessions}</td>
                <td className="py-2 text-right tabular-nums">{c.comparisonRate.toFixed(1)}%</td>
                <td className="py-2 text-right tabular-nums">{c.leads}</td>
                <td className="py-2 text-[#6B7280]">{c.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
git add "src/app/admin/(panel)/analytics/seo/power"
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
