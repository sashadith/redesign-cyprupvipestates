# Project ↔ Development overlap: unresolved, and confirming doesn't fix it

**Status:** open, not fixed. No code or DB changes made — this document is the handover record.
**Found:** 2026-08-27, incidentally, while shipping the DE/PL/RU beachfront landing-page rework (see `docs/SITE-CHANGELOG.md` and `docs/paphos-offplan-baseline-2026-08-27.json` for that work's own record).
**Related task:** `task_38f44dec` ("Resolve Tress Apartments Project↔Development overlap") — the single-pair version of this finding, logged before the catalog-wide scope was known.

## Summary

Two independent legacy-vs-current content systems (`Project`, from the pre-migration Sanity era; `Development`, the current feed-driven model) can hold rows for the *same physical property*. This codebase has a purpose-built mechanism to record and act on that overlap (Phase 5, `src/app/admin/(panel)/content/projects/overlaps/`), but three things are true at once, and together they mean the mechanism has never actually closed a single case:

1. **0 of 103 published legacy Project listings have ever been linked to a Development**, at all — not just the ones this investigation happened to touch.
2. **The landing-page render path has no dedup logic whatsoever** between a Project and its matching Development.
3. **The one existing "confirm" action doesn't change what renders anyway** — it records the relationship and stops there.

The result: wherever a Project and its matching Development both satisfy a page's filter, both render as separate cards. Confirmed live on 3 pages this session (`/projects/tress` rendering twice on the just-shipped beachfront pages); this document shows it is far from limited to that one case.

## Finding 1 — 0 of 103 unresolved

Queried every published `Project` row, grouped by `translationGroupId` (the real cross-locale identity key — some listings share one slug across all 4 languages, others get a fully localized slug per locale, e.g. Cap St Georges Resort has 4 different slugs for the same property). **407 published Project rows resolve to 103 distinct listings. All 103 have `supersededByDevelopmentId: null`.** Not "most" — all of them, including ones that predate the 2026-07-15 frozen-candidate-list audit by a wide margin.

The admin review UI (`src/app/admin/(panel)/content/projects/overlaps/page.tsx`) only ever shows candidates from `candidates.ts` — a **frozen, one-time list, generated 2026-07-15 from `MERGE_AUDIT.md` §4, never regenerated live.** It has 49 pairs. None of the matches below are on it.

## Finding 2 — no dedup on the landing render path

Read `fetchFilteredProjectsRaw` in `src/sanity/sanity.utils.ts` — the single function every `landingProjectsBlock` page on the site calls (110 published pages, confirmed by direct query). It queries `Project` rows and `Development` rows independently and concatenates the results. No `supersededByDevelopmentId` check, no slug-collision check, no dedup of any kind.

A dedup mechanism *does* exist elsewhere — `getDeveloperCatalogByLang` (the per-developer catalog page) builds a `blockedDevIds` set from any Project row with `supersededByDevelopmentId` set, and hides the matching Development. But this is confined to that one, unrelated page type. It has no bearing on any `landingProjectsBlock` page — which is what every locale-specific landing page in the Paphos cluster investigation, and the vast majority of the site's SEO-facing pages, actually use.

## Finding 3 — confirming an overlap doesn't hide anything

`confirmOverlap(legacyProjectId, developmentId)` in `src/app/admin/(panel)/content/projects/overlaps/actions.ts` writes exactly one thing: `supersededByDevelopmentId` on every locale row of the Project's translation group. Its own code comment states this plainly: *"visibility of the legacy project itself is untouched here — that's the separate ACTIVATE/DEACTIVATE toggle (Phase 5.3, also cascaded)."*

So even working through the existing admin UI as designed — reviewing a candidate, confirming it's a real match — changes nothing a site visitor sees. A second, separate action (deactivate/archive) is required, and nothing prompts or automates it.

## The 4 high-confidence pairs

Slug-exact or perfect-title-match (score 1.0) against a published Development. Exposure = count of published `landingProjectsBlock` pages where both sides independently satisfy that page's own filter (city/type/beach/exclude) — a real, checked number, not an estimate. Two tiers reported: pages with `filterCity: "Paphos"` (a pool I've modeled and verified precisely all session, ~200 listings vs. the 60-card render cap — high confidence both sides actually render) vs. the fully unfiltered, whole-catalog pages (pool likely 500–2000+ vs. the same 60-card cap — passes the filter, but whether it survives into the visible top 60 needs a per-page rank simulation not done here, so treat as upper bound only).

