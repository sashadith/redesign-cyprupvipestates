# Render performance investigation — the site isn't slow, but caching doesn't work

**Status:** investigation only. No code, DB, or deploy changes made — this document is the handover record, so the next person doesn't re-run this from scratch.
**Found:** 2026-08-27, prompted by a background report of ~1.1–2.1s TTFB on `/developers/kuutio-homes` from an earlier ISR cache-key spike this week.

## Headline result: current TTFB does not reproduce the earlier figure

Fresh measurement, 5 requests, right now: **0.31–0.36s**, not 1.1–2.1s. Flagging the contradiction rather than splitting the difference — using this measurement as authoritative; the earlier number wasn't reproducible and I have no way to reconcile it without the original raw data.

## Part 1 — TTFB, 10+ URLs, production, multiple requests each

| URL | Rendering mode (build output) | TTFB spread (4 reqs) | Repeat-request trend |
|---|---|---|---|
| `/` | ○ Static | 0.487–0.747s | flat |
| `/de` | ● SSG | 0.489–0.558s | flat |
| `/projects/tress` | **ƒ Dynamic** | 0.397–0.496s | flat |
| `/properties-paphos` | ● SSG (ISR, revalidate=60) | 0.393–0.670s | flat |
| `/blog/cap-st-georges-resort-villas` | ● SSG | 0.218–0.294s | flat |
| `/preview-about/en` | **ƒ Dynamic** | 0.264–0.395s | flat |
| `/preview-legal/en/privacy` | ● SSG | 0.289–0.358s | flat |
| `/projects` (listing) | **ƒ Dynamic** | 0.632–0.707s | flat |
| `/investment-paphos` | ● SSG (ISR, revalidate=60) | 0.451–0.673s | flat |
| `/sitemap.xml` | ○ Static | 0.169–0.330s | flat |
| `/developers/kuutio-homes` | ● SSG | 0.308–0.363s | flat |

