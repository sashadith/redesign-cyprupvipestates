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

## 2026-07-23 — `/partners` cutover to the redesigned page + newly indexable

Found during a canonical/hreflang audit: `middleware.ts` already unconditionally
rewrote `/partners`, `/de/partners`, `/pl/partners`, `/ru/partners` to the
`preview-partners/[lang]` redesign, but that tree's layout hardcoded
`noindex, nofollow` — so the live `/partners` page had been unindexable since
that rewrite shipped. Fixed: removed the noindex, confirmed its existing
`generateMetadata` already builds correct canonical + hreflang via
`staticAlternates()`, added `/partners` to the `pages` sitemap
(`sitemaps/[type]/route.ts`), and deleted the old hardcoded
`src/app/[lang]/partners/page.tsx` (fully unreachable dead code since the
rewrite always won).

**Expect:** `/partners` (and its de/pl/ru variants) appearing in GSC for the
first time / resuming impressions after being effectively de-indexed — this is
the intended effect of becoming indexable, not a ranking signal.

## 2026-08-24 — Sold-out project pages: units block removed, alternatives now always resolvable

Two changes to the Development detail page (`/[lang]/projects/[slug]`, the
`ProjectPageBody` branch):

- **Units block removed on sold-out pages.** Once a Development has zero
  available units, the "The Properties" list no longer renders at all
  (`!isSold && listed.length > 0`). On those pages every price cell was
  already suppressed ("—" for sold, "Reserved" for reserved), so the block
  carried no price signal and no CTA — the alternatives grid and enquiry form
  already sit directly under the hero for sold-out projects. **27 of 149
  published Developments are currently sold out**, so this removes body
  content from 27 indexable pages (×4 languages). SEO-relevant but expected
  to be neutral: the block contained no internal links (its only `<a>` was an
  external Matterport/video attribute link), was not an anchor target, and
  carried no structured data. `numberOfAccommodationUnits` is now omitted from
  the `RealEstateListing` JSON-LD on sold-out pages too, so the schema keeps
  describing only what the page actually renders (`availability: SoldOut` is
  unchanged).

- **Alternatives no longer require a price basis.** `getAlternativeDevelopments`
  used to return `[]` whenever a Development had neither its own `priceFrom`
  nor a single priced unit, because every ranking stage filtered on a price
  band. It now runs the same four stages with the price band simply not
  applied (developer → location → type carry the ranking). Verified against
  all 149 published Developments: **146 results byte-identical, 3 changed** —
  `grato-homes-2`, `konia-crown`, `neon-homes`, each going from no block at
  all to 4 suggestions. Net effect on internal linking: 3 pages gain 4
  outbound internal links each.

**Expect:** slightly lower word count / content volume on sold-out project
URLs from this date; do not read a click or impression shift on those pages as
a ranking-quality change without checking sold-out status first.

## Known migration-era GSC artifact (not a changelog entry, a standing caveat)

Beyond the above, an EARLIER locale-prefix migration (English made prefix-less,
German-only content moved under `/de/`) left ~432 old URLs still indexed and
slowly losing traffic to their `/de/` or prefix-stripped canonical counterpart,
via a live 301 (nginx-level for the `/de/` cases, next-intl-level for the
`/en/`-strip cases). This is why `src/lib/seo/urlCanonical.ts` exists — it
merges these pairs before the Advisor computes any delta, so this ongoing
consolidation can't masquerade as a fresh ranking collapse. See that file's
header comment for the full source list.

## Known lab-data caveat for the CWV rule (2026-07-20, not a changelog entry)

The Advisor's "100% of tracked templates fail LCP" alarm (approved suggestion
`edc0e699`, 2026-07-19) is built entirely on PSI's default Lantern-simulated
lab data (`src/lib/psi/client.ts` falls back to `lighthouseResult` lab numbers
whenever CrUX field data is unavailable for a URL). A same-page comparison
found Lantern's simulated LCP running ~3x higher than a real devtools-throttled
run (9.7-11.5s simulated vs 3.7s real, on the same production URL), with
Lantern's own phase breakdown failing to sum to its own total — an internal
inconsistency, not just a stricter estimate.