### Villa A ↔ Villa A (Development `villa-a`)
Paphos-filtered pages where both sides render (11, high confidence):
`/investment-paphos`, `/properties-paphos`, `/off-plan-properties-in-paphos`, `/west-coast-properties-paphos`, `/invest-in-cyprus-real-estate-with-cryptocurrency`, `/de/investment-immobilien-paphos`, `/de/zypern-immobilien-kryptowahrung-investieren`, `/ru/investitsii-v-nedvizhimost-pafos`, `/ru/investitsii-v-kipr-za-kripto`, `/pl/inwestycje-w-nieruchomosci-pafos`, `/pl/inwestycje-w-nieruchomosci-na-cyprze-za-kryptowaluty`
Total filter-pass across the whole catalog: 42 pages. Does **not** hit the 3 beachfront pages or Cap St Georges — confirmed independently, this is why it's the proposed first fix.

### Tress Apartments ↔ Tress (Development `tress`)
Paphos-filtered pages (14, high confidence — includes the 3 beachfront pages, already directly observed rendering the duplicate via live HTML fetch): the 11 above, plus `/de/strandimmobilien-paphos`, `/pl/nieruchomosci-przy-plazy-pafos`, `/ru/nedvizhimost-u-morya-pafos`.
Total filter-pass across the whole catalog: 45 pages.

### The Gallery ↔ Gallery (Development `gallery`)
Same 14-page Paphos-filtered set as Tress (includes all 3 beachfront pages).
Total filter-pass across the whole catalog: 45 pages.

### Cap St Georges Resort ↔ Cap St Georges Resort (Development `cap-st-georges-resort`)
Paphos-filtered pages (18, high confidence): the Tress/Gallery 14, plus 4 more Paphos+Villa-typed pages — `/ru/villy-v-pafose-dlya-investorov`, `/villas-in-paphos-for-investors`, `/pl/wille-na-sprzedaz-pafos-dla-inwestorow`, `/de/villen-paphos-investoren-kaufen`.
Total filter-pass across the whole catalog: **71 pages** — the largest exposure of the four, because it also matches ~30 more `filterType: "Villa"` pages with no city restriction (villa-focused pages across every locale). Those 30 are unconfirmed-render (upper bound only, per the caveat above), which is part of why this pair is being held back rather than fixed alongside Villa A.

**Total page-exposures across all 4 pairs (filter-pass, whole catalog): 203, across 110 total landing pages site-wide.**

## The 7 medium-confidence pairs — need a human, not a heuristic

Flagging these, not resolving them. Two are explicitly one-legacy-listing-to-two-or-more-Development ambiguities that no slug/name match can settle on its own:

- **`Atrium Townhouses`** and **`Atrium Apartments`** (two separate legacy listings) both match Development `Atrium` — could be two unit types of one complex, or one/both could be wrong. Needs someone who knows the building.
- **`Sea Caves Villas`** (one legacy listing) matches *both* `Pearl Sea Caves Villas plot 1` and `plot 2` — same ambiguity, inverted.
- `Baia Villas` ↔ `Baia`
- `Horizon` ↔ `Royal Horizon`
- `Tsada Panorama Superior Villa` ↔ `Villa Superior`

## 3 likely false positives — flagged, not counted

Shared a generic suffix but differ on the part that actually identifies the building — almost certainly *not* the same property, kept here only so they don't get mistaken for real candidates later:

- `Universal Park III` ↔ `Universal Park 7` (III ≠ 7 — different buildings in the same complex)
- `Aktea Residences 4` ↔ `Arkadia Residences 4` (Aktea ≠ Arkadia)
- `Georgia Residences 2` ↔ `Harmony Residences 2` (Georgia ≠ Harmony)

## What should happen automatically

**Recommendation: filter the render path on `supersededByDevelopmentId`, not couple archiving to confirmation.** The gap is in `fetchFilteredProjectsRaw` — it should exclude any Project row where `supersededByDevelopmentId` is set, the same way it already excludes non-`PUBLISHED` rows. That closes the actual defect (duplicate cards in listings) with a single, surgical check, and it does so without changing what "confirm" means. The confirm/archive split looks deliberate, not accidental — `confirmOverlap`'s own comment calls out that visibility is a separate toggle, and `src/app/admin/(panel)/developers/publishing-queue/actions.ts` already reads `supersededByDevelopmentId: { not: null }` on its own, independent of whether the Project is archived — meaning at least one other part of the admin already depends on "confirmed" and "archived" being distinct states. Forcing every confirmation to also archive would collapse that distinction and change behavior for a consumer this investigation didn't touch. Filtering the render path instead gets the actual user-facing outcome (no duplicate card) without assuming why that separation exists.

## Next step (not today)

Villa A first — it's the only one of the 4 that doesn't touch the beachfront pages or Cap St Georges Resort. Link it, archive the Project side, verify one page (`/investment-paphos` or `/properties-paphos`), then decide on Tress/Gallery/Cap St Georges Resort and on the render-path fix above.
