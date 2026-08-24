# Page Improver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An **Improve** action on every Page Power row that has Claude draft the repair for that one page and stores it as a reviewable draft whose meta fields can be applied with one click — never published without a human.

**Architecture:** A `PageImprovement` Prisma table holds drafts/history. A gather module assembles everything known about one page (verdict, pooled GSC queries, the page as served, healthy siblings, guard status); a generate module calls Claude under `PROJECT_BRIEF` with tool-forced output and enforced copy rules; server actions persist, apply (into the same `seo` Json the existing admin editors edit) and dismiss. Applied improvements become a second source for `pagesInSuppressionWindow()`, so every surface that already goes quiet about the July title sweep goes quiet about these too.

**Tech stack:** Next.js 14 App Router, Prisma/Postgres, Anthropic SDK (existing `anthropic()` client, `AI_MODEL`), Tailwind admin conventions.

**Spec:** `docs/superpowers/specs/2026-08-24-page-improver-design.md` — read it first. One refinement over the spec, decided at plan time with evidence: the digit ban gains a **year exception for non-development pages** (`\b20\d{2}\b` stripped before the digit test). The site's own healthy pages carry years in their titles — "Cyprus Property Taxes: Full Guide 2026", "(2026)" — and a full ban would reject the exact pattern the site's best performers use. Prices, counts, quarters ("Q4"), sizes stay banned; Development pages keep the full ban via the existing generator, which this feature does not touch.

## Conventions (all load-bearing on this repo)

1. **Every code fence in THIS plan stays byte-identical to the file it describes.** Change a file with a fence here → update the fence in the same commit, verified programmatically (read both, compare strings), never by eye. The Page Power plan (`2026-08-23-seo-page-power.md`) is **historical as of its merge** — Task 2 stamps it so — and its fences are no longer maintained.
2. `npx tsc --noEmit` must exit 0. `tsconfig.json` sets **no `target`** and **no `downlevelIteration`**: wrap Map/Set iteration in `Array.from()`; the regex `/u` flag and `\p{L}` are unavailable.
3. **The local `.env.local` tunnels to the PRODUCTION database.** Read-only queries only during development. **Never run a migration ad hoc** — the new table reaches production exclusively through the deploy path (`CVP_RUN_MIGRATE=1`, Task 8). Until then the table does not exist anywhere, which is why Task 3's suppression union tolerates exactly the missing-table error and nothing else.
4. `ANTHROPIC_API_KEY` is **not** in the local env. Local verification therefore probes payload assembly (Task 7), never live generation; generation is verified in production behind the calibration gate (Task 8). Do not add the key locally.
5. All admin-facing copy is English. No test runner in this repo, by decision.
6. Comments explain *why*, carrying the dated measurement or incident that motivated them. Match the voice of `src/lib/seo/pagePower/*.ts`.
7. Commit messages explain reasoning, not a changelog. End with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File structure

| file | responsibility |
|---|---|
| `src/lib/ai/copyRules.ts` (new) | The digit/placeholder rule as one shared function — extracted from `seoMeta.ts`, gaining the year exception |
| `src/lib/ai/pageImprover/types.ts` (new) | Proposal shape, constants, `APPLY_ENABLED` gate |
| `src/lib/ai/pageImprover/target.ts` (new) | pageKey → inventory page + DB row; read/write helpers for the per-kind `seo` Json |
| `src/lib/ai/pageImprover/gather.ts` (new) | Assemble the generation payload for one page |
| `src/lib/ai/pageImprover/generate.ts` (new) | Claude call, tool-forced, validated, one retry |
| `src/app/admin/(panel)/analytics/seo/power/improve/page.tsx` (new) | The Improve screen (server) |
| `src/app/admin/(panel)/analytics/seo/power/improve/ImprovePanel.tsx` (new) | Client panel: generate / review / apply / dismiss |
| `src/app/admin/(panel)/analytics/seo/power/improve/actions.ts` (new) | Server actions with the admin auth pattern |
| `prisma/schema.prisma` (modify) | `PageImprovement` model |
| `prisma/migrations/20260824120000_add_page_improvement/migration.sql` (new) | Additive migration, applied only at deploy |
| `src/lib/seo/pagePower/inventory.ts` (modify) | `InventoryPage.source` — the row Apply writes to |
| `src/lib/seo/titleSweepLog.ts` (modify) | Applied improvements as second suppression source |
| `src/lib/ai/seoMeta.ts` (modify) | Delegate its digit check to `copyRules.ts` (behavior identical) |
| `src/app/admin/(panel)/analytics/seo/power/PagePowerTable.tsx` (modify) | Improve link per row |

---

## Task 1: Shared copy rules

**Files:** Create `src/lib/ai/copyRules.ts` · Modify `src/lib/ai/seoMeta.ts`

- [ ] **Step 1: Create the shared module**

