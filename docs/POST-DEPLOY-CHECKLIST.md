# Post-deploy checklist

Run these after every production deploy. This list has gone missing from working memory across
sessions three times before being written down here (2026-08-31) — if you're about to ask "what
were those pages again," the answer is below, not in chat history.

Card counts drift daily with inventory (new units published, sold out, unpublished). A count that
differs from the "last verified" value below is not automatically a regression — check it against
the database before calling it one. The "verify against the DB" column tells you how.

## 1. Landing-page merge redirects

```bash
./scripts/verify-landing-merges.sh
```

Self-contained — reads `DE_LANDING_MERGES` directly out of the checked-out `src/middleware.ts`, so
it can never go stale as that table grows. Checks every entry single-hops to a 200 on its `/de/`
form. See the script's own header comment for why it exists (2026-07-28 incident).

**2026-09-01 addition**: the villa-cluster consolidation added 5 more entries to this same table
(4 requested merges + the flat leaf form for `villen-in-paphos`) — the script above already covers
them automatically, no doc update needed for that check. But if you're doing an ad-hoc manual check
of these specific slugs instead of running the script, know what to expect: these four are now
**archived pages that 301 to the flagship — expect 301, not 200**. A 200 here would mean the
archive or the redirect didn't take.

**2026-09-03 addition** (not this session's work — found during the 2026-09-04 checklist re-run,
verified from git history and the live site): 2 more pages merged the same way,
`luxusimmobilien-auf-zypern` and `luxusvillen-zypern-ueber-1-mio` (the latter was explicitly held
back earlier — resolved by checking which of its 11 "unique" pins actually rendered; only 3 did,
those 3 were added to the flagship first, then this page was merged). `strandvillen-zypern` was
deliberately re-confirmed as NOT part of this — real, cited demand (803 impressions across 17
beach/sea queries) kept it separate. **Both new merges: redirect confirmed live (200 on the `/de/`
hop), but their Singlepage rows are still `status: PUBLISHED`, not yet archived** — a real,
observed in-between state, not a doc error. Re-check their archive status before assuming this
line is stale.

| slug | expected | archived? (as of 2026-09-04) |
|---|---|---|
| `/de/villen-in-zypern-fuer-investoren` | 301 → `/de/luxusvillen-in-zypern` | yes |
| `/de/villen-auf-zypern-fuer-auswanderer` | 301 → `/de/luxusvillen-in-zypern` | yes |
| `/de/villen-zypern-aufenthaltstitel-provisionsfrei` | 301 → `/de/luxusvillen-in-zypern` | yes |
| `/de/luxusvillen-in-zypern/villen-in-paphos` (+ flat `/de/villen-in-paphos`) | 301 → `/de/luxusvillen-in-zypern` | yes |
| `/de/luxusimmobilien-auf-zypern` | 301 → `/de/luxusvillen-in-zypern` | **no — still PUBLISHED** |
| `/de/luxusvillen-zypern-ueber-1-mio` | 301 → `/de/luxusvillen-in-zypern` | **no — still PUBLISHED** |

## 2. Five Track 1 internal-link targets

Blog articles link into these five pages — a broken one means a live internal-link chain is
pointing at a dead or degraded page. Card count = **unique `/{lang}/projects/{slug}` hrefs**,
deduplicated.

**2026-09-04 correction**: the count method used to be "links with class `ProjectLink_project__*`"
— that class no longer exists. A refactor elsewhere (not this session's work) renamed it to a
plain `class="prj"`, discovered when every page in this table suddenly read 0. Don't trust a class
name here again without checking it still exists; the href-based count doesn't have this problem.
Also don't use a raw count of `class="prj"` occurrences as a substitute — it overcounts (31 on the
flagship against a verified 28 unique hrefs), apparently more than one `prj`-classed element per
card. Deduplicated hrefs is the only count that's matched direct DB verification every time it's
been checked.

| URL | filter | last verified count | verified 2026-09-04 |
|---|---|---|---|
| `/de/luxusvillen-in-zypern` | fixed curated list (`projectsSectionBlock`, **31** project refs as of today — grew again since 09-01 from the two additional merges above, was 25) | 24 (2026-09-01) | **28** |
| `/ru/nedvizhimost-s-vidom-na-more-v-limassole` ("the sea-view page") | `filterCity: Limassol, maxBeachMinutes: 5, excludePropertyTypes: [Office, Shop]` | 44 | 45 |
| `/ru/kvartiry-v-limassole` | `filterCity: Limassol, filterPropertyType: Apartment` | 54 | 57 |
| `/ru/villy-v-pafose-dlya-investorov` | `filterCity: Paphos, filterPropertyType: Villa` | 60 (capped — true match 114) | 60 (capped) |
| `/pl/mieszkania-w-limassol` | `filterCity: Limassol, filterPropertyType: Apartment` | 54 | 57 |

