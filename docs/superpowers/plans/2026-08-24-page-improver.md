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
| `prisma/migrations/20260824140000_add_page_improvement/migration.sql` (new) | Additive migration, applied only at deploy |
| `src/lib/seo/pagePower/inventory.ts` (modify) | `InventoryPage.source` — the row Apply writes to |
| `src/lib/seo/titleSweepLog.ts` (modify) | Applied improvements as second suppression source |
| `src/lib/ai/seoMeta.ts` (modify) | Delegate its digit check to `copyRules.ts` (behavior identical) |
| `src/app/admin/(panel)/analytics/seo/power/PagePowerTable.tsx` (modify) | Improve link per row |

---

## Task 1: Shared copy rules

**Files:** Create `src/lib/ai/copyRules.ts` · Modify `src/lib/ai/seoMeta.ts`

- [x] **Step 1: Create the shared module**

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
//  - `allowYears`: a bare year from ALLOWED_YEARS is stripped before the digit
//    test. The site's own healthy pages carry years in their titles ("Cyprus
//    Property Taxes: Full Guide 2026") and banning them would reject the exact
//    pattern the site's best performers use. The development generator does NOT
//    pass this option — its figures drift with every feed sync and the full ban
//    stands.
//
//    Be precise about what this costs, because the first draft of this comment
//    was wrong about it: stripping years does NOT keep "sizes and street
//    numbers banned". Any figure that happens to BE an allowed year passes —
//    "2026 Griva Digeni Avenue" and "2024 units left" both slip through, and
//    "2050 m²" did too while the band was the full 20\d\d. The band is
//    therefore kept to the years this copy could plausibly carry rather than a
//    century of them, which is the difference between ~7 values of
//    false-negative surface and 100. Widen it when the calendar demands, not
//    for convenience. Note also that "2000 m2" is caught only by the "2" in
//    "m2" — write the site's own "m²" and that accident disappears.
//
//  - `placeholders: "none"`: {priceFrom} & co. resolve ONLY on the Development
//    render path (developmentSeo.ts). A blog page's generateMetadata reads
//    seo.metaTitle raw, so a placeholder written there would appear verbatim
//    in a Google snippet. For those kinds any {token} is a violation, not just
//    an unknown one.
//
// `allowedName` is not one of those differences — both consumers pass it, and it
// predates the extraction: a digit in the SUBJECT'S OWN NAME is not a figure.
// Several developments are numbered — Glow 2, Abiete 2, Avalon Gardens 2,
// Roseland Villas 1 — and a bare /\d/ check rejects every possible sentence
// about them, making "Generate with Claude" permanently impossible for those
// projects. The name is stripped before the digit test, never from the text that
// gets stored.
const KNOWN_PLACEHOLDERS = new Set<string>(SEO_PLACEHOLDERS);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The years `allowYears` tolerates. Deliberately narrow: every value here is
 *  a figure the digit ban stops seeing, so the band is the exception's real
 *  cost. 2024-2030 covers "Guide 2026" and a forward-looking outlook piece;
 *  it does not cover a 2050 m² plot. Revisit when the calendar reaches the
 *  upper bound (set 2026-08-24). */
const ALLOWED_YEARS = /\b20(?:2[4-9]|30)\b/g;

export type CopyViolation = "digit" | "placeholder";

