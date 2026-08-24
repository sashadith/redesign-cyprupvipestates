# Page Improver — Design

**Date:** 2026-08-24 · **Status:** approved direction ("Variante 2"), spec pending user review
**Depends on:** Page Power (live since 2026-08-23), `src/lib/ai/projectBrief.ts` (branch `feat/ai-project-brief`)

## Purpose

Page Power says *what is wrong* with a page and *why*. This feature closes the gap to *fixed*: an **Improve** action on a Page Power row that gathers everything known about that one page, has Claude draft the repair, and stores it as a reviewable draft whose meta fields can be **applied with one click** — never published without a human. The user chose this over a report-only variant explicitly: "der Weg von Diagnose zu veröffentlichter Verbesserung ist zwei Klicks statt zwanzig Minuten."

Target piles, in priority order (measured 2026-08-24): `buried` (79 pages, 63k impressions — work: content depth + internal links), `unclicked` (12 pages, 16k impressions — work: title/meta). The button renders on every row, but these two are why it exists.

## What was verified before this spec (all against production, 2026-08-24)

- **Sanity is gone.** Post-migration, `Blog`, `Singlepage`, `Developer`, `CaseStudy` rows in Postgres are the *source of truth*, one row per locale, each with `seo Json` shaped `{metaTitle, metaDescription}` (confirmed on real de/ru rows). `sanity.client.ts` is a local-asset shim; writes go nowhere else.
- **Admin editors already exist for every kind** — `content/blog/[id]`, `content/pages/[id]`, `content/developers/[id]`, `content/case-studies/[id]`, `content/landing/[id]`, `content/projects/[id]` — all reading `seo.metaTitle ?? ""`. Apply writes to exactly the rows those editors edit; no new write path is invented.
- **Developments** use `DevelopmentOverride.seo` (8 keys, 4 locales) and already have their own generator with digit-ban enforcement (`ai/seoMeta.ts`).
- Page metadata renders from these fields (checked `blog/[slug]/page.tsx` `generateMetadata`).

## Scope by page kind

| kind | Improve generates | Apply writes to |
|---|---|---|
| blog, singlepage, developer, caseStudy | title/meta + content sections + internal links | that row's `seo` Json (title/meta only) |
| project (legacy) | same | `Project` row's seo (same shape — verify at plan time) |
| development | — deep-link to the existing override editor + generator; attach the query-gap analysis as a note | (existing path; no second generator) |
| fixed (homepage, /projects, /faq, /partners) | proposal only, clearly labelled "code-authored page — apply by editing the code" | nothing |

Developments get no second generation path on purpose: two generators for the same fields drift apart, and the development pile is overwhelmingly `invisible` (487 of 1,125 — demand-side, text moves nothing).

## Data model

One new table:

```prisma
model PageImprovement {
  id          String   @id @default(cuid())
  pageKey     String   // "locale::path", the Page Power identity
  kind        String   // inventory kind at generation time
  targetTable String   // "Blog" | "Singlepage" | ... | "" for fixed
  targetId    String   // row id the apply writes to; "" for fixed
  status      String   // "draft" | "applied" | "dismissed"
  // Snapshot of what the model was told and what it proposed — the admin must
  // be able to see, months later, on which diagnosis a change was based.
  diagnosis   String
  reason      String
  proposal    Json     // see shape below
  currentSeo  Json     // {metaTitle, metaDescription} at generation time — staleness guard
  model       String
  createdAt   DateTime @default(now())
  appliedAt   DateTime?
  appliedBy   String?  // admin user id
}
```

`proposal` shape (tool-forced, validated):
```ts
{
  metaTitle: string,           // ≤58 chars, digit rules below
  metaDescription: string,     // ≤150 chars
  rationale: string,           // why, citing the page's own query data
  contentSections: Array<{ heading: string, draft: string, queriesServed: string[] }>,
  internalLinks: Array<{ fromPath: string, anchor: string, why: string }>,
}
```

At most one `draft` per pageKey; Regenerate replaces it. Dismissed/applied rows are kept — they are the history.

## Generation: what the model sees

System layer: `PROJECT_BRIEF` (shared steering; already carries the funnel, digit rule, locale rules, control-group humility). User payload, assembled per page:

1. **The verdict** — diagnosis, reason string (verbatim; it is the evidence), impressions/CTR/position, class verdict of its template class.
2. **Its real queries** — `SearchMetric` rows with `query != null` for this page, both URL variants pooled via `buildCanonicalMap()`, last 90 days, grouped by query with impressions/clicks/position. Labelled in the payload as *privacy-sampled — relative weights are meaningful, totals are not* (measured: 38 vs 217 clicks on the same pages).
3. **The page as served** — fetch the live URL server-side, strip to text (title, meta, headings, body, internal hrefs). Uniform across kinds; no per-kind content assembly. Internal links out come from this; links *in* are out of scope v1 (no link graph exists — the model may *suggest* fromPaths, the admin judges them).
4. **Two healthy siblings** — same template class, diagnosis `healthy`, highest impressions: their title/meta as working patterns from this site, not generic best practice.
5. **Guard status** — whether the page sits in a re-measurement window (see below).

