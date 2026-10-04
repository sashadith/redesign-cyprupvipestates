# `.projects` refs pointing at archived rows: working today only because of a redirect substitution

**Status:** the immediate backlog is cleared (56 → 4 dead refs; see "What's been fixed" below), but the underlying design point stands: the render path stays dependent on a substitution that was written for a different reason and was never a tested contract. One named open case remains (Infinity — a genuine slug collision, not a missing redirect; see below).
**Found:** 2026-09-08, while investigating a genuine 404 on a RU blog article (`/ru/blog/raznica-mezhdu-kiprom-i-severnym-kiprom` → `/ru/projects/panorama-hills`), which led to checking how many other pages carry the same class of stale reference.
**Updated:** 2026-09-08, same day — 34 translation groups (109 redirect rows) fixed across several passes: Panorama Hills, a 26-group/78-row backfill, Seaview + Oasis Garden (a wrong developer slug, not a missing row), Gioia West (same), and Aion/Noble Apartments/Konia Aura/Olea Residences (redirects that pointed at a Development which was *itself* archived — fixed to point at the developer's page instead, same pattern as Panorama Hills).

## Summary

`landingProjectsBlock`/`projectsSectionBlock`'s manual `projects` array stores plain sanityId refs. When a pinned project is later `ARCHIVED` (superseded by a Development, sold off, or otherwise retired), the ref itself is never cleaned up — the card keeps rendering because `resolveProjectRefs` (`src/sanity/sanity.utils.ts`) has no status filter at all, and additionally rewrites the card's `href`/`slug` to the archived row's `legacyProjectRedirect.targetPath` when one exists. That substitution is the only thing standing between a normal-looking card and a dead link. It is not guaranteed, it is not tested, and its coverage is inconsistent today.

## The numbers

Queried every **published** Blog, Singlepage, CaseStudy, and homepage `SiteDocument` (all 4 locales) for `.projects` array refs pointing at a sanityId whose `Project` row has `status: "ARCHIVED"`.

- **103 published pages** carry at least one such ref — 99 found via the standard `contentBlocks` scan (blog articles + Singlepage landing pages + case studies), plus **all 4 language homepages**, whose `featuredProjectsBlock` (a separate top-level field, not inside `contentBlocks`) carries 10 dead refs each and was missed by the generic scanner until checked explicitly.
- **~466 distinct archived sanityIds** are referenced this way across those pages (a single page typically pins several archived projects at once; the exact count drifts slightly day to day as new archiving happens elsewhere on the site).
- **As of 2026-09-08 (post-fix): 462 render a working link** via the `legacyProjectRedirect` substitution. **Only 4 remain genuinely dead — all 4 locale rows of "Infinity"** (see "Open case" below). Before today's fixes this was 406 rescued / 56 dead — see "What's been fixed."

## Why this is fragile, even now that the backlog is clear

`resolveProjectRefs`'s redirect substitution was written for one purpose (avoiding an "avoidable extra hop" through a 308 for legacy-vs-canonical-slug drift), not as a load-bearing dead-link-prevention layer. Nothing about its contract promises that behavior, nothing tests for it, and nothing would notice if a future change to that function (or to how `legacyProjectRedirect` rows are queried) silently dropped the substitution. If that happens, all ~462 currently-working cards break in the same release — not gradually, not with a warning, all at once, because the one thing keeping them alive is a side effect of a function that exists for a different reason. Fixing today's backlog doesn't change this; it just means there are now more cards riding on the same unstated assumption than there were this morning.

## What's been fixed (2026-09-08)

**34 translation groups, 109 redirect rows**, across several passes the same day:

- **Panorama Hills** — RU/DE/PL redirects added to match EN (`/developers/agg-luxury-homes`); the RU blog article's own hardcoded link repointed directly to the same target, skipping the redirect hop.
- **26 groups (78 rows)** — a mechanical backfill: every archived translation group that had a redirect for EN only, none for RU/DE/PL. Each derived target was verified live (200) before writing, and the EN source target was checked for chaining first — 2 groups (Seaview, Oasis Garden) failed that check and were held back for the next bullet, not written blind.
- **Seaview + Oasis Garden** — not a missing-row case: the existing EN redirect pointed at `/developers/mito` (404 — a stale slug; the real one is `mito-developers`), so it had been silently broken since the day it was created. Fixed the EN row, then derived and wrote the 3 missing locale rows from the corrected target.
- **Gioia West** — same shape: `/developers/agg` (404) → `/developers/agg-luxury-homes`, all 4 locales.
- **Aion, Noble Apartments, Konia Aura, Olea Residences** — a different, worse case: all 4 locale rows already existed, but pointed at a Development slug (`/projects/aion`, `/projects/noble`, `/projects/aura-konia`, `/projects/olea-residences`) that is itself `publishStatus: "archived"` — a correct-looking redirect to a dead end. Checked each Project row's own `developerId` (not the broken redirect's guess) and confirmed a live developer page in every case, with no live successor Development under that developer to point at instead. Repointed all 4 × 4 = 16 rows to the developer page, same pattern as Panorama Hills.

## Redirect health, checked deliberately (2026-09-08)