export function copyViolation(
  raw: string,
  opts?: { allowedName?: string; allowYears?: boolean; placeholders?: "known" | "none" },
): CopyViolation | null {
  const name = opts?.allowedName?.trim();
  let v = name ? raw.replace(new RegExp(escapeRe(name), "gi"), "") : raw;
  if (opts?.allowYears) v = v.replace(ALLOWED_YEARS, "");
  if (/\d/.test(v)) return "digit";
  // Two different questions, so two different patterns.
  //
  // "none" asks "is there anything brace-shaped here at all", so it tests for a
  // BRACE, not for a well-formed token. Both narrower spellings were tried and
  // both were wrong: the \w class below matches neither `{price-from}` nor
  // `{price from}` nor `{a.b}`, and `/\{[^}]*\}/` still missed an UNCLOSED
  // one — which is the malformation this repo has actually seen, Golden Hills
  // generating "… From {priceF…" (recorded in seoMeta.ts's clamp comment).
  // On the development path a half-token is caught downstream, because
  // developmentSeo.ts treats a stray `{` or `}` as unresolved and falls back to
  // auto text. On the blog/singlepage path nothing does — generateMetadata
  // reads seo.metaTitle raw — which is the whole premise of this mode.
  if (opts?.placeholders === "none") return /[{}]/.test(v) ? "placeholder" : null;
  // Ordering note, latent today: year-stripping happens BEFORE this scan and
  // rewrites `v`, so `allowYears` WITHOUT `placeholders: "none"` lets
  // "{priceFrom 2026}" through — the strip breaks the token apart. No consumer
  // passes that combination (Task 5's kinds pair the two), and pairing them is
  // the intended use; a future caller that wants years but not the brace ban
  // must scan the raw string instead.
  //
  // "known" (the default, and the development generator's path) asks the
  // narrower question "is this one of OUR tokens", and keeps \w deliberately:
  // widening it here would change what seoMeta.ts rejects, and that generator's
  // behaviour is calibrated. A malformed token there is caught downstream
  // anyway — resolveMetaDescription discards copy carrying one.
  let m: RegExpExecArray | null;
  const re = /\{(\w*)\}/g;
  while ((m = re.exec(v)) !== null) {
    if (!KNOWN_PLACEHOLDERS.has(m[1])) return "placeholder";
  }
  return null;
}
```

- [x] **Step 2: Delegate `badFields` in seoMeta.ts**

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

- [x] **Step 3: Verify behavior is identical for the old consumer**

Run: `npx tsc --noEmit` — exit 0. Then confirm by inspection (state it in your report): for `placeholders` unset and `allowYears` unset, `copyViolation` is the exact predicate `badFields` had — same name-strip, same `/\d/`, same unknown-token loop.

- [x] **Step 4: Commit**

---

## Task 2: Prisma model + migration + historical stamp

**Files:** Modify `prisma/schema.prisma` · Create `prisma/migrations/20260824140000_add_page_improvement/migration.sql` · Modify `docs/superpowers/plans/2026-08-23-seo-page-power.md` (two lines at the top)

- [x] **Step 1: Add the model** (append after the last content model, matching the schema's section-comment style)

```prisma
// ─── PAGE IMPROVER (AI-drafted per-page fixes; see docs/superpowers/specs/2026-08-24-page-improver-design.md) ───
model PageImprovement {
  id          String    @id @default(uuid())
  pageKey     String // "locale::path" — the Page Power identity of the page
  kind        String // inventory kind at generation time
  targetTable String // "Blog" | "Singlepage" | "Developer" | "CaseStudy" | "Project"; "" when apply has no row (fixed pages)
  targetId    String // row id Apply writes to; "" for fixed pages
  status      String // "draft" | "applied" | "dismissed" — see the draft-uniqueness note on @@index below
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

  // "At most one draft per pageKey" is a BEST-EFFORT invariant, not a
  // guarantee: the generate action deletes the standing draft and inserts the
  // new one, and under READ COMMITTED two concurrent generates for the same
  // page can both find nothing to delete and both insert. The honest fix is a
  // partial unique index (`... ON page_improvements("pageKey") WHERE status =
  // 'draft'`), which Prisma 5's schema language cannot express — and adding it
  // in raw SQL would make it the first schema object in this repo that Prisma
  // cannot see, i.e. permanent reported drift where there is none today
  // (checked 2026-08-24: no existing migration creates one). Traded away
  // deliberately: the UI disables the button while a generation is in flight,
  // one admin operates it, and the cost of a stray second draft is an orphaned
  // row, not a wrong page. Revisit if this ever becomes a bulk action.
  @@index([pageKey, status])
  @@index([status, appliedAt])
  // Every one of the other 44 models maps to a snake_case plural physical
  // table; without this one line this would be the only PascalCase table in
  // the database, and renaming a live table after Task 8's deploy is its own
  // migration. The Prisma accessor stays `prisma.pageImprovement` either way.
  @@map("page_improvements")
}
```

- [x] **Step 2: Write the migration SQL** (hand-written; do NOT run `prisma migrate dev` — it would connect to production)

```sql
-- Additive only. Applied exclusively via the deploy path (CVP_RUN_MIGRATE=1).
CREATE TABLE "page_improvements" (
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

    CONSTRAINT "page_improvements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_improvements_pageKey_status_idx" ON "page_improvements"("pageKey", "status");

CREATE INDEX "page_improvements_status_appliedAt_idx" ON "page_improvements"("status", "appliedAt");
```

- [x] **Step 3: Regenerate the client and stamp the old plan**

Run: `npx prisma generate` (local codegen only — touches no database). Then insert directly under the H1 of `docs/superpowers/plans/2026-08-23-seo-page-power.md`:

```markdown
> **Historical since the 2026-08-24 merge to main.** The byte-identical-fence convention applied during this plan's execution only; source files have moved on (first: `inventory.ts` grew `InventoryPage.source` for the Page Improver). Do not "fix" fences here to match the tree.
```

- [x] **Step 4: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 3: Inventory source refs + the suppression union

**Files:** Modify `src/lib/seo/pagePower/inventory.ts` · Modify `src/lib/seo/titleSweepLog.ts`

- [x] **Step 1: Extend `InventoryPage`** — append to the type, after `publishedAt`:

```typescript
  /** The DB row Apply would write to — or null where no row exists (`fixed`
   *  pages are code-authored). Added 2026-08-24 for the Page Improver, which
   *  needs pageKey → row without re-deriving the path logic above (the nested
   *  Singlepage walk in particular must not exist twice). Page Power itself
   *  never reads this. */
  source: { table: "Development" | "Project" | "Blog" | "Singlepage" | "Developer" | "CaseStudy"; id: string } | null;
```

- [x] **Step 2: Fill it.** Add `id: true` to each of the six `select` blocks in `getInventory()`, and extend each push:

- devs loop: `source: { table: "Development", id: d.id }`
- projects loop: `source: { table: "Project", id: p.id }`
- blogs loop: `source: { table: "Blog", id: b.id }`
- singles loop: `source: { table: "Singlepage", id: s.id }`
- developers loop: `source: { table: "Developer", id: dev.id }`
- caseStudies loop: `source: { table: "CaseStudy", id: c.id }`
- fixed loop: `source: null`

(`SinglepageRow` needs `id: string` added to its type alias.)

- [x] **Step 3: The suppression union.** In `titleSweepLog.ts`, add `import { prisma } from "@/lib/prisma";` and replace `pagesInSuppressionWindow` with:

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

- [x] **Step 4: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 4: Target resolution + payload gathering

**Files:** Create `src/lib/ai/pageImprover/types.ts` · Create `src/lib/ai/pageImprover/target.ts` · Create `src/lib/ai/pageImprover/gather.ts`

- [x] **Step 1: types.ts**

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

- [x] **Step 2: target.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { getInventory, type InventoryPage } from "@/lib/seo/pagePower/inventory";
import type { CurrentSeo } from "./types";

// pageKey -> the inventory page (which carries `source`, the row Apply writes
// to). Resolved through getInventory() rather than by re-parsing the path:
// the nested-Singlepage walk and the development/legacy collision rule must
// not exist twice, and the inventory is already the single source of truth
// for "what page is this URL".
//
// `inventory` is an optional already-loaded copy, for callers resolving more
// than one key. getInventory() reads six tables and costs 1,965 ms cold /
// ~250 ms warm for 1,696 pages (measured against production 2026-08-24), so a
// caller resolving five keys pays it five times unless it threads one through
// — see gatherImprovementInput, which does, and which measured 775 ms against
// 246 ms for exactly that.
export async function resolveTarget(pageKey: string, inventory?: InventoryPage[]): Promise<InventoryPage | null> {
  const pages = inventory ?? (await getInventory());
  return pages.find((p) => p.key === pageKey) ?? null;
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
// touch is visible in one place. `Project` was the one shape the spec only
// ASSUMED; it holds. Measured across every row of all five tables on
// 2026-08-24: 887 Projects, 208 Blogs, 182 Singlepages, 88 Developers and 12
// Case Studies, 1,377 rows, every one of them a Json object carrying exactly
// `metaTitle` and `metaDescription` and nothing else — no nulls, no third key
// anywhere. The five admin editors read `seo.metaTitle ?? ""` identically.
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
  // Merge, not replace. No row carries a third key today (the census above),
  // so this is not repairing a known case — it is the same shape the admin
  // editors already write through (`data.seo = { ...prev.seo, metaTitle,
  // metaDescription }`, src/app/admin/actions.ts). A replace would work now
  // and silently strip the first openGraph or legacy field anyone adds later,
  // and the loss would show up as a rendering change nobody connects to Apply.
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

- [x] **Step 3: gather.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import type { PageVerdict, ClassVerdict } from "@/lib/seo/pagePower/types";
import { REMEASURE_WINDOW_DAYS } from "@/lib/seo/titleSweepRemeasure";
import { pagesInSuppressionWindow } from "@/lib/seo/titleSweepLog";
import { templateClassOf } from "@/lib/seo/templateClass";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { getInventory, type InventoryPage } from "@/lib/seo/pagePower/inventory";
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
  /** True when the page sits in a live re-measurement window — generation must
   *  REFUSE, not warn (spec rule; three other surfaces already enforce this and
   *  the improver must not become the fourth to forget). */
  suppressed: boolean;
};

// Every historical URL whose GSC history belongs to this page, resolved through
// the SAME redirect map Page Power's own totals go through (urlCanonical.ts)
// instead of by guessing at prefix shapes. GSC keeps every URL variant it has
// ever seen as its own series, so matching one URL exactly loses most of the
// baseline: the title-sweep re-measurement made that mistake and reported 234
// of 2,698 impressions for the biggest page in its batch. Measured here
// 2026-08-24 over the 90-day window, /de/blog/wo-leben-die-meisten-deutschen-
// auf-zypern draws 497 queries and 1,734 impressions at its current URL and
// 914 queries and 3,871 impressions across both of them.
//
// Deriving the second variant by STRIPPING the locale prefix — the obvious
// shape, and the one this function had when the plan was written — is wrong in
// the other direction, and wrong quietly. Only two migrations ever happened
// (redirect-mapping.csv: 358 EN-strip rows, 74 DE-to-/de); Polish and Russian
// never moved at all, and German pages created after the flip never lived at a
// bare URL either. For all of those the bare path is not an old URL of this
// page, it is a DIFFERENT LIVE PAGE — English ever since the flip. Measured
// 2026-08-24, the strip pooled another page's data into 84 de/pl/ru pages
// worth 7,757 impressions: the Russian homepage would have been handed the
// English homepage's 833 impressions on top of its own 357, and
// /ru/developers/agg-luxury-homes would have gone to the model as 12 of its
// own impressions and 611 borrowed, every borrowed query in the wrong
// language. The map also earns 358 impressions across 55 archived legacy
// project URLs that no prefix rule would ever have found.
//
// The two pattern-only redirects urlCanonical.ts handles (preview-project/*,
// properties/*) are not inverted here: measured 2026-08-24 they carry 1
// impression and 0 rows respectively in the window, which is not worth
// enumerating an unbounded pattern's preimage for.
export async function urlVariants(locale: string, path: string): Promise<string[]> {
  const map = await buildCanonicalMap();
  const variants = new Set<string>([path]);
  // Safe for English in a way the prefix strip is not for the others: /en/* is
  // a dead prefix serving nothing of its own, and all 358 EN rows in the CSV
  // target exactly the bare strip. Kept alongside the map because the map's
  // CSV half is a one-time migration snapshot — 2 of the 230 /en URLs still
  // drawing impressions are missing from it.
  if (locale === "en") variants.add(path === "/" ? "/en" : `/en${path}`);
  for (const from of Array.from(map.keys())) {
    if (canonicalize(map, localeOfPath(from), from).page === path) variants.add(from);
  }
  return Array.from(variants);
}

async function fetchQueries(locale: string, path: string): Promise<QueryRow[]> {
  const since = new Date(Date.now() - IMPROVER_WINDOW_DAYS * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: { not: null }, date: { gte: since }, page: { in: await urlVariants(locale, path) } },
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
  // One inventory for the whole call, threaded into every resolveTarget below.
  // This function resolves up to five keys (the page plus four healthy
  // siblings) and resolveTarget loads the inventory per call otherwise —
  // getInventory() reads six tables for 1,696 pages, 1,965 ms cold and ~250 ms
  // warm. Measured against production 2026-08-24 in this function's exact call
  // shape (one resolve, then four in parallel), four repetitions on a warm
  // pool: 775 ms average un-memoised against 246 ms memoised. Half a second
  // and ~6,800 redundant rows off every Improve click for one extra parameter.
  // Loaded alongside the verdicts rather than before them because neither needs
  // the other, and the unknown-key throw below is an admin-typo path, not a hot
  // one worth serialising for.
  const [inventory, { verdicts }, classes, suppressedPaths] = await Promise.all([
    getInventory(),
    getPageVerdicts(),
    getClassVerdicts(),
    pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS),
  ]);
  const page = await resolveTarget(pageKey, inventory);
  if (!page) throw new Error(`Unknown page: ${pageKey}`);
  const verdict = verdicts.find((v) => v.key === pageKey) ?? null;

  // Healthy siblings of the same template class, as working patterns FROM THIS
  // SITE — labelled that way in the prompt, not as targets to copy: the
  // healthy pool is 39 pages and a thin pool can encode a habit as a pattern.
  const cls = templateClassOf(page.path);
  const healthySiblings = verdicts
    .filter((v) => v.diagnosis === "healthy" && v.key !== pageKey && templateClassOf(v.path) === cls)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 4);
  const siblingSeo = await Promise.all(healthySiblings.map(async (s) => {
    const t = await resolveTarget(s.key, inventory);
    if (!t?.source || !isSeoTable(t.source.table)) return null;
    const seo = await readTargetSeo(t.source.table, t.source.id);
    if (!seo || (!seo.metaTitle && !seo.metaDescription)) return null;
    return { path: s.path, metaTitle: seo.metaTitle, metaDescription: seo.metaDescription };
  }));
  const siblings = siblingSeo.filter((s): s is SiblingPattern => s !== null).slice(0, 2);

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

