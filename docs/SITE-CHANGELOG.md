# Site Changelog

Structural/routing/content changes that can shift GSC metrics for reasons
unrelated to ranking quality — index migration, URL consolidation, page
archival. Fed into the weekly SEO Advisor's gather step (last 60 days) so it
attributes overlapping metric shifts to a known transition FIRST, before
reading them as a ranking problem. Add an entry here whenever a change could
plausibly move click/impression/position numbers for reasons other than
"the page got better or worse at ranking."

## 2026-07-16 — Unified `/projects` listing

Commit `76afed2`. Merged the legacy Sanity `Project` listing and the new
`Development` system into one `/projects` listing page, deduplicating any
legacy project already superseded by a Development. No URL changes to
individual detail pages yet — this was the listing page only.

## 2026-07-17 — URL unification (route dispatcher + redirect cutover)

Commit `6bc6e51`. `/projects/[slug]` became a single dispatcher: a published
`Development` is tried first, a legacy `Project` is the fallback. The old
`/preview-project/[slug]` route became a thin 301 stub to `/projects/[slug]`.
`NEW_PROJECTS_INDEXABLE` flipped to `true` — Development-backed pages became
indexable for the first time.

**Archivals:** 96 legacy `Project` rows were archived (redirecting to their
linked Development's `/projects/[slug]` URL) on this date — 100 total as of
this writing. Any GSC series for a legacy project URL from before 2026-07-17
should be read as migrating to its Development's URL, not disappearing.

**Expect:** legacy project URLs losing clicks/impressions while their linked
Development URL gains them, for weeks after this date as Google re-crawls.

## 2026-07-18 — Internal-link health fixes + title/meta sweep

Two changes landed the same day:

- **Commit `2bbd3f8`** (16:30): fixed shared card-building resolvers
  (`resolveProjectRefs`, `getProjectsByDeveloper`,
  `getThreeProjectsBySameCity`) that were linking through an avoidable 308 hop
  to superseded pages instead of the current Development URL directly — found
  on ~1/3 of crawled pages. Also fixed a dead related-article link. This
  changes internal link equity distribution site-wide, not any one page's
  content.
- **Commit `a45e068`** / `docs/SEO-TITLE-SWEEP-LOG.md`: 17 individually
  curated title/meta rewrites + a 13-page developer-profile template
  reformula. See that log for the full list and each page's 42-day
  re-measurement window (through 2026-08-29) — **the Advisor must not suggest
  touching any URL still in that window.**

**Expect:** CTR/position shifts on the swept pages from 2026-07-18 onward are
the intended effect being measured, not noise — but any OTHER page's traffic
shift in this window could plausibly be downstream of the link-equity
redistribution from `2bbd3f8`, not an independent event.

## Known migration-era GSC artifact (not a changelog entry, a standing caveat)

Beyond the above, an EARLIER locale-prefix migration (English made prefix-less,
German-only content moved under `/de/`) left ~432 old URLs still indexed and
slowly losing traffic to their `/de/` or prefix-stripped canonical counterpart,
via a live 301 (nginx-level for the `/de/` cases, next-intl-level for the
`/en/`-strip cases). This is why `src/lib/seo/urlCanonical.ts` exists — it
merges these pairs before the Advisor computes any delta, so this ongoing
consolidation can't masquerade as a fresh ranking collapse. See that file's
header comment for the full source list.