Worse: **there is no CrUX field data for this origin at all** — checked via
PSI's `loadingExperience`/`originLoadingExperience` at both URL and origin
level, both empty. cyprusvipestates.com doesn't have enough real Chrome-user
traffic to clear Google's CrUX reporting threshold, so `fetchCwv()` has never
returned `source: "field"` for any URL (confirmed: zero rows in `cwv_metrics`
with `source = 'field'`). The rule is not "leaning lab over field" — lab is the
*only* signal it has ever had. Re-weighting toward field data (the obvious
fix) isn't available here; the rule needs a different corrective (e.g. treating
Lantern's absolute LCP less literally, or spot-checking with devtools-method
throttling) before it raises another site-wide emergency. See the CWV
investigation thread (approved suggestion `edc0e699`) for the full profiling.

**Update (2026-07-27):** the Advisor re-raised this exact alarm (same 14/14,
22/22, 11/11, 1/1, 4/4 breakdown) a week later, because the real bug wasn't in
`getCwvFailingByClass` (which already got the lab-aware relative-regression
fix on 2026-07-18) but in `gatherCwvSummary` (`src/lib/seoAdvisor/gather.ts`)
— a separate, never-updated copy of the pass/fail check that compared every
lab-sourced reading's raw LCP straight against the absolute `CWV_LCP_MAX_MS`
(3500ms) threshold. Since every reading is lab-sourced (see above) and
Lantern's simulated LCP on this site runs 9.7-11.5s, that comparison failed
on essentially every page, every week, regardless of real page health.
`gatherCwvSummary` now delegates to `getCwvFailingByClass` instead of
re-deriving the check, so the Advisor's payload and the Action Center's
alerting rule can no longer disagree. No hero image/JS changes were made —
the homepage/blog-post/Development-page hero fixes and the PropertyIntro
investigation from 2026-07-18/19 already covered the one real anti-pattern
(LCP element hidden behind JS) that existed.

## Already-resolved Advisor findings (2026-07-20, not changelog entries — standing caveats)

The Advisor has re-raised these as if new. All are closed; don't re-suggest.

- **`/de/blog/wo-leben-die-meisten-deutschen-auf-zypern` (-95 clicks):** verified healthy
  migration artifact, not decay. Single clean 308 from the pre-migration root URL, correct
  canonical, position stable-to-improving (3.3→3.7). It is also item #8 of the active
  17-page title-sweep batch (`docs/SEO-TITLE-SWEEP-LOG.md`, due 2026-08-15 to 2026-08-29) —
  doubly protected from any rewrite. Do not touch until the sweep window closes, and don't
  attribute the click dip to decay even then.
- **`/projects` impression collapse (455→90, -80%):** the collapse is dated to **2026-06-22**
  via day-by-day SearchMetric history — roughly four weeks before the 07-16/07-17
  legacy-project-to-Development cutover and sitemap changes (`afb6a24`, `4472ac5`, both
  2026-07-17). Do not attribute this to that merge or to the sitemap work; the timeline
  rules both out. Indexability is fully healthy: not in `robots.txt` disallow, no
  `noindex` meta, correct self-referencing canonical, present in the live
  `sitemaps/projects.xml` with correct hreflang alternates. Clicks were already ~0/day
  before and after (noise, not signal). No confirmed cause — likely ordinary SERP
  volatility on a thin filter/listing page, not a redirect or migration defect. Low
  commercial value; not worth further investigation unless it starts mattering.
- **`/projects/avalon-gardens-2` (-4 clicks, 2026-08-24 verification):** the 308-hop
  link-equity attribution is dismissed for this page specifically. The card-building resolver
  fix is confirmed correct and the page does receive a direct, no-redirect inbound link from
  `/developers/island-blue` — so the link-equity mechanism is present but isn't the click
  loss driver here. Actual cause: the Development is **100% sold out** (0/28 units
  available). Attribute future click/impression decline on this page to sold-out status, not
  to internal-link health, unless unit availability changes.

## 2026-08-26 — Public blog API (blog syndicated to a second portal)

Read-only, key-authenticated API at `/api/public/v1/posts` (`docs/PUBLIC-BLOG-API.md`)
that hands the full blog — 211 published articles, all four languages, body HTML,
images, FAQ and metadata — to a second web portal. Nothing about the articles on
this site changed: no URLs, no content, no indexability. `/api` is already in the
`robots.txt` disallow list and the endpoints are inert until `BLOG_API_KEYS` is set.

