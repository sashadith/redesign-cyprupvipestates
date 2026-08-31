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

## 2. Five Track 1 internal-link targets

Blog articles link into these five pages — a broken one means a live internal-link chain is
pointing at a dead or degraded page. Card count = links with class `ProjectLink_project__*`
(landing pages) or unique `/{lang}/projects/{slug}` hrefs (the one fixed-list page below).

| URL | filter | last verified count | verified 2026-08-31 |
|---|---|---|---|
| `/de/luxusvillen-in-zypern` | fixed curated list (`projectsSectionBlock`, 21 project refs) | 20 | 20 |
| `/ru/nedvizhimost-s-vidom-na-more-v-limassole` ("the sea-view page") | `filterCity: Limassol, maxBeachMinutes: 5, excludePropertyTypes: [Office, Shop]` | 44 | 44 |
| `/ru/kvartiry-v-limassole` | `filterCity: Limassol, filterPropertyType: Apartment` | 54 | 54 |
| `/ru/villy-v-pafose-dlya-investorov` | `filterCity: Paphos, filterPropertyType: Villa` | 60 (capped — true match 114) | 60 (capped — true match 114) |
| `/pl/mieszkania-w-limassol` | `filterCity: Limassol, filterPropertyType: Apartment` | 54 | 54 |

## 3. Three beachfront pages

Same filter on all three: `filterCity: Paphos, maxBeachMinutes: 2, excludePropertyTypes:
[Commercial, Boutique Hotel]`.

| URL | last verified count | verified 2026-08-31 |
|---|---|---|
| `/de/strandimmobilien-paphos` | ~72 | **60 (capped — true match 84)** |
| `/pl/nieruchomosci-przy-plazy-pafos` | ~72 | **60 (capped — true match 84)** |
| `/ru/nedvizhimost-u-morya-pafos` | ~72 | **60 (capped — true match 84)** |

**Flag, not yet actioned**: all three now hit the `MAX_FILTERED_PROJECTS = 60` cap
(`src/sanity/sanity.utils.ts`) — true inventory match is 84, previously below 60 when "~72" was
last recorded. This is the same cap mechanism found affecting `/off-plan-properties-in-limassol`
earlier (introduced by commit `df912b7`, 2026-08-07). Not fixed here — flagging per the read-only/
propose-first discipline this session has used throughout; raise separately if it should be
addressed (e.g. raising the cap, or paginating these three the way
`/off-plan-properties-in-paphos` already is).

## 4. Off-plan pagination — `/off-plan-properties-in-paphos`

| request | expected | verified 2026-08-31 |
|---|---|---|
| bare URL | 200, with pager | 200 |
| `?page=1` | 308 → bare URL | 308 → `/off-plan-properties-in-paphos` |
| `?page=2` | 200 | 200 |
| `?page=3` | 200 | 200 |
| `?page=4` | 200 | 200 |
| `?page=99` | 404 | 404 |
| `?page=abc` | 404 | 404 |

## 5. filterStage fills (off-plan landing pages)

All three share the same DB-wide `filterStage: "off-plan"` criteria (Development-backed inventory
only — legacy Project rows never match, by design, regardless of language).

| URL | last verified count | verified 2026-08-31 |
|---|---|---|
| `/de/off-plan-immobilien-zypern` | 51 | 51 |
| `/pl/nieruchomosci-off-plan-na-cyprze` | 51 | 51 |
| `/ru/novostroyki-na-kipre` | 51 | 51 |

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