The Seaview/Gioia West pattern (a redirect row that exists but points nowhere) was found twice by accident before being checked on purpose. Fetched all **730** `legacyProjectRedirect` rows' targets live: **709 returned 200. 21 did not** (one of those, Triangle House's EN row, was a false positive from the scan script mishandling that row's stored absolute URL — its real target is a clean 200 — so **20 genuinely broken**, now **0** after the fixes above). Two distinct failure classes, both now closed:
1. **Wrong slug, developer page is live** (Gioia West, Seaview, Oasis Garden) — the redirect's own target string was stale/mistyped.
2. **Right slug, but the target itself is archived** (Aion, Konia Aura, Noble Apartments, Olea Residences) — the redirect was created correctly at the time, then the Development it pointed to was later archived too, and nothing re-checked the redirect.

## Incident: "does it render" was used as the archived-status check, 2026-09-03

Direct evidence the fragility above isn't theoretical. Two DE villa-cluster pages were merged
into `/de/luxusvillen-in-zypern` on 2026-09-03 (commits `714ce20`, `1264fcb`). Each merge checked
its source page's pinned refs "against the catalogue" before deciding which to carry over —
`luxusimmobilien-auf-zypern`'s commit message explicitly calls out City Landmark, Infinity, and
Royal Bay Resort as the three pins that "render," out of its full pinned list.

Checked again on 2026-09-09 (flagship ref audit, prompted by the flagship reading 4 live listings
out of 31 pinned): **City Landmark had been `ARCHIVED` since 2026-08-30, and Infinity since
2026-08-24 — both already archived at the moment the 09-03 merge called them "rendering."** The
check wasn't wrong on its own terms — `resolveProjectRefs` genuinely does return a card for both,
exactly as this document's Summary section describes — but "a card renders" and "this is live
inventory" are different questions, and the check only answered the first one. Infinity is this
document's own open case (no redirect target, slug collision — its card link is inert). City
Landmark does have a working redirect (to a live Development), so its link isn't broken, but it
isn't a distinct listing either.

The other two pins pulled over the same evening (Küünal Villas, El Pez, Zeus Villas from
`luxusvillen-zypern-ueber-1-mio`; Royal Bay Resort from `luxusimmobilien-auf-zypern`) genuinely
were `PUBLISHED` at merge time — the check was right for those four. All four were archived four
days later, 2026-09-07, in the untraced batch `docs/SITE-CHANGELOG.md` logs separately. That's a
different failure (see "What's still open" below) — not the render-vs-status conflation, just
ordinary drift arriving faster than anyone expected.

**The lesson for the next person doing this kind of merge:** "does `resolveProjectRefs` return a
card for this ref" is never the right test for whether a pin is worth carrying forward — it will
say yes for almost any archived row with a redirect target, which is most of them. Check
`Project.status === "PUBLISHED"` directly instead.

## Open case: Infinity — a slug collision, not a missing redirect

Two **unrelated** properties both use the slug `infinity`: an archived legacy `Project` (Mito Developers, apartment, €376,000) and a live, published `Development` (an unrelated Medousa-built villa complex, priceFrom €620,000, completely different specs and developer). `/projects/infinity` already returns 200 today — not via any redirect, but because the site's own collision rule at `/projects/[slug]` resolves the live Development first, for any request, before `legacyProjectRedirect` is ever consulted. A `legacyProjectRedirect` row was created for the archived Project (→ the Mito Developers page) and then **deleted again** once this was understood: it would never fire, and leaving it in the table would tell a future reader the case was handled when it was not.

**No redirect can fix this** — the collision resolves upstream of the redirect table entirely. Fixing it for real needs one of:
- a slug change on one side (most likely the archived legacy Project, since it's already retired) so the two stop colliding, or
- a deliberate decision that the old Mito listing stays unreachable at this URL and nothing further is done.

Neither has been decided; this is the one open item this document tracks. Left as-is.

**Checked whether this is a class of defect, not a one-off:** scanned every `ARCHIVED` Project row's slug against every published Development's slug — **100 collisions found.** Of those, **96 are the archived Project correctly linked to the exact colliding Development via `supersededByDevelopmentId`** — the same deliberate legacy-slug-reused-by-its-successor pattern as Villa A, Tress, Cap St Georges Resort, etc., confirmed intentional and benign, not a defect. **Only Infinity's 4 rows are unlinked** — a genuine coincidence, not a pattern. One case, not a class.

## What's still open

1. **Infinity** — see above; needs a decision, not a mechanical fix.
2. **Decide whether `resolveProjectRefs`'s redirect substitution should become an explicit, tested contract, or whether the real fix is cleaning stale refs out of `.projects` arrays at archival time so nothing depends on the substitution at all.** Investigated read-only (2026-09-08): archival happens through exactly one code path, `deactivateProjectWithRedirect` in `src/app/admin/actions.ts` — the only function that ever sets `Project.status = "ARCHIVED"` (`toggleProjectActive` only re-activates). It already archives every locale sibling and writes their `legacyProjectRedirect` in one transaction, but never touches any `.projects` array on any other page. Adding that would mean, inside the same transaction, scanning every published Blog/Singlepage/CaseStudy row's `contentBlocks` plus the homepage's separate `featuredProjectsBlock` field for the newly-archived sanityIds and stripping them from any `projects` array found. For the backlog that already exists rather than what gets archived next, that same scan would need to run once as a standalone migration across the ~103 pages currently carrying a dead-but-rescued ref (not 462 separate writes — several dead refs typically share one page, so one rewrite per page clears all of that page's stale pins at once). Proposed, not built.