**Why this belongs here anyway:** once the second portal goes live, every article
exists at two public URLs in four languages. Every payload carries a
`canonicalUrl` pointing back here and the integration brief makes emitting
`<link rel="canonical">` (or `noindex`) mandatory — but if that is ever dropped or
misconfigured on the consuming side, this site's blog will start losing
impressions to a duplicate it cannot see. Before attributing a blog-wide
impression or position drop after the second portal's launch date to ranking
quality, check the consuming pages for a correct canonical first.

Project listings and lead forms are deliberately NOT exported (empty
`div.cvp-embed` placeholders the consumer fills from its own inventory), so no
`/projects` URL is duplicated anywhere.

## 2026-09-01 — German villa cluster consolidated into `luxusvillen-in-zypern` (backfilled 2026-09-09)

*Backfilled from the `DE_LANDING_MERGES` map in `src/middleware.ts`, where this
was recorded at the time — this changelog entry was simply never added. No new
change; documenting what already shipped.*

Six pages collapsed into `luxusvillen-in-zypern` as the flagship, on two
different kinds of evidence:

**Confirmed duplicate by direct inventory-set comparison** — not just similar
copy:
- `villen-in-zypern-fuer-investoren`, `villen-auf-zypern-fuer-auswanderer`,
  `villen-zypern-aufenthaltstitel-provisionsfrei` — all three queried nothing
  but `filterPropertyType: "Villa"` (no city) and rendered the byte-identical
  130-listing set as the flagship's own live query — three titles, one query.
- `villen-in-paphos` (both its nested `luxusvillen-in-zypern/villen-in-paphos`
  and flat leaf form) — a `projectsSectionBlock` fixed list that rendered a
  set byte-identical to its own parent page. No independent page to preserve.

**Decided by search behaviour**, not inventory overlap — these two had
hand-pinned lists instead of a live query, so the usual duplicate-inventory
test didn't apply:
- `luxusimmobilien-auf-zypern`: 346 impressions in August at position 24.9,
  and **not one query of its own** — every query it appeared for, the
  flagship also appeared for, and ranked better on. Its three unique pins
  (City Landmark, Infinity, Royal Bay Resort) were moved to the flagship
  before the merge shipped, so they kept their only German placement.
- `luxusvillen-zypern-ueber-1-mio`: 555 of 560 impressions came from queries
  the flagship also served and ranked better for (position 45.5 vs. the
  flagship's 18.4). Of its 11 pins, only 3 actually rendered (Küünal Villas,
  El Pez, Zeus Villas) — the other 8 pointed at archived projects, so the
  page had been showing 16 cards for 19 pins. The three real ones moved to
  the flagship.

**Deliberately not merged alongside these:** `strandvillen-zypern`. It looked
like the same case on paper (44% shared pins, loses its queries to the same
flagship), but the demand behind it is real — 803 impressions across 17
beach/sea queries since June, 412 of those on "zypern villa am meer kaufen"
alone. The answer there was to make the specialist page win its own term, not
remove it — it stayed independent.

## 2026-09-08 — German/Polish/Russian apartment cluster consolidated into `apartment-zypern` (backfilled 2026-09-09)

*Backfilled from the same map — this changelog entry was also never added at
the time. See PR #12.*

Same shape and test as the villa cluster above, run for the apartment
cluster. `apartment-zypern` was confirmed the flagship — best URL, broadest
GSC query footprint (18 distinct queries over the period, versus a handful or
zero for the others), most inbound links — after its own 15 pins turned out
15/15 archived and were replaced with a live `filterPropertyType: "Apartment"`
query. Its child `apartment-zypern/wohnungen-in-paphos` stayed independent
(genuinely Paphos-scoped, already live-filtered correctly; its 12 dead pins
were cleared for hygiene only, no behaviour change).

Two pages merged into the flagship:
- `wohnungen-fuer-junge-familien-zypern`: zero filtering beyond
  `propertyType: "Apartment"` — no bedroom or family-amenity signal despite
  the slug — zero inbound links anywhere on the DE site, and its only ranking
  queries were Paphos apartment-buying terms it shared with (and lost to)
  `apartment-zypern/wohnungen-in-paphos`. Not a distinct family-buyer
  audience; an unfiltered duplicate borrowing someone else's intent.