**Rendering-mode classification does not predict speed.** `/projects/tress`, fully dynamic (no prerendering at all), is faster than the static homepage and on par with SSG pages. No URL showed a repeat-request speedup — everything is flat, static-labeled or not. All 11 URLs sit in the same rough 0.17–0.75s band. Current absolute TTFB is not a problem at this scale — the investigation continued anyway because the *mechanism* (why isn't static/ISR faster than dynamic at all?) was the actual question, and answering it surfaced real architectural gaps worth recording even though today's numbers are fine.

## Part 2 — What runs on every request

- **`src/app/layout.tsx`** (true root): trivial passthrough, no data fetching.
- **`src/app/[lang]/layout.tsx`** (the layout every content page sits under): calls `cookies()` and `draftMode()` unconditionally. Both are Next.js Dynamic APIs — using either anywhere in a route's render tree forces that entire route to render dynamically on every request, overriding whatever the build otherwise classified it as.
- **Header and Footer are not in the shared layout** — they're imported and self-fetch inside every individual page component (14 separate page files import `Header` directly: `[lang]/page.tsx`, `[lang]/[...slug]/page.tsx`, `[lang]/blog/[slug]/page.tsx`, `[lang]/developers/[slug]/page.tsx`, and more).
  - `Header.tsx` is an async server component calling `getHeaderByLang(lang)` itself.
  - `Footer.tsx` likewise calls `getFooterByLang(lang)` itself.
  - Neither is wrapped in React `cache()`, `unstable_cache`, or anything else.
- **The `[...slug]` landing-page route** (110 published pages — the largest single page category on the site) additionally calls `getAllPathsForLang(lang)` once per non-current locale, in *two separate places* (`generateMetadata` and the page component) — up to **6 calls per single page render**, uncached. (`getSinglePageByLang`, by contrast, *is* wrapped in `cache()`, so that one dedupes within a request — the others don't.)
- **`unstable_cache` appears zero times anywhere in `src/`.** Confirmed by grep across the whole source tree, not inferred.

## Part 3 — The database side (measured directly against production)

| Query | Postgres execution time (`EXPLAIN ANALYZE`) | Index used |
|---|---|---|
| `SiteDocument` header lookup (type+language) | 0.049ms | Seq Scan — correct choice, table has 37 rows total |
| `Singlepage` full-language `findMany` (getAllPathsForLang) | 0.107ms, 74 rows | Seq Scan — correct choice, table has 182 rows total |
| `Singlepage` findFirst by slug | 0.068ms | **Index Scan** on `singlepages_language_slug_key` — used exactly as designed |

Query execution is sub-millisecond across the board. Not the bottleneck, not close. Connection handling: standard singleton `PrismaClient` (`src/lib/prisma.ts`), confirmed reused across requests on the persistent PM2-managed process — no per-request connection overhead. DB location: checked the VPS's actual production `.env` directly — `DATABASE_URL` points to `localhost:5432`. Postgres is co-located with the app; no network round-trip in production.

## Part 4 — What ISR is actually doing

- `/sitemap.xml` (outside the `[lang]` tree, untouched by `cookies()`) returns `x-nextjs-cache: HIT` — real caching works in this deployment; the mechanism itself isn't broken.
- Every page under `[lang]` — static-labeled or not — returns `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Checked directly via response headers on `/`, `/de`, `/projects/tress`, `/blog/...`.
- **`.next/cache` genuinely survives deploys** — checked file timestamps directly on the VPS, not the deploy log's own claim. Oldest files in the current release's cache directory are **42+ days old**, spanning many releases. The deploy script's "copying .next/cache forward" is real.
- **But `fetch-cache` — Next's actual ISR/data-cache store — has exactly 2 entries.** Combined with zero `unstable_cache` usage: **Next's ISR/fetch-cache mechanism only ever wraps the `fetch()` API.** This codebase fetches its data through Prisma, not `fetch()`, so almost none of its content queries were ever eligible for that caching layer — independent of any route's static/dynamic classification. The only cache layer that could have covered Prisma-sourced pages is the Full Route Cache (whole-page HTML caching), and that's exactly what `cookies()`/`draftMode()` in the shared layout defeats, site-wide.

**The deploy-swap-wipes-the-cache hypothesis is disproven, directly** — the cache is 42+ days old and survives deploys correctly. The real mechanism is architectural, not deploy-related: Prisma-sourced data was never going to be cached by Next's ISR system regardless of deploy frequency.

## Additional finding — `Cache-Control: no-store` means nothing downstream caches either

Separate from the render-cost analysis: because every `[lang]` page returns `no-store`, no CDN, proxy, or browser can cache a response either — every repeat visit from the same user and every search-engine crawler pass hits the app server fresh, with zero HTTP-level caching anywhere in the chain. At current TTFB (well under 1s) this costs little in practice. It's worth recording as its own item because it's the direct, structural reason repeat traffic and crawl traffic get no speed benefit at all, separate from the render-cost question — and it would matter far more if traffic volume or TTFB both grew.

## Additional finding — `getAllPathsForLang`'s fan-out doesn't scale

`getAllPathsForLang` does an unfiltered `findMany` of every published Singlepage row for one language (currently 74 EN rows, 182 total across all 4 languages), then resolves parent/child paths with an in-memory loop. Fine today — sub-millisecond, small table. **Stating plainly what happens if that table is 10x bigger (≈1,800 rows):** the query itself would still likely stay cheap in absolute Postgres terms (a Seq Scan over a few thousand rows is still low-single-digit milliseconds), but two things compound against it as the table grows: the in-memory parent/child resolution loop is unbounded and re-run from scratch on every call, and — more importantly — this function is called up to **6 times per single landing-page render**, uncached, so the cost scales with (table size) × (6 calls) × (every landing-page request, forever, since nothing caches it). At 182 rows this is invisible. At 1,800 it would start showing up in TTFB the same way none of today's individual queries do. Recorded here so whoever adds the next 1,600 Singlepages catches this before it's a live problem, not after.

## Ranked causes — three things ruled OUT, as useful as the two ruled in

**Causes, by evidence weight:**
1. **`cookies()`/`draftMode()` in `[lang]/layout.tsx` forcing every page fully dynamic, site-wide.** Direct evidence: response headers on every measured URL, regardless of build-time label. Defeats the only caching mechanism that could apply to this codebase's Prisma-sourced pages.
2. **No caching layer on the repeated per-page queries** (Header, Footer, `getAllPathsForLang`). Individually cheap, but dozens of sequential, uncached round trips per render, none reused across requests, some duplicated even within one request.

**Ruled out, with evidence — don't re-investigate these:**
3. **Not query cost or indexing** — measured directly, sub-millisecond, tables are small, the query that should use an index does.
4. **Not DB connectivity, pooling, or network** — DB is `localhost` to the app, singleton Prisma client reused across requests, no per-request connection overhead.
5. **Not the deploy-swap wiping `.next/cache`** — disproven directly, cache is 42+ days old and genuinely persists across releases.

## Fixes — for reference only, not authorized, nothing implemented

Cheapest first, if and when this is picked up:
- Remove or scope down `cookies()`/`draftMode()` in the shared layout (isolate the consent-gated analytics check and the draft-preview banner into leaf components instead of gating the whole layout) — highest leverage given the evidence, but touches shared chrome, so it needs real testing before it ships, not a one-line change.
- Wrap `getHeaderByLang`/`getFooterByLang` in `unstable_cache()` — small, self-contained, low risk, no per-user/per-search-param variation to worry about.
- Wrap or dedupe `getAllPathsForLang`'s up-to-6-calls-per-render fan-out — contained to the `[...slug]` route family.
- Everything else (per-block queries like `computeFilteredProjects`) is low-leverage given Part 3 — query cost isn't the problem, don't prioritize it.