- [x] **Step 4: `npx tsc --noEmit` → exit 0. Commit.**

---

## Task 5: Generation

**Files:** Create `src/lib/ai/pageImprover/generate.ts`

- [x] **Step 1: The module**

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
// Quoted in the prompt AND in the rejection note, so a model told "only a bare
// year" cannot be rejected for writing one outside the band copyRules.ts
// actually allows — a note reading "only a bare year is allowed" is
// unactionable when the model just wrote 2035.
const ALLOWED_YEAR_LOW = 2024;
const ALLOWED_YEAR_HIGH = 2030;

const ROLE = `You are drafting a concrete repair for ONE page of this site, based on its diagnosis and its own search data.

Rules for this task, on top of the brief:
- Write the metaTitle and metaDescription in the page's own locale (given in the payload). They must contain NO digits (a bare year between ${ALLOWED_YEAR_LOW} and ${ALLOWED_YEAR_HIGH} is the only exception) and NO {placeholder} tokens — this page's render path does not resolve them, so anything you write appears verbatim in the Google snippet.
- metaTitle: aim 45–55 characters, hard ceiling ${IMPROVER_TITLE_BUDGET}. metaDescription: aim 130–145, hard ceiling ${IMPROVER_DESC_BUDGET}. Put the reason to click in the first half.
- contentSections are drafts for a HUMAN EDITOR, in the page's locale, each serving named queries from the payload. Figure-free prose (year exception applies). 2–4 sections; if the diagnosis is about the title rather than the content, fewer or none is correct.
- internalLinks suggest links FROM other pages of this site TO this page (fromPath must be a plausible path on this site — prefer ones you saw in the payload). These are suggestions for the human; you cannot see the whole site.
- The sibling examples show what currently works ON THIS SITE. They are patterns, not targets to copy; do not produce near-duplicates of them.
- rationale: two or three sentences citing the page's own query data. If the sampled queries are too thin to justify a section, say so there instead of inventing one.`;