- `wohnungen-auf-zypern-fuer-investoren`: the same zero-filtering gap ("für
  Investoren" promised nothing an investor-specific query would match), and
  its own block heading mislabeled itself "Die besten Villen" on an
  apartments page. Zero GSC impressions in the period — invisible in search,
  not just weak.

`relatedLandingPages` entries pointing at either retired page were swept from
every live DE singlepage before the redirects shipped. No hardcoded hrefs
existed to either page outside one already-`ARCHIVED` reference on
`renditeimmobilien-zypern`, left as-is since that page cannot render.

Kept independent, not merged: `wohnungen-in-limassol` (genuinely
Limassol-scoped) and `wohnungen-zypern-auswandern` (the only one of the three
broad duplicates with real ranking signal and its own inbound link — kept as
the emigration-context entry point).

**Known open issue, not part of this merge, and not tracked in a doc yet:**
`MAX_FILTERED_PROJECTS = 60` still caps the flagship's render count well
below its true match count (154 matches, only 60 render; the Paphos child
matches 95, same 60-card cap). Raised at the time, not written down anywhere
until this note — worth its own doc if it's not fixed soon.

## 2026-09-09 — Paphos "investment properties" pages retired, redirected to the Paphos+Villa page (DE/PL/RU)

PRs #18 (DE), #19 (PL), #20 (RU), one commit each, run locale by locale. All
three retiring pages shared the same defect: `filterCity: "Paphos"` with **no
`filterPropertyType` filter at all**, despite the "investment" framing — every
Paphos listing (198 matches, 60 rendered under the render cap), not an
investment-scoped subset. No per-listing investment data exists anywhere on
the site to back that framing (`investmentData` is 0/407 populated; the ROI
calculator runs on city+type market presets, not per-listing facts), so the
page's promise could not be fixed by better filtering — it was retired outright
rather than repaired.

Redirected to each locale's one live Paphos+Villa page — the correctly-scoped
home for the same intent, not merely the nearest-named page (verified: block
config, live/GSC data, and inbound-link audit per locale before writing
anything). RU's target, `villy-v-pafose-dlya-investorov`, is itself a live
Track 1 internal-link target; nothing about that page changed, it only gained
one more inbound redirect.

| Locale | Retired | Redirects to |
|---|---|---|
| DE | `investment-immobilien-paphos` | `villen-paphos-investoren-kaufen` |
| PL | `inwestycje-w-nieruchomosci-pafos` | `wille-na-sprzedaz-pafos-dla-inwestorow` |
| RU | `investitsii-v-nedvizhimost-pafos` | `villy-v-pafose-dlya-investorov` |

Each locale: inbound `relatedLandingPages`/hardcoded links repointed first (DB
writes, verified live), then the `middleware.ts` redirect (first entries in
new `PL_LANDING_MERGES`/`RU_LANDING_MERGES` maps, alongside the existing
`DE_LANDING_MERGES`), then the Singlepage archived — in that order, so there
was never a 404 gap. All three retired pages confirmed dropped from the
sitemap. Full redirect table (730 `legacyProjectRedirect` rows) and all 22
`middleware.ts` landing-merge entries re-verified live at 200 after this
change — zero broken.

**Standing gap, not part of this entry:** this changelog was not updated for
the two consolidations immediately before this one — the DE villa cluster
(2026-09-01, `luxusvillen-in-zypern` absorbing several pages) and the DE/PL/RU
apartment cluster (2026-09-08, `apartment-zypern` flagship). Both are real,
live, documented in their own commit messages and PR descriptions, just never
logged here. Any GSC series for those retired slugs before this note should
still be read as migration, not decay — the absence of an entry here is a
paperwork gap, not evidence the merges didn't happen.

## 2026-09-09 — Landing-page pagination: restored the pager a redesign silently dropped, six days after it was approved

The lesson here matters more than the fix. `?page=N` pagination for
`landingProjectsBlock` (`pagesEnabled`, commit `512feeb`) was built, reviewed,
and approved live on 2026-08-26/27 — real server-rendered pager markup, real
`?page=N` hrefs, verified on `/off-plan-properties-in-paphos`. Six days later,
an unrelated visual redesign (`3272bd8`/`6b5b1f2`, 2026-09-02) rebuilt the
entire landing-page component tree from scratch (`LandingBody` +
`LandingProjectsGrid`, replacing the old `LandingProjectsBlockComponent`) to
give all 105+ landing pages a new look. Pagination — six days old, built in a
separate line of work — was simply not on that redesign's parity checklist:
its own commit message reasons carefully about what does and doesn't carry
over (breadcrumbs dropped on purpose, related-page links deliberately kept)
but never mentions pagination at all, and its own verification was "107x HTTP
200, no errors" — a status-code smoke test that cannot see a missing pager. A
cleanup commit 90 minutes later (`c333e37`) then deleted the now-unreferenced
old component, correctly verified as dead code by that point — it didn't cause
the regression, it just removed the evidence of what the new one was missing.

Nobody caught it because nothing re-checked it. `docs/POST-DEPLOY-CHECKLIST.md`
has had an item for this exact page since 2026-08-31, re-run on 2026-09-04 —
*after* the redesign — and its "verified" column still read "200" and moved
on. The checklist's own method only ever asserted on HTTP status codes; the
"with pager" note in its "expected" column was never independently checked
against the rendered HTML, so it sat silently stale for a week. Fixed
alongside this entry — see that file's own 2026-09-09 correction, which also
audits the rest of the checklist for the same status-code-standing-in-for-
markup shape (nothing else in it has this gap: the other count-based items
already read real hrefs out of live HTML, not a status code).

**The fix, three parts, one PR:**

1. **Pager restored** on `landingProjectsBlock` pages — `LandingBody.tsx` now
   takes a `pagePath` prop (plumbed from `[lang]/[...slug]/page.tsx`, where it
   already existed for other purposes) and renders the same pager markup the
   deleted component had (`<nav aria-label="Results pagination">`, real
   `<Link href="...?page=N">` tags, reusing `ProjectsSectionBlockComponent`'s
   pager styles as before), gated on `totalPages > 1` — invisible on every
   landing page except the one with `pagesEnabled` set today.
2. **`projectsSectionBlock` guarded against the same flag**, defensively, in
   `resolveBlocks` (`sanity.utils.ts`) — `pagesEnabled` now only takes effect
   on `landingProjectsBlock`. A `projectsSectionBlock` page (the classic
   block-map switch's own render path) has no server-rendered pager of its
   own; its existing pager is `ProjectsSectionBlockComponent`'s client-side,
   `useState`-driven, 8-per-page window over whatever array it's handed — with
   `pagesEnabled` on, that array would silently become one `MAX_FILTERED_
   PROJECTS`-sized server batch out of several, and the client pager would
   present it as complete with no indication more exist. That's worse than the
   plain 60-item cap it would replace, so this block type is refused outright
   rather than given a second, differently-shaped pager built in a hurry.
   `apartment-zypern` (`projectsSectionBlock`, 154 true matches, 60 rendered)
   stays capped until it gets a real one.
3. **Sitemap now lists page 2+** for any page with real pagination
   (`getPaginatedLandingPageSlugs` in `sanity.utils.ts`, consumed by
   `src/app/sitemaps/[type]/route.ts`) — closing the other half of the 08-27
   baseline's reasoning, which assumed pager links alone would carry discovery
   and treated the sitemap gap as backlog. With no pager links live for a
   week, that reasoning had nothing under it; the sitemap addition is no
   longer optional.

Verified locally before deploy: bare URL, `?page=2`, `?page=3` all render the
pager with real hrefs; `?page=1` → 308; `?page=99`/`?page=abc` → 404; sitemap
gained exactly 3 new `?page=` entries (2, 3, 4) for this page and nothing
else; three other `landingProjectsBlock` pages without `pagesEnabled`
(`villy-v-pafose-dlya-investorov`, `investment-paphos`,
`nieruchomosci-przy-plazy-pafos`) render unchanged, no stray pager.

**Deployed** (`main @ 23c1b1d`, release `cve-20260909095744`) **and
re-verified live**, same checklist, this time reading the actual production
HTML rather than trusting a status code — the exact discipline that was
missing on 2026-09-04:

```html
<nav class="ProjectsSectionBlockComponent_pager__QBUJx" aria-label="Results pagination">
  <span class="...pagerLink ...pagerLinkDisabled" aria-hidden="true">‹</span>
  <a class="...pagerLink ...pagerLinkActive" aria-current="page" href="/off-plan-properties-in-paphos">1</a>
  <a class="...pagerLink" href="/off-plan-properties-in-paphos?page=2">2</a>
  <span class="...pagerGap" aria-hidden="true">…</span>
  <a class="...pagerLink" href="/off-plan-properties-in-paphos?page=4">4</a>
  <a class="...pagerLink" aria-label="Next" href="/off-plan-properties-in-paphos?page=2">›</a>
</nav>
```

— fetched live from `https://cyprusvipestates.com/off-plan-properties-in-paphos`, byte-identical to the local build. Bare/`?page=2`/`?page=3`/`?page=4` all 200,
`?page=1` → 308, `?page=99`/`?page=abc` → 404, all against production. Live
sitemap (`/sitemaps/pages.xml`) carries exactly the 3 `?page=` entries for
this page and no others anywhere on the site. The three control landing
pages checked live too: 200, no pager markup present, unchanged.

## 2026-09-09 — Pagination enabled on the 3 beachfront Paphos pages

`pagesEnabled` flipped live (DE `strandimmobilien-paphos`, PL
`nieruchomosci-przy-plazy-pafos`, RU `nedvizhimost-u-morya-pafos`) — the first
real use of the pager restored earlier today, on pages that were never the
"proven reference" (that was always `/off-plan-properties-in-paphos`). Each
matches `filterCity: Paphos, maxBeachMinutes: 2, excludePropertyTypes:
[Commercial, Boutique Hotel]`, all three `landingProjectsBlock` (the guard
added earlier today doesn't apply). 76 true matches today, 60 previously
capped — page 2 carries the remaining ~16 on each locale.

**Verified clean before flipping anything, read-only:** the count's history
(72 → 84 → 76 across three separate readings this week) is real inventory
movement, not the Project/Development duplicate-render defect
(`docs/PROJECT-DEVELOPMENT-OVERLAP-DEFECT.md`) reasserting itself — both
pairs that used to hit these three pages (Tress, The Gallery) were already
resolved on 2026-08-30, and today's actual matched rows contain zero
duplicate title collisions.

**Verified live, each locale, same checklist as the corrected
`POST-DEPLOY-CHECKLIST.md` item:** pager present with real `?page=N` hrefs,
`?page=2` renders the remaining cards (17/16/16 — the 1-card difference on
DE is a pre-existing, unrelated stale-slug prose link elsewhere on that page,
not a duplicate card or a locale-dependent sort difference; traced and
confirmed below), `?page=1` → 308, `?page=99`/`?page=abc` → 404, one
unpaginated control page per locale unchanged, no stray pager.

**Edge case, tested live rather than reasoned about:** temporarily narrowed
one page's filter to push its match count to 52 (under the 60 cap) with
`pagesEnabled` on. The pager disappeared cleanly (`totalPages` back to 1) and
`?page=2` correctly 404'd — no stale link to a now-empty page. Reverted
immediately after.

**Known behaviour, not specific to this rollout:** the sitemap route
(`src/app/sitemaps/[type]/route.ts`) caches its output for 1 hour
in-process, with no invalidation hook tied to content changes. Flipping
`pagesEnabled` (in either direction — enabling it, or a live count dropping
back to ≤60 on an already-paginated page) can leave the public sitemap
disagreeing with the actual page for up to an hour: missing new `?page=`
entries just after enabling, or still listing a `?page=2` that now 404s just
after a count drop. Confirmed both the underlying computation
(`getPaginatedLandingPageSlugs`) and the live sitemap end-to-end for this
rollout — the live endpoint caught up within the hour, as expected. Worth
remembering for every future page this gets enabled on: don't read the
sitemap as ground truth for pagination state within an hour of a change.

**One artifact worth recording, not fixing here:** the DE page's stale
`villen-cap-st-georges-resort` prose link (still redirects correctly, 308)
is the same "61 vs 60, one extra `/de/projects/` link" anomaly
`docs/POST-DEPLOY-CHECKLIST.md` flagged on 2026-09-04 without root-causing
it. Now traced precisely: a hardcoded sentence in the page's own DE body
copy, using an old slug variant of Cap St Georges Resort that predates a
rename. Present on both page 1 and page 2 (static content, unrelated to
pagination), which is why it inflated a naive href count on both.