```typescript
import { SEO_PLACEHOLDERS } from "@/lib/seoPlaceholders";

// The digit/placeholder rule as ONE function, because it now has two consumers
// and a rule with two copies drifts. Extracted 2026-08-24 from seoMeta.ts's
// badFields() (where it was written against the stored-figure incident: the
// 2026-08-20 audit found 26 of 128 published developments advertising stale
// figures, one a price €30,000 BELOW the real one). The Page Improver applies
// the same rule to blog/singlepage/developer/caseStudy meta — with two
// deliberate differences expressed through the options, never through a fork
// of the logic:
//
//  - `allowYears`: a bare year (\b20\d{2}\b) is stripped before the digit
//    test. The site's own healthy pages carry years in their titles ("Cyprus
//    Property Taxes: Full Guide 2026") and banning them would reject the exact
//    pattern the site's best performers use. Prices, unit counts, quarters
//    ("Q4" still trips on the 4), sizes and street numbers stay banned. The
//    development generator does NOT pass this option — its figures drift with
//    every feed sync and the full ban stands.
//
//  - `placeholders: "none"`: {priceFrom} & co. resolve ONLY on the Development
//    render path (developmentSeo.ts). A blog page's generateMetadata reads
//    seo.metaTitle raw, so a placeholder written there would appear verbatim
//    in a Google snippet. For those kinds any {token} is a violation, not just
//    an unknown one.
const KNOWN_PLACEHOLDERS = new Set<string>(SEO_PLACEHOLDERS);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CopyViolation = "digit" | "placeholder";

export function copyViolation(
  raw: string,
  opts?: { allowedName?: string; allowYears?: boolean; placeholders?: "known" | "none" },
): CopyViolation | null {
  const name = opts?.allowedName?.trim();
  let v = name ? raw.replace(new RegExp(escapeRe(name), "gi"), "") : raw;
  if (opts?.allowYears) v = v.replace(/\b20\d{2}\b/g, "");
  if (/\d/.test(v)) return "digit";
  let m: RegExpExecArray | null;
  const re = /\{(\w*)\}/g;
  while ((m = re.exec(v)) !== null) {
    if (opts?.placeholders === "none" || !KNOWN_PLACEHOLDERS.has(m[1])) return "placeholder";
  }
  return null;
}
```

- [ ] **Step 2: Delegate `badFields` in seoMeta.ts**

Replace the block from `const KNOWN_PLACEHOLDERS = new Set<string>(SEO_PLACEHOLDERS);` down to and including the whole `badFields` arrow function with:

```typescript
import { copyViolation } from "./copyRules";
```
(import goes at the top, beside the other `./` imports) and:

```typescript
// The rule itself lives in copyRules.ts since 2026-08-24 (the Page Improver is
// its second consumer). This wrapper keeps the call sites and the retry text
// unchanged; no options are passed, so developments keep the FULL digit ban —
// the year exception is for kinds whose figures do not drift with feed syncs.
const badFields = (r: Partial<SeoMetaResult>, publicName: string) =>
  LANG_KEYS.filter((k) => copyViolation(r[k] ?? "", { allowedName: publicName }) !== null);
```

`SEO_PLACEHOLDERS` stays imported in seoMeta.ts — the retry messages still interpolate it. `escapeRe` leaves with the block (verify nothing else in the file uses it: `grep -n escapeRe src/lib/ai/seoMeta.ts` must return nothing after the edit).

- [ ] **Step 3: Verify behavior is identical for the old consumer**

Run: `npx tsc --noEmit` — exit 0. Then confirm by inspection (state it in your report): for `placeholders` unset and `allowYears` unset, `copyViolation` is the exact predicate `badFields` had — same name-strip, same `/\d/`, same unknown-token loop.

- [ ] **Step 4: Commit**

---

## Task 2: Prisma model + migration + historical stamp

**Files:** Modify `prisma/schema.prisma` · Create `prisma/migrations/20260824120000_add_page_improvement/migration.sql` · Modify `docs/superpowers/plans/2026-08-23-seo-page-power.md` (two lines at the top)