## Hard rules, enforced not requested

- **Digit ban with the same teeth as `seoMeta.ts`:** extract `badFields()`-style validation into a shared helper; proposed title/meta containing a digit (excluding the page's own name) or an unknown placeholder → one corrective retry, then fail the generation visibly. Content sections MAY contain figures only as `{placeholder}` tokens where the surface supports them — for blog/singlepage prose it does not, so sections must be written figure-free (the brief's rule 1).
- **Length budgets** 58/150 with the generator's existing retry approach.
- **Locale:** the proposal is written in the page's own locale only (the row IS one locale). Admin UI text English.
- **Re-measurement guard:** generation is refused — not warned — for a page inside a live re-measurement window, showing the date it reopens. Recommending a rewrite mid-experiment corrupts the measurement; this rule already exists in three other places and this feature must not become the fourth surface that forgets it.
- **Staleness guard on apply:** apply compares the row's current `seo` against `currentSeo` captured at generation; mismatch → refuse with "page changed since this draft was generated — regenerate." Same posture as the stale-copy fix script's occurrence guard.

## Apply, and what it feeds back into

Apply is a server action: merge `metaTitle`/`metaDescription` into the target row's `seo` Json, stamp `appliedAt`/`appliedBy`. Content sections and internal links are **not** auto-applied — they render as copy-ready blocks beside a deep link to that page's existing admin editor (PtEditor handles body content; programmatic portable-text writing is deliberately out of scope v1).

**The measurement loop closes here:** `pagesInSuppressionWindow()` currently reads only `docs/SEO-TITLE-SWEEP-LOG.md`. It gains a second source — applied `PageImprovement` rows within `REMEASURE_WINDOW_DAYS` (42) of `appliedAt`. That one change makes the Action Center, the advisor, the Page Power items and this feature itself all automatically go quiet about a page whose fix is being measured, exactly as they do for the July sweep — no new mechanism, the existing one grows a second input. (The markdown log stays: it is the historical record of the manual sweeps. Runtime writes go to the DB row, not to a checked-in file that a deploy would overwrite.)

After the window: v1 records `appliedAt` and stops. Before/after verdicts reuse the comparable-window machinery built for the title sweep (`titleSweepRemeasure.ts`) — generalising that to arbitrary applied improvements is a follow-up, not v1. Page Power's 28-day trend column shows recovery in the meantime.

## UI

- Page Power table row → **Improve** link → `/admin/analytics/seo/power/improve?key=<encoded pageKey>` (query param, not a path segment — the key contains slashes).
- Screen: current state (diagnosis badge, reason, metrics, current title/meta) → Generate → proposal as current→proposed diff per field, rationale, content sections as copy blocks with the queries each serves, internal-link suggestions → **Apply meta** / **Dismiss** / **Regenerate**.
- An applied page shows its improvement history on the same screen.
- All admin copy English (project rule).

## Non-goals (v1)

- No auto-publish, ever. No bulk "improve all 79" queue — one page, one human, one decision; bulk is a later feature if the per-page loop proves itself.
- No body-content writes (portable text) — sections are drafts for the human in the existing editor.
- No apply for `fixed` pages; no second generator for developments.
- No link-graph analysis; no new locales; no changes to Page Power's diagnoses or thresholds.

## Verification (no test runner in this repo, by decision)

1. `tsc` + `next build` green; migration additive only (`prisma migrate` on the new table — **the local DB is production**; migration runs via the deploy path, `CVP_RUN_MIGRATE=1`, never ad hoc from a dev machine).
2. Live probe: generate against 3 real pages (one buried singlepage, one unclicked blog post, one developer profile) through a temp route on the dev server; validate proposal shape, digit ban, length budgets, locale.
3. **Calibration gate before the Apply button goes live:** generate for 5 real pages, the operator judges each proposal by hand — same 80%-precision posture as Page Power's Task 6. Apply ships disabled behind this gate; the review UI ships first.
4. Suppression-integration check: apply on a staging row (a test-only page), confirm the page drops out of the Action Center piles and the advisor payload flags it, then revert the row.

## Open risks, named

- `Project` (legacy) seo shape assumed equal to the others — verify at plan time; if it differs, legacy projects fall back to proposal-only in v1 and the spec's table gets a footnote, not a workaround.
- Healthy-sibling patterns can encode a bad habit as a pattern (39 healthy pages is a thin pool). The prompt labels them as "what works *on this site*", not as targets to copy verbatim.
- The query payload is sampled; a section drafted for a query the sample over-represents may chase noise. Mitigation is the human: `queriesServed` is displayed per section so the admin sees what a section is for before pasting it.
