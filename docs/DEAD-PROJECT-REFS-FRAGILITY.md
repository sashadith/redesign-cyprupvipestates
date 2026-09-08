# `.projects` refs pointing at archived rows: working today only because of a redirect substitution

**Status:** logged, not fixed. No code or DB changes made — this document is the handover record.
**Found:** 2026-09-08, while investigating a genuine 404 on a RU blog article (`/ru/blog/raznica-mezhdu-kiprom-i-severnym-kiprom` → `/ru/projects/panorama-hills`), which led to checking how many other pages carry the same class of stale reference.

## Summary

`landingProjectsBlock`/`projectsSectionBlock`'s manual `projects` array stores plain sanityId refs. When a pinned project is later `ARCHIVED` (superseded by a Development, sold off, or otherwise retired), the ref itself is never cleaned up — the card keeps rendering because `resolveProjectRefs` (`src/sanity/sanity.utils.ts`) has no status filter at all, and additionally rewrites the card's `href`/`slug` to the archived row's `legacyProjectRedirect.targetPath` when one exists. That substitution is the only thing standing between a normal-looking card and a dead link. It is not guaranteed, it is not tested, and its coverage is inconsistent today.

## The numbers

Queried every **published** Blog, Singlepage, CaseStudy, and homepage `SiteDocument` (all 4 locales) for `.projects` array refs pointing at a sanityId whose `Project` row has `status: "ARCHIVED"`.

- **103 published pages** carry at least one such ref — 99 found via the standard `contentBlocks` scan (blog articles + Singlepage landing pages + case studies), plus **all 4 language homepages**, whose `featuredProjectsBlock` (a separate top-level field, not inside `contentBlocks`) carries 10 dead refs each and was missed by the generic scanner until checked explicitly.
- **462 distinct archived sanityIds** are referenced this way across those pages (a single page typically pins several archived projects at once).
- Of those 462: **406 currently render a working link**, purely because `legacyProjectRedirect` has a row for that sanityId and `resolveProjectRefs` substitutes it in.
- **56 have no redirect row at all** — these are not "fragile," they are already dead right now, rendering a card whose href 404s if clicked, on whichever of the 103 pages happens to pin them.

## Why this is fragile, not just currently-broken-in-56-places

`resolveProjectRefs`'s redirect substitution was written for one purpose (avoiding an "avoidable extra hop" through a 308 for legacy-vs-canonical-slug drift), not as a load-bearing dead-link-prevention layer. Nothing about its contract promises that behavior, nothing tests for it, and nothing would notice if a future change to that function (or to how `legacyProjectRedirect` rows are queried) silently dropped the substitution. If that happens, all 406 currently-working cards break in the same release — not gradually, not with a warning, all at once, because the one thing keeping them alive is a side effect of a function that exists for a different reason.

## A related, narrower finding: redirect coverage is itself inconsistent

Separately, while investigating the RU Panorama Hills 404: `legacyProjectRedirect` rows are near-100% locale-inconsistent. Of 184 `ARCHIVED`-project translation groups:

- **154** have a redirect for every locale sibling.
- **29** have a redirect for **EN only** — RU/DE/PL are all missing it, every time, no exceptions. This is not scattered gaps; it is one systematic pattern (whatever process created these rows only ever wrote the English one).
- **1** ("Infinity") has no redirect in any locale.

Panorama Hills is one of the 29. Its EN sibling redirects to `/developers/agg-luxury-homes`; RU/DE/PL do not, which is the direct cause of the 404 that surfaced this investigation.

## Not fixed here, on purpose

Per the scope of the task that produced this document: log the mechanism and the count, do not act. Two independent follow-ups this suggests, neither started:
1. Backfill the missing RU/DE/PL redirect rows for the 29 partially-covered groups (and decide what "Infinity" should point to).
2. Decide whether `resolveProjectRefs`'s redirect substitution should become an explicit, tested contract (or whether the real fix is cleaning stale refs out of `.projects` arrays as archival happens, so nothing depends on the substitution at all).