- [ ] **Step 1: Add the model** (append after the last content model, matching the schema's section-comment style)

```prisma
// ─── PAGE IMPROVER (AI-drafted per-page fixes; see docs/superpowers/specs/2026-08-24-page-improver-design.md) ───
model PageImprovement {
  id          String    @id @default(uuid())
  pageKey     String // "locale::path" — the Page Power identity of the page
  kind        String // inventory kind at generation time
  targetTable String // "Blog" | "Singlepage" | "Developer" | "CaseStudy" | "Project"; "" when apply has no row (fixed pages)
  targetId    String // row id Apply writes to; "" for fixed pages
  status      String // "draft" | "applied" | "dismissed" — at most one draft per pageKey (enforced in the generate action)
  // Snapshot of the diagnosis the draft was based on: months later the admin
  // must be able to see WHY this change was proposed, even after the verdict moved.
  diagnosis   String
  reason      String
  proposal    Json // { metaTitle, metaDescription, rationale, contentSections[], internalLinks[] }
  currentSeo  Json // { metaTitle, metaDescription } at generation time — the staleness guard compares against this on apply
  model       String
  createdAt   DateTime  @default(now())
  appliedAt   DateTime?
  appliedBy   String?

  @@index([pageKey, status])
  @@index([status, appliedAt])
}
```

- [ ] **Step 2: Write the migration SQL** (hand-written; do NOT run `prisma migrate dev` — it would connect to production)

```sql
-- Additive only. Applied exclusively via the deploy path (CVP_RUN_MIGRATE=1).
CREATE TABLE "PageImprovement" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetTable" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposal" JSONB NOT NULL,
    "currentSeo" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "appliedBy" TEXT,

    CONSTRAINT "PageImprovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageImprovement_pageKey_status_idx" ON "PageImprovement"("pageKey", "status");

CREATE INDEX "PageImprovement_status_appliedAt_idx" ON "PageImprovement"("status", "appliedAt");
```

- [ ] **Step 3: Regenerate the client and stamp the old plan**

Run: `npx prisma generate` (local codegen only — touches no database). Then insert directly under the H1 of `docs/superpowers/plans/2026-08-23-seo-page-power.md`:

```markdown
> **Historical since the 2026-08-24 merge to main.** The byte-identical-fence convention applied during this plan's execution only; source files have moved on (first: `inventory.ts` grew `InventoryPage.source` for the Page Improver). Do not "fix" fences here to match the tree.
```

- [ ] **Step 4: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 3: Inventory source refs + the suppression union

**Files:** Modify `src/lib/seo/pagePower/inventory.ts` · Modify `src/lib/seo/titleSweepLog.ts`

- [ ] **Step 1: Extend `InventoryPage`** — append to the type, after `publishedAt`:

```typescript
  /** The DB row Apply would write to — or null where no row exists (`fixed`
   *  pages are code-authored). Added 2026-08-24 for the Page Improver, which
   *  needs pageKey → row without re-deriving the path logic above (the nested
   *  Singlepage walk in particular must not exist twice). Page Power itself
   *  never reads this. */
  source: { table: "Development" | "Project" | "Blog" | "Singlepage" | "Developer" | "CaseStudy"; id: string } | null;
```

- [ ] **Step 2: Fill it.** Add `id: true` to each of the six `select` blocks in `getInventory()`, and extend each push:

- devs loop: `source: { table: "Development", id: d.id }`
- projects loop: `source: { table: "Project", id: p.id }`
- blogs loop: `source: { table: "Blog", id: b.id }`
- singles loop: `source: { table: "Singlepage", id: s.id }`
- developers loop: `source: { table: "Developer", id: dev.id }`
- caseStudies loop: `source: { table: "CaseStudy", id: c.id }`
- fixed loop: `source: null`

(`SinglepageRow` needs `id: string` added to its type alias.)

- [ ] **Step 3: The suppression union.** In `titleSweepLog.ts`, add `import { prisma } from "@/lib/prisma";` and replace `pagesInSuppressionWindow` with:

```typescript
export async function pagesInSuppressionWindow(windowDays: number): Promise<Set<string>> {
  const entries = await loadSweepEntries();
  const now = Date.now();
  const active = entries.filter((e) => now - e.batchDate.getTime() < windowDays * 86_400_000);
  const paths = new Set(active.map((e) => e.page));
  // Second source since 2026-08-24: pages whose title/meta the Page Improver
  // APPLIED inside the window. Same contract as the sweep log — "this page's
  // snippet is mid-measurement, stay quiet about it" — and adding it HERE is
  // the whole point: the CTR watchlist, the Action Center, the advisor and the
  // improver itself all call this one function, so none of them can forget.
  // Runtime rows, not the markdown log: the log is the historical record of
  // the manual sweeps, and a checked-in file written at runtime would be
  // overwritten by the next deploy anyway.
  try {
    const applied = await prisma.pageImprovement.findMany({
      where: { status: "applied", appliedAt: { gte: new Date(now - windowDays * 86_400_000) } },
      select: { pageKey: true },
    });
    for (const r of applied) paths.add(r.pageKey.slice(r.pageKey.indexOf("::") + 2));
  } catch (e) {
    // P2021 = the table does not exist yet. Real exactly once: local dev runs
    // against the production tunnel, and the migration reaches production only
    // via the deploy path — so between Task 2 and Task 8's deploy this query
    // has no table anywhere. Anything else rethrows; a missing-table catch
    // that swallowed real failures would silently disable suppression, which
    // looks exactly like success.
    if ((e as { code?: string })?.code !== "P2021") throw e;
  }
  return paths;
}
```

- [ ] **Step 4: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 4: Target resolution + payload gathering

**Files:** Create `src/lib/ai/pageImprover/types.ts` · Create `src/lib/ai/pageImprover/target.ts` · Create `src/lib/ai/pageImprover/gather.ts`

- [ ] **Step 1: types.ts**

```typescript
// Shapes and constants for the Page Improver. The spec is
// docs/superpowers/specs/2026-08-24-page-improver-design.md; the measured
// rationale for every rule lives there and in copyRules.ts.

/** Apply stays OFF until the calibration gate passes: generate proposals for
 *  five real pages in production, the operator judges each by hand (same
 *  posture as Page Power's hand-checked 30-URL calibration, which is the only
 *  reason that feature's verdicts are trusted). Flip in its own commit with
 *  the five judgments in the message. Until then the button renders disabled
 *  with the reason, and the server action refuses independently — the UI is
 *  not the enforcement. */
export const APPLY_ENABLED = false;

export const IMPROVER_TITLE_BUDGET = 58;
export const IMPROVER_DESC_BUDGET = 150;
/** GSC rows are fetched over this window, matching Page Power's. */
export const IMPROVER_WINDOW_DAYS = 90;
/** Top queries by impressions handed to the model. Beyond this the tail is
 *  privacy-sampled noise — single-impression rows — that costs tokens and
 *  invites sections chasing queries nobody asks. */
export const MAX_QUERIES = 60;

export type ContentSection = { heading: string; draft: string; queriesServed: string[] };
export type InternalLinkSuggestion = { fromPath: string; anchor: string; why: string };

export type ImprovementProposal = {
  metaTitle: string;
  metaDescription: string;
  rationale: string;
  contentSections: ContentSection[];
  internalLinks: InternalLinkSuggestion[];
};

export type CurrentSeo = { metaTitle: string; metaDescription: string };
```

- [ ] **Step 2: target.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { getInventory, type InventoryPage } from "@/lib/seo/pagePower/inventory";
import type { CurrentSeo } from "./types";

// pageKey -> the inventory page (which carries `source`, the row Apply writes
// to). Resolved through getInventory() rather than by re-parsing the path:
// the nested-Singlepage walk and the development/legacy collision rule must
// not exist twice, and the inventory is already the single source of truth
// for "what page is this URL".
export async function resolveTarget(pageKey: string): Promise<InventoryPage | null> {
  const inventory = await getInventory();
  return inventory.find((p) => p.key === pageKey) ?? null;
}

const SEO_TABLES = ["Blog", "Singlepage", "Developer", "CaseStudy", "Project"] as const;
export type SeoTable = (typeof SEO_TABLES)[number];
export const isSeoTable = (t: string): t is SeoTable => (SEO_TABLES as readonly string[]).includes(t);

const asSeo = (seo: unknown): CurrentSeo => {
  const s = seo && typeof seo === "object" ? (seo as Record<string, unknown>) : {};
  return {
    metaTitle: typeof s.metaTitle === "string" ? s.metaTitle : "",
    metaDescription: typeof s.metaDescription === "string" ? s.metaDescription : "",
  };
};

// One switch for reads and one for writes, so the set of tables Apply can
// touch is visible in one place. All five store the same {metaTitle,
// metaDescription} Json shape — verified on real de/ru rows 2026-08-24, and
// the admin editors for every kind read `seo.metaTitle ?? ""` identically.
// Developments are deliberately absent: they have their own generator and
// override editor, and two generators for the same fields drift apart.
export async function readTargetSeo(table: SeoTable, id: string): Promise<CurrentSeo | null> {
  switch (table) {
    case "Blog": {
      const r = await prisma.blog.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "Singlepage": {
      const r = await prisma.singlepage.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "Developer": {
      const r = await prisma.developer.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "CaseStudy": {
      const r = await prisma.caseStudy.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "Project": {
      const r = await prisma.project.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
  }
}

export async function writeTargetSeo(table: SeoTable, id: string, next: CurrentSeo): Promise<void> {
  // Merge, not replace: the Json may carry fields beyond the two we manage
  // (openGraph overrides, legacy keys) and Apply must not strip them.
  const current = await (async () => {
    switch (table) {
      case "Blog": return (await prisma.blog.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "Singlepage": return (await prisma.singlepage.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "Developer": return (await prisma.developer.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "CaseStudy": return (await prisma.caseStudy.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "Project": return (await prisma.project.findUnique({ where: { id }, select: { seo: true } }))?.seo;
    }
  })();
  const merged = { ...(current && typeof current === "object" ? (current as object) : {}), metaTitle: next.metaTitle, metaDescription: next.metaDescription };
  switch (table) {
    case "Blog": await prisma.blog.update({ where: { id }, data: { seo: merged } }); return;
    case "Singlepage": await prisma.singlepage.update({ where: { id }, data: { seo: merged } }); return;
    case "Developer": await prisma.developer.update({ where: { id }, data: { seo: merged } }); return;
    case "CaseStudy": await prisma.caseStudy.update({ where: { id }, data: { seo: merged } }); return;
    case "Project": await prisma.project.update({ where: { id }, data: { seo: merged } }); return;
  }
}
```

**Plan-time uncertainty to verify in this task, not work around:** the spec flags `Project.seo` shape as assumed. Verify with a read-only query (`node --env-file=.env.local`, select one `Project` row's `seo`); if the shape differs from `{metaTitle, metaDescription}`, remove `"Project"` from `SEO_TABLES`, let legacy projects fall back to proposal-only, and say so in your report and in a comment.

- [ ] **Step 3: gather.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import type { PageVerdict, ClassVerdict } from "@/lib/seo/pagePower/types";
import { REMEASURE_WINDOW_DAYS } from "@/lib/seo/titleSweepRemeasure";
import { pagesInSuppressionWindow } from "@/lib/seo/titleSweepLog";
import { templateClassOf } from "@/lib/seo/templateClass";
import type { InventoryPage } from "@/lib/seo/pagePower/inventory";
import { resolveTarget, readTargetSeo, isSeoTable } from "./target";
import { IMPROVER_WINDOW_DAYS, MAX_QUERIES, type CurrentSeo } from "./types";

const SITE_URL = "https://cyprusvipestates.com";
const DAY = 86_400_000;

export type QueryRow = { query: string; impressions: number; clicks: number; position: number };
export type PageText = {
  title: string;
  headings: string[];
  bodyText: string;
  internalLinks: string[];
};
export type SiblingPattern = { path: string; metaTitle: string; metaDescription: string };

export type ImprovementInput = {
  page: InventoryPage;
  verdict: PageVerdict | null;
  /** The verdict of this page's template class — for a blog page, "repelling"
   *  and its evidence steer sections toward routing readers onward, which no
   *  page-level number would say. */
  classVerdict: ClassVerdict | null;
  queries: QueryRow[];
  pageText: PageText;
  currentSeo: CurrentSeo | null;
  siblings: SiblingPattern[];
  /** Non-null when the page sits in a live re-measurement window — generation
   *  must REFUSE, not warn (spec rule; three other surfaces already enforce
   *  this and the improver must not become the fourth to forget). */
  suppressed: boolean;
};

// Both historical URL shapes of one page. Two migrations are on record
// (measured 2026-08-24): English moved OFF the /en prefix at the end of June,
// and de/pl/ru moved ONTO their prefixes across June/July — 82 pages, each of
// whose GSC history is split across two URLs. Matching one URL exactly loses
// most of the baseline; the title-sweep re-measurement made this exact mistake
// and reported 234 of 2,698 impressions for the biggest page in the batch.
export function urlVariants(locale: string, path: string): string[] {
  if (locale === "en") return path === "/" ? ["/", "/en"] : [path, `/en${path}`];
  const bare = path.replace(new RegExp(`^/${locale}`), "") || "/";
  return bare === path ? [path] : [path, bare];
}

async function fetchQueries(locale: string, path: string): Promise<QueryRow[]> {
  const since = new Date(Date.now() - IMPROVER_WINDOW_DAYS * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: { not: null }, date: { gte: since }, page: { in: urlVariants(locale, path) } },
    select: { query: true, impressions: true, clicks: true, position: true },
  });
  const byQuery = new Map<string, { impressions: number; clicks: number; posWeighted: number }>();
  for (const r of rows) {
    const q = r.query as string;
    const a = byQuery.get(q) ?? { impressions: 0, clicks: 0, posWeighted: 0 };
    a.impressions += r.impressions;
    a.clicks += r.clicks;
    a.posWeighted += r.position * r.impressions;
    byQuery.set(q, a);
  }
  return Array.from(byQuery.entries())
    .map(([query, a]) => ({ query, impressions: a.impressions, clicks: a.clicks, position: a.impressions ? a.posWeighted / a.impressions : 0 }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_QUERIES);
}

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// The page as SERVED, not as stored: fetching the live URL is uniform across
// all six kinds and sees exactly what Google sees, portable-text quirks and
// rendering bugs included. The cost is one GET per generation, which is
// nothing next to the model call it feeds.
export async function fetchPageText(path: string): Promise<PageText> {
  const res = await fetch(`${SITE_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Live page fetch failed: ${res.status} for ${path}`);
  const html = await res.text();
  const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const headings = Array.from(html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((m) => strip(m[2]))
    .filter(Boolean)
    .slice(0, 40);
  const internalLinks = Array.from(new Set(
    Array.from(html.matchAll(/href="(\/[^"#?]*)"/g))
      .map((m) => m[1])
      .filter((h) => !h.startsWith("/_next") && !h.startsWith("/uploads") && !h.startsWith("/api")),
  )).slice(0, 80);
  const bodySource = html.split(/<\/head>/i)[1] ?? html;
  const bodyText = strip(bodySource).slice(0, 6000);
  return { title, headings, bodyText, internalLinks };
}

export async function gatherImprovementInput(pageKey: string): Promise<ImprovementInput> {
  const page = await resolveTarget(pageKey);
  if (!page) throw new Error(`Unknown page: ${pageKey}`);

  const [{ verdicts }, classes, suppressedPaths] = await Promise.all([
    getPageVerdicts(),
    getClassVerdicts(),
    pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS),
  ]);
  const verdict = verdicts.find((v) => v.key === pageKey) ?? null;

  // Healthy siblings of the same template class, as working patterns FROM THIS
  // SITE — labelled that way in the prompt, not as targets to copy: the
  // healthy pool is 39 pages and a thin pool can encode a habit as a pattern.
  const cls = templateClassOf(page.path);
  const healthySiblings = verdicts
    .filter((v) => v.diagnosis === "healthy" && v.key !== pageKey && templateClassOf(v.path) === cls)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 4);
  const inventory = await Promise.all(healthySiblings.map(async (s) => {
    const t = await resolveTarget(s.key);
    if (!t?.source || !isSeoTable(t.source.table)) return null;
    const seo = await readTargetSeo(t.source.table, t.source.id);
    if (!seo || (!seo.metaTitle && !seo.metaDescription)) return null;
    return { path: s.path, metaTitle: seo.metaTitle, metaDescription: seo.metaDescription };
  }));
  const siblings = inventory.filter((s): s is SiblingPattern => s !== null).slice(0, 2);

  const [queries, pageText, currentSeo] = await Promise.all([
    fetchQueries(String(page.locale), page.path),
    fetchPageText(page.path),
    page.source && isSeoTable(page.source.table) ? readTargetSeo(page.source.table, page.source.id) : Promise.resolve(null),
  ]);

  const classVerdict = classes.find((c) => c.templateClass === cls) ?? null;
  return { page, verdict, classVerdict, queries, pageText, currentSeo, siblings, suppressed: suppressedPaths.has(page.path) };
}
```

**Note for the implementer:** `resolveTarget` is called up to five times here (page + siblings) and each call runs `getInventory()`. Either memoise the inventory within `gatherImprovementInput` (pass it through) or accept the cost with a measurement — decide with a number, not a guess, and say which in your report.

- [ ] **Step 4: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 5: Generation

**Files:** Create `src/lib/ai/pageImprover/generate.ts`

- [ ] **Step 1: The module**

```typescript
import { anthropic, AI_MODEL } from "../anthropic";
import { PROJECT_BRIEF } from "../projectBrief";
import { copyViolation } from "../copyRules";
import { IMPROVER_TITLE_BUDGET, IMPROVER_DESC_BUDGET, type ImprovementProposal } from "./types";
import type { ImprovementInput } from "./gather";

// One page, one proposal. The system layer is the shared brief plus a role
// block; the payload is everything gather.ts assembled. Tool-forced so the
// output is structured, validated because the model is not trusted to be
// perfect (same posture as seoMeta.ts): one corrective retry, then a loud
// failure — a visible "regenerate" in the admin is cheaper than a bad draft
// that a tired click applies.
const ROLE = `You are drafting a concrete repair for ONE page of this site, based on its diagnosis and its own search data.

Rules for this task, on top of the brief:
- Write the metaTitle and metaDescription in the page's own locale (given in the payload). They must contain NO digits (a bare year like 2026 is the only exception) and NO {placeholder} tokens — this page's render path does not resolve them, so anything you write appears verbatim in the Google snippet.
- metaTitle: aim 45–55 characters, hard ceiling ${IMPROVER_TITLE_BUDGET}. metaDescription: aim 130–145, hard ceiling ${IMPROVER_DESC_BUDGET}. Put the reason to click in the first half.
- contentSections are drafts for a HUMAN EDITOR, in the page's locale, each serving named queries from the payload. Figure-free prose (year exception applies). 2–4 sections; if the diagnosis is about the title rather than the content, fewer or none is correct.
- internalLinks suggest links FROM other pages of this site TO this page (fromPath must be a plausible path on this site — prefer ones you saw in the payload). These are suggestions for the human; you cannot see the whole site.
- The sibling examples show what currently works ON THIS SITE. They are patterns, not targets to copy; do not produce near-duplicates of them.
- rationale: two or three sentences citing the page's own query data. If the sampled queries are too thin to justify a section, say so there instead of inventing one.`;

const violationNotes = (p: Partial<ImprovementProposal>): string[] => {
  const notes: string[] = [];
  const meta: Array<[string, string | undefined, number]> = [
    ["metaTitle", p.metaTitle, IMPROVER_TITLE_BUDGET],
    ["metaDescription", p.metaDescription, IMPROVER_DESC_BUDGET],
  ];
  for (const [field, value, budget] of meta) {
    const v = value ?? "";
    if (copyViolation(v, { allowYears: true, placeholders: "none" }))
      notes.push(`${field} contains a digit (only a bare year is allowed) or a {placeholder} (never allowed on this page type). Rewrite it without the figure — drop the fact, do not spell it in words.`);
    if (v.trim().length > budget)
      notes.push(`${field} is ${v.trim().length} characters against a hard ceiling of ${budget}. Rewrite it shorter by dropping the least important detail.`);
  }
  for (const [i, s] of (p.contentSections ?? []).entries()) {
    if (copyViolation(`${s.heading} ${s.draft}`, { allowYears: true, placeholders: "none" }))
      notes.push(`contentSections[${i}] contains a digit or a {placeholder}. Prose on this page type must be figure-free (bare years excepted) — rewrite that section.`);
  }
  return notes;
};

export async function generateProposal(input: ImprovementInput): Promise<ImprovementProposal> {
  const client = anthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  if (input.suppressed) throw new Error("Page is inside a live re-measurement window — generation refused (see the sweep log).");

  const payload = {
    locale: String(input.page.locale),
    path: input.page.path,
    kind: input.page.kind,
    diagnosis: input.verdict?.diagnosis ?? "unknown",
    reason: input.verdict?.reason ?? "No verdict for this page in the current window.",
    metrics: input.verdict
      ? { impressions: input.verdict.impressions, ctr: input.verdict.ctr, position: input.verdict.position }
      : null,
    templateClassVerdict: input.classVerdict
      ? { class: input.classVerdict.templateClass, diagnosis: input.classVerdict.diagnosis, reason: input.classVerdict.reason }
      : null,
    currentMeta: input.currentSeo,
    queries: input.queries,
    queriesCaveat: "Privacy-sampled by Google: relative weights are meaningful, absolute totals are not.",
    pageAsServed: input.pageText,
    workingPatternsFromThisSite: input.siblings,
  };

  const attempt = async (correction?: string): Promise<Partial<ImprovementProposal>> => {
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: `${PROJECT_BRIEF}\n\n${ROLE}` }],
      tools: [{
        name: "page_improvement",
        description: "The proposed repair for this one page.",
        input_schema: {
          type: "object",
          properties: {
            metaTitle: { type: "string" },
            metaDescription: { type: "string" },
            rationale: { type: "string" },
            contentSections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string" },
                  draft: { type: "string" },
                  queriesServed: { type: "array", items: { type: "string" } },
                },
                required: ["heading", "draft", "queriesServed"],
              },
            },
            internalLinks: {
              type: "array",
              items: {
                type: "object",
                properties: { fromPath: { type: "string" }, anchor: { type: "string" }, why: { type: "string" } },
                required: ["fromPath", "anchor", "why"],
              },
            },
          },
          required: ["metaTitle", "metaDescription", "rationale", "contentSections", "internalLinks"],
        } as never,
      }],
      tool_choice: { type: "tool", name: "page_improvement" },
      messages: [{ role: "user", content: `${JSON.stringify(payload, null, 1)}${correction ? `\n\n${correction}` : ""}` }],
    });
    const tool = msg.content.find((b) => b.type === "tool_use") as { input?: Partial<ImprovementProposal> } | undefined;
    const raw = tool?.input ?? {};
    if (!raw.metaTitle && !raw.metaDescription) throw new Error(`No content (stop: ${msg.stop_reason})`);
    return raw;
  };

  let raw = await attempt();
  const notes = violationNotes(raw);
  if (notes.length) raw = await attempt(`These fields were rejected — fix ONLY them, keep the rest:\n- ${notes.join("\n- ")}`);
  const still = violationNotes(raw);
  if (still.length) throw new Error(`Proposal still violates the copy rules after a retry: ${still.join(" · ")}`);

  return {
    metaTitle: (raw.metaTitle ?? "").trim(),
    metaDescription: (raw.metaDescription ?? "").trim(),
    rationale: (raw.rationale ?? "").trim(),
    contentSections: raw.contentSections ?? [],
    internalLinks: raw.internalLinks ?? [],
  };
}
```

- [ ] **Step 2: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 6: Server actions

**Files:** Create `src/app/admin/(panel)/analytics/seo/power/improve/actions.ts`

- [ ] **Step 1: The actions** — follow the repo's admin auth pattern exactly (session + DB re-validation, audit M3):

```typescript
"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { AI_MODEL } from "@/lib/ai/anthropic";
import { gatherImprovementInput } from "@/lib/ai/pageImprover/gather";
import { generateProposal } from "@/lib/ai/pageImprover/generate";
import { isSeoTable, readTargetSeo, writeTargetSeo } from "@/lib/ai/pageImprover/target";
import { APPLY_ENABLED, type CurrentSeo, type ImprovementProposal } from "@/lib/ai/pageImprover/types";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  // Re-validate against the DB so a deactivated/deleted user can't keep acting
  // for the remainder of their JWT lifetime (audit M3 — same as actions.ts).
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return uid;
}

const IMPROVE_PATH = "/admin/analytics/seo/power/improve";

export async function generateImprovementAction(pageKey: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    const input = await gatherImprovementInput(pageKey);
    if (input.page.kind === "development")
      return { error: "Developments have their own generator — use the override editor." };
    const proposal = await generateProposal(input);
    const source = input.page.source;
    // One draft per page: a regenerate REPLACES the standing draft rather than
    // stacking a second one — two open drafts for one page is a merge conflict
    // waiting for a tired click. Applied/dismissed rows stay; they are history.
    await prisma.$transaction([
      prisma.pageImprovement.deleteMany({ where: { pageKey, status: "draft" } }),
      prisma.pageImprovement.create({
        data: {
          pageKey,
          kind: input.page.kind,
          targetTable: source && isSeoTable(source.table) ? source.table : "",
          targetId: source && isSeoTable(source.table) ? source.id : "",
          status: "draft",
          diagnosis: input.verdict?.diagnosis ?? "unknown",
          reason: input.verdict?.reason ?? "",
          proposal: proposal as object,
          currentSeo: (input.currentSeo ?? { metaTitle: "", metaDescription: "" }) as object,
          model: AI_MODEL,
        },
      }),
    ]);
    revalidatePath(IMPROVE_PATH);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function applyImprovementAction(id: string): Promise<{ error?: string }> {
  const uid = await requireAdmin();
  // Enforced HERE, not only in the UI: a disabled button is a courtesy, a
  // refusing action is the gate. Flipped by the calibration commit (types.ts).
  if (!APPLY_ENABLED) return { error: "Apply is behind the calibration gate — generate and judge five real pages first (see types.ts)." };
  try {
    const row = await prisma.pageImprovement.findUnique({ where: { id } });
    if (!row || row.status !== "draft") return { error: "No open draft with that id." };
    if (!row.targetTable || !isSeoTable(row.targetTable)) return { error: "This page kind has no apply path — copy the proposal into the code or editor by hand." };

    // Staleness guard, same posture as the stale-copy fix script's exactly-once
    // occurrence check: if the row's seo changed since this draft was generated,
    // refuse rather than overwrite someone's manual edit.
    const current = await readTargetSeo(row.targetTable, row.targetId);
    const snapshot = row.currentSeo as CurrentSeo;
    if (!current) return { error: "Target row no longer exists." };
    if (current.metaTitle !== snapshot.metaTitle || current.metaDescription !== snapshot.metaDescription)
      return { error: "The page's SEO fields changed after this draft was generated — regenerate to get a draft based on the current state." };

    const proposal = row.proposal as ImprovementProposal;
    await writeTargetSeo(row.targetTable, row.targetId, { metaTitle: proposal.metaTitle, metaDescription: proposal.metaDescription });
    await prisma.pageImprovement.update({ where: { id }, data: { status: "applied", appliedAt: new Date(), appliedBy: uid } });
    revalidatePath(IMPROVE_PATH);
    revalidatePath("/admin/analytics/seo/power");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function dismissImprovementAction(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const row = await prisma.pageImprovement.findUnique({ where: { id }, select: { status: true } });
  if (!row || row.status !== "draft") return { error: "No open draft with that id." };
  await prisma.pageImprovement.update({ where: { id }, data: { status: "dismissed" } });
  revalidatePath(IMPROVE_PATH);
  return {};
}
```

- [ ] **Step 2: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 7: The Improve screen

**Files:** Create `improve/page.tsx` · Create `improve/ImprovePanel.tsx` · Modify `PagePowerTable.tsx`

Follow the layout conventions of `src/app/admin/(panel)/analytics/seo/power/page.tsx` (Card, header, `← Back` link, English copy). Key requirements rather than a fixed fence — this is UI and the sibling screens are the styleguide; the SHAPES below are binding:

- [ ] **Step 1: `page.tsx`** (server). Reads `searchParams.key` (the pageKey arrives `encodeURIComponent`-ed — a path contains slashes, so it is a query param, not a route segment). Loads: `resolveTarget`, the page's verdict from `getPageVerdicts()`, `pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS)`, the standing draft + history (`prisma.pageImprovement.findMany({ where: { pageKey }, orderBy: { createdAt: "desc" } })` — tolerate P2021 pre-migration the same way `titleSweepLog.ts` does, rendering an "awaiting first deploy" note), and `readTargetSeo` for the current fields. Renders:
  - Header: path (linked to the live page), locale badge, diagnosis badge + reason, impressions/CTR/position, `← Back to Page Power`.
  - `development` kind: no panel — a card explaining the override editor owns this kind, deep-linking to the development's admin page. **Verify the editor route with `ls "src/app/admin/(panel)/developments"` and use the real one** — state what you found in your report.
  - `fixed` kind: the panel WITHOUT apply, labelled "code-authored page — apply by editing the code".
  - Suppressed page: a card naming the re-measurement window instead of the Generate button.
  - Otherwise `<ImprovePanel …/>` with serializable props: pageKey, kind, currentSeo, draft (id + proposal + createdAt + diagnosis), history rows, applyEnabled (`APPLY_ENABLED`), editorHref (map: Blog→`/admin/content/blog/[id]`, Singlepage→`/admin/content/pages/[id]`, Developer→`/admin/content/developers/[id]`, CaseStudy→`/admin/content/case-studies/[id]`, Project→`/admin/content/projects/[id]` — **verify each folder exists with `ls` before hardcoding**).

- [ ] **Step 2: `ImprovePanel.tsx`** (client). `useTransition` around the three actions; surface returned `error` strings inline (English). Sections:
  - **Meta**: current → proposed diff per field (current in muted text, proposed emphasized, char counts against 58/150). Buttons: Apply meta (disabled with title-tooltip when `!applyEnabled` — "Behind the calibration gate"), Dismiss, Regenerate.
  - **Content sections**: each with heading, draft text in a copyable block (`navigator.clipboard.writeText`, with a "Copied" flash), and its `queriesServed` as chips; below them a deep link "Open in editor" (`editorHref`).
  - **Internal links**: list of fromPath → anchor with the why.
  - **Rationale** paragraph.
  - **History**: applied/dismissed rows with dates and who applied.
  - Generation takes tens of seconds — the Generate button must show a working state and stay disabled while pending.

- [ ] **Step 3: The link in `PagePowerTable.tsx`.** Add a final column ("") whose cell is `<a href={`/admin/analytics/seo/power/improve?key=${encodeURIComponent(r.key)}`} …>Improve</a>` styled like the existing path link. **Both `colSpan={6}` occurrences (group band row, empty-state row) become 7.**

- [ ] **Step 4: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 8: Local verification probe (payload only), build, hand-off

**Requires the production tunnel on `localhost:5433`, `NEW_PROJECTS_INDEXABLE=true`, read-only.** No Claude call happens locally (no key, by design — convention 4).

- [ ] **Step 1: Temporary probe route** `src/app/api/improver-probe/route.ts` (created and deleted inside this task):

```typescript
// TEMPORARY — Page Improver payload probe, deleted in the same task.
import { gatherImprovementInput } from "@/lib/ai/pageImprover/gather";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return Response.json({ error: "pass ?key=" }, { status: 400 });
  const input = await gatherImprovementInput(key);
  return Response.json({
    page: input.page,
    verdict: input.verdict,
    suppressed: input.suppressed,
    currentSeo: input.currentSeo,
    queries: input.queries.slice(0, 10),
    queryCount: input.queries.length,
    siblings: input.siblings,
    pageText: { title: input.pageText.title, headings: input.pageText.headings.slice(0, 8), bodyChars: input.pageText.bodyText.length, internalLinkCount: input.pageText.internalLinks.length },
  });
}
```

- [ ] **Step 2: Run against three real pages** (dev server on 3011, `NEW_PROJECTS_INDEXABLE=true`):

- `en::/off-plan-properties-in-paphos` (buried singlepage) — **expect pooled queries**: this page's history spans `/off-plan-properties-in-paphos` AND `/en/off-plan-properties-in-paphos`; if `queryCount` is small and every query has near-zero impressions, `urlVariants` is not pooling and that is a bug, not a data quirk.
- `de::/de/blog/wie-nach-zypern-auswandern` (unclicked blog) — expect `currentSeo` populated from the Blog row, siblings of class `blog-post`, `suppressed: false`.
- `de::/de/blog/warum-wandern-so-viele-nach-zypern-aus` — **expect `suppressed: true`** (July sweep, window runs to 2026-08-29; if the calendar has passed that date pick another page from `docs/SEO-TITLE-SWEEP-LOG.md`'s second batch and note it).

Also confirm the draft-history read on the improve screen renders its "awaiting first deploy" state rather than crashing (P2021 tolerance), by loading the page for key #2 through the dev server (it 307s to login — confirm compile + no 500 in the dev log).

- [ ] **Step 3: Delete the probe, stop the server, `rm -rf .next node_modules .env.local`, `git status --porcelain` clean, `npx next build` green** (build needs the env copied back in first — same recipe as the Page Power plan: symlink node_modules, cp .env.local, build, then clean again).

- [ ] **Step 4: Commit** (the probe route must not be in it).

- [ ] **Step 5: Hand-off report to the operator** — deployment and calibration are THEIR calls, not yours. State:
  - Deploy requires the migration: `CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh` (dry-run first). Until deployed, nothing changes in production; locally the suppression union and history reads tolerate the missing table.
  - **Calibration gate (in production, after deploy):** generate — via the admin UI — for these five pages, judge each proposal by hand: `en::/off-plan-properties-in-paphos`, `en::/apartments-limassol`, `en::/blog/taxes-on-real-estate-in-cyprus` (three buried, three different content shapes), `de::/de/blog/wie-nach-zypern-auswandern` (unclicked, German), `en::/developers/domenica-group` (unclicked, developer profile). Pass = the operator would apply ≥4 of 5 metas as-written or with trivial edits. Then flip `APPLY_ENABLED` in its own commit recording the five judgments; until then Apply refuses server-side.
  - The advisor and Action Center automatically go quiet about any applied page for 42 days (suppression union) — no further wiring needed.

---

## What this plan does not build

Bulk generation, auto-publish, portable-text writes, apply for `fixed` pages, a second development generator, link-graph analysis, before/after verdicts for applied improvements (v1 records `appliedAt`; the comparable-window machinery in `titleSweepRemeasure.ts` is the follow-up's starting point).