## 3. Three beachfront pages

Same filter on all three: `filterCity: Paphos, maxBeachMinutes: 2, excludePropertyTypes:
[Commercial, Boutique Hotel]`.

| URL | last verified count | verified 2026-09-04 |
|---|---|---|
| `/de/strandimmobilien-paphos` | 60 (capped, 2026-08-31) | **61** |
| `/pl/nieruchomosci-przy-plazy-pafos` | 60 (capped, 2026-08-31) | 60 |
| `/ru/nedvizhimost-u-morya-pafos` | 60 (capped, 2026-08-31) | 60 |

**Flag, not yet actioned**: all three still hit the `MAX_FILTERED_PROJECTS = 60` cap
(`src/sanity/sanity.utils.ts`) — true inventory match was 84 as of 2026-08-31, previously below 60
when "~72" was last recorded before that. This is the same cap mechanism found affecting
`/off-plan-properties-in-limassol` earlier (introduced by commit `df912b7`, 2026-08-07). Not fixed
here — flagging per the read-only/propose-first discipline this session has used throughout; raise
separately if it should be addressed (e.g. raising the cap, or paginating these three the way
`/off-plan-properties-in-paphos` already is).

**New today**: `strandimmobilien-paphos` reads 61, one over the cap, while the other two still read
exactly 60. Not investigated further this pass — plausibly one extra `/de/projects/` link outside
the main listing grid (an FAQ answer or similar) rather than a cap change, since the other two
pages share the identical filter config and both still read exactly 60. Worth a look if it recurs.

## 4. Off-plan pagination — `/off-plan-properties-in-paphos`

| request | expected | verified 2026-09-04 |
|---|---|---|
| bare URL | 200, with pager | 200 |
| `?page=1` | 308 → bare URL | 308 → `/off-plan-properties-in-paphos` |
| `?page=2` | 200 | 200 |
| `?page=99` | 404 | 404 |

(`?page=3`, `?page=4`, `?page=abc` last checked 2026-08-31, unchanged in kind — not re-run this
pass, spot-checked `?page=2` and `?page=99` instead as the two branches that matter: a valid page
past 1, and an out-of-range one.)

## 5. filterStage fills (off-plan landing pages)

All three share the same DB-wide `filterStage: "off-plan"` criteria (Development-backed inventory
only — legacy Project rows never match, by design, regardless of language).

| URL | last verified count | verified 2026-09-04 |
|---|---|---|
| `/de/off-plan-immobilien-zypern` | 51 (2026-08-31) | 54 |
| `/pl/nieruchomosci-off-plan-na-cyprze` | 51 (2026-08-31) | 54 |
| `/ru/novostroyki-na-kipre` | 51 (2026-08-31) | 54 |

All three still identical to each other, as expected (same site-wide `filterStage` criteria) — the
+3 across all three together is ordinary inventory growth, not a regression.

## Verifying a count against the database, not just the live page

The rendering logic is `fetchFilteredProjectsRaw` in `src/sanity/sanity.utils.ts`. It can't be
imported standalone in a plain Node script — it transitively pulls in `next/headers` (draft-mode
support elsewhere in that file) via a chain that needs Next's own request-scoped runtime and can't
be faithfully stubbed. Instead, use the exported field-derivation helpers from
`src/lib/developmentCard.ts` (`resolveDevelopmentType`, `matchesPropertyTypeFilter`,
`districtWithParent`, `toCardDistances` — that module has no Next/React coupling, confirmed by
walking its full import chain) combined with a hand-written orchestration that mirrors
`fetchFilteredProjectsRaw`'s exact filter sequence (city/propertyType → `maxBeachMinutes` →
`excludePropertyTypes` → `filterStage`, in that order — order matters, each filter narrows what the
next one sees) via `esbuild`, bundled and run against the real database. This is the same
esbuild-direct-execution pattern used elsewhere in this codebase's investigation scripts — call the
real logic, don't reimplement it from memory.