/** Split, because the two kinds of violation deserve different endings.
 *
 *  A digit or a brace is DANGEROUS: it reaches a Google snippet verbatim (the
 *  blog render path reads seo.metaTitle raw) and figures baked into stored copy
 *  are the incident this whole rule exists for. Those still throw.
 *
 *  Length is COSMETIC: Google truncates an over-long description, it is not
 *  wrong, and seoMeta.ts reaches the same conclusion from the other direction —
 *  it clamps rather than fails for exactly this reason. Throwing on it would
 *  cost more than it saves here: the operator would get NOTHING to judge, and
 *  German and Russian run long enough that a stubborn model could make Improve
 *  unusable for a whole locale — including during the calibration gate, which
 *  needs five successful generations to pass. The draft is returned instead,
 *  and Task 7's UI shows every field's character count against its budget, so
 *  an over-long line is visible and one keystroke from fixed. */
const violationNotes = (p: Partial<ImprovementProposal>): { dangerous: string[]; cosmetic: string[] } => {
  const dangerous: string[] = [];
  const cosmetic: string[] = [];
  const meta: Array<[string, string | undefined, number]> = [
    ["metaTitle", p.metaTitle, IMPROVER_TITLE_BUDGET],
    ["metaDescription", p.metaDescription, IMPROVER_DESC_BUDGET],
  ];
  for (const [field, value, budget] of meta) {
    const v = value ?? "";
    if (copyViolation(v, { allowYears: true, placeholders: "none" }))
      dangerous.push(`${field} contains a digit or a {placeholder}. Only a bare year between ${ALLOWED_YEAR_LOW} and ${ALLOWED_YEAR_HIGH} is allowed, and no brace token ever is. Rewrite it without the figure — drop the fact, do not spell it in words.`);
    if (v.trim().length > budget)
      cosmetic.push(`${field} is ${v.trim().length} characters against a hard ceiling of ${budget}. Rewrite it shorter by dropping the least important detail.`);
  }
  for (const [i, s] of Array.from((p.contentSections ?? []).entries())) {
    if (copyViolation(`${s.heading} ${s.draft}`, { allowYears: true, placeholders: "none" }))
      dangerous.push(`contentSections[${i}] contains a digit or a {placeholder}. Prose on this page type must be figure-free (only a bare year between ${ALLOWED_YEAR_LOW} and ${ALLOWED_YEAR_HIGH} is excepted) — rewrite that section.`);
  }
  return { dangerous, cosmetic };
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
        // No cast on this literal. seoMeta.ts and seoAdvisor/analyze.ts both
        // carry `as any` here and the plan's draft of this file carried
        // `as never`; checked 2026-08-24 against @anthropic-ai/sdk 0.110.0,
        // all three are unnecessary — Tool.InputSchema is
        // `{ type: "object"; properties?: unknown; required?: string[] }` with
        // an index signature, so the uncast literal assigns cleanly. Keeping it
        // uncast is not tidiness: a cast makes `type: "objekt"` or a `required`
        // holding a non-string compile, and this is the one path in the feature
        // where a broken schema surfaces only as a 400 from a call nobody can
        // run locally (no ANTHROPIC_API_KEY on this machine, by decision).
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
        },
      }],
      tool_choice: { type: "tool", name: "page_improvement" },
      messages: [{ role: "user", content: `${JSON.stringify(payload, null, 1)}${correction ? `\n\n${correction}` : ""}` }],
    });
    const tool = msg.content.find((b) => b.type === "tool_use") as { input?: Partial<ImprovementProposal> } | undefined;
    const raw = tool?.input ?? {};
    if (!raw.metaTitle && !raw.metaDescription) throw new Error(`No content (stop: ${msg.stop_reason})`);
    // The schema puts metaTitle/metaDescription/rationale first, so a truncated
    // tool call loses the human-review tail and still passes the emptiness test
    // above — it would return a proposal with sections silently missing.
    // Measured 2026-08-24 the worst real payload is nowhere near the ceiling
    // (Russian ~2.4k tokens against 4096), which is exactly why this needs a
    // guard rather than trust: nothing here will get slower gradually, it will
    // fail the first time a page is unusually long.
    if (msg.stop_reason === "max_tokens") throw new Error("Proposal was cut off at max_tokens — the page is unusually long; regenerate or raise the ceiling.");
    return raw;
  };

  let raw = await attempt();
  const first = violationNotes(raw);
  const notes = [...first.dangerous, ...first.cosmetic];
  // The retry names what broke, because a blind second call with the identical
  // prompt mostly reproduces the same mistake (seoMeta.ts's retry, same
  // reasoning). It asks for a WHOLE new draft rather than a patch: attempt()
  // replays no assistant turn, so the second call cannot see the text it is
  // being corrected on, and an instruction to "keep the rest" would name
  // something the model is not holding.
  if (notes.length)
    raw = await attempt(`Your first draft was rejected on the points below. Write the proposal again in full — you are not editing that draft, you cannot see it — and avoid these faults:\n- ${notes.join("\n- ")}`);
  const still = violationNotes(raw);
  if (still.dangerous.length)
    throw new Error(`Proposal still violates the copy rules after a retry: ${still.dangerous.join(" · ")}`);

  return {
    metaTitle: (raw.metaTitle ?? "").trim(),
    metaDescription: (raw.metaDescription ?? "").trim(),
    rationale: (raw.rationale ?? "").trim(),
    contentSections: raw.contentSections ?? [],
    internalLinks: raw.internalLinks ?? [],
  };
}
```

- [x] **Step 2: `npx tsc --noEmit` → exit 0. Commit.**

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
  - **Do not reorder the deploy.** `deploy-prod.sh` runs the migration (line ~254) BEFORE the build and long before the symlink swap (~line 326), which is what keeps the missing-table window closed: the currently-live release never queries the new table, and by the time the new one serves it exists. Verified 2026-08-24. It matters because `src/lib/prisma.ts` logs at `["error"]` in production and a `P2021` passes through that logger before being caught — so a swap-before-migrate ordering would print a multi-line "table does not exist" block on every Action Center render and every admin SEO view until the migration landed. Loud rather than silent is the right trade for the tolerance itself, but there is no reason to pay it in production.
  - **Calibration gate (in production, after deploy):** generate — via the admin UI — for these five pages, judge each proposal by hand: `en::/off-plan-properties-in-paphos`, `en::/apartments-limassol`, `en::/blog/taxes-on-real-estate-in-cyprus` (three buried, three different content shapes), `de::/de/blog/wie-nach-zypern-auswandern` (unclicked, German), `en::/developers/domenica-group` (unclicked, developer profile). Pass = the operator would apply ≥4 of 5 metas as-written or with trivial edits. Then flip `APPLY_ENABLED` in its own commit recording the five judgments; until then Apply refuses server-side.
  - The advisor and Action Center automatically go quiet about any applied page for 42 days (suppression union) — no further wiring needed.

---

## What this plan does not build

Bulk generation, auto-publish, portable-text writes, apply for `fixed` pages, a second development generator, link-graph analysis, before/after verdicts for applied improvements (v1 records `appliedAt`; the comparable-window machinery in `titleSweepRemeasure.ts` is the follow-up's starting point).
