# Pre-Merge Audit: Staging → Production

**Scope:** Read-only investigation only. Nothing was changed, restarted, or deployed while producing this document.
**Date:** 2026-07-15
**Environments:**
- **Staging** — `design.cyprusvipestates.com`, pm2 app `cve-staging`, `/var/www/cve-staging`, deployed from this git repo (`redesign-cyprupvipestates`, branch `redesign/home`)
- **Production** — `cyprusvipestates.com`, pm2 app `cyprusvipestates` (cluster, 2 instances), `/var/www/cyprusvipestates`, running from a **separate** git repo (`cyprusvipestates.git`) checked out directly on the VPS

---

## 1. Database Topology — CRITICAL FINDING

**Production and staging share exactly ONE PostgreSQL database.**

Confirmed two ways:
- Both `.env` files' `DATABASE_URL` lines point to `postgresql://<user>:<redacted>@localhost:5432/cyprusvipestates?schema=public` — same host, same database name, same schema.
- A SHA-256 hash of the full `DATABASE_URL` line (including credentials) is **byte-for-byte identical** between `/var/www/cve-staging/.env` and `/var/www/cyprusvipestates/.env`. This rules out any lookalike-but-different connection string.

**Implication: CRM/leads/presentations/development data needs NO merging.** Whatever exists in the database today (leads, presentations, developments, admin users, etc.) is already the single shared source of truth for both environments. The merge is a **code and static-asset** exercise, not a data-migration exercise.

### Migration drift

`npx prisma migrate status` was run against the shared database from **both** trees:

| Tree | Migrations in its own `prisma/migrations` folder | Result against shared DB |
|---|---|---|
| Local repo (staging source) | 33 | "Database schema is up to date!" |
| Production tree | 10 | "Database schema is up to date!" |

Both report "up to date" because Prisma's `migrate status` only checks that migrations *present in that tree's folder* are applied — it does not flag migrations applied to the DB that are absent from the tree. Directly querying `_prisma_migrations`:

- **33 rows total, all with a `finished_at` timestamp and none rolled back.** The live schema is fully consistent and healthy.
- **22 migrations exist in the local/staging repo's `prisma/migrations` folder but are absent from production's own tree** (list below). Zero migrations exist in production's tree that are missing from the local repo — the gap is strictly one-directional.

This is **not** live schema drift — the running database is correct and consistent. It is a **git-tracking gap**: production's separate repo never received the migration folders (as files) for changes that are nonetheless already live in the shared database. If a future action ever ran `prisma migrate deploy` from production's stale tree against a *fresh* database, it would silently reconstruct an incomplete/incorrect schema.

Missing from production's tree (22):
```
20260630120000_add_project_is_new
20260702075417_add_developer_feed_analysis
20260702143853_add_feed_source_config
20260705165243_add_feed_developments
20260705203611_add_unit_source
20260706040126_add_override_gallery
20260706054910_add_unit_detail_fields
20260706230000_add_developer_contact_fields
20260707090000_add_override_coordinates
20260707100000_add_developer_drive_folder
20260707110000_add_developer_drive_sync
20260707120000_add_drive_media_interval
20260709235500_add_development_seo_fields
20260710010000_add_ai_prompt_template
20260710120000_add_client_presentations
20260710190000_add_presentation_filter_snapshot
20260711090000_add_lead_last_match_filters
20260711120000_add_presentation_item_unit_refs
20260711140000_add_lead_soft_delete
20260711160000_add_user_photo_png
20260711180000_add_user_phone
20260713090000_add_presentation_item_alias_isnew
20260714090000_add_presentation_criteria
```

### schema.prisma model-level diff

Diffing `prisma/schema.prisma` between the two trees (330 diff lines) shows production's copy is missing, relative to the local/staging copy:
- `Project.isNew` field
- Several `User` model additions: `photoPng`, `phone`, `presentationsAsAdvisor` relation
- `Lead` model additions: `lastMatchFilters`, `presentations` relation, `deletedAt`/`deletedById` (soft-delete) + index
- Entire new models: `DeveloperAccount`, `DeveloperFeedAnalysis`, `Development`, `DevelopmentUnit`, `DevelopmentOverride`, `ClientPresentation` (+ related), and others under the Development/Drive/AI-extraction feature set
- Minor formatting/alignment differences (cosmetic, `prisma format` artifacts)

This is the expected shape given the DB already has all 33 migrations applied — production's `schema.prisma` file is simply stale relative to the live schema it's already running against.

---

## 2. Code Divergence

### Production's git identity

```
remote: https://github.com/sashadith/cyprusvipestates.git
branch: prod-notfound-locale-fix-20260706   (NOT main)
HEAD:   f7b51b3  (2026-07-07 09:21:42 +0000)  "SEO(de): point Limassol-hub Haeuser link at canonical URL (wave-3 cleanup)"
```

This is a **completely separate repository** from the one this audit and staging are based on (`redesign-cyprupvipestates`, unrelated git history). Production is also currently checked out on a **feature branch**, not `main`.

### Uncommitted changes on production (manual hotfixes never committed)

`git status --short` on `/var/www/cyprusvipestates` shows **8 uncommitted changes**:

```
 M src/app/preview-home/sections/Form.tsx
 M src/app/preview-home/tokens.css
 M src/middleware.ts
 M src/sanity/sanity.utils.ts
?? public/uploads/          (untracked — expected, uploads were never part of this repo's history)
?? src/app/preview-case-studies/
?? src/app/preview-faq/
?? src/app/preview-insights/LightHeroFlag.tsx
```

The 4 modified files (92 insertions, 3 deletions total) and the `preview-case-studies`/`preview-faq` directories are **known, deliberate** surgical patches applied directly to production's live files during an earlier FAQ/Case-Studies rollout this session — inserted by hand into production's *actual* current file content (which itself already diverges from the local repo in unrelated ways) rather than via a full-file overwrite, specifically to avoid clobbering production-only content. `LightHeroFlag.tsx` was deployed the same way. **These 8 changes are real, live, uncommitted hotfixes with no corresponding commit anywhere** — if anyone resets or re-clones production's repo, this work is lost.

### Full file-tree comparison (local repo HEAD vs. production's live files)

Ran a read-only `rsync --dry-run --itemize-changes --delete` (no files touched) between a clean `git archive HEAD` export of the local repo and production's live tree, excluding `node_modules`, `.next`, `.git`, `.env*`, `scripts/images`, `public/uploads`.

| Category | Count | Meaning |
|---|---|---|
| New files (in local/staging repo, not on production at all) | 168 | Entire feature surfaces production doesn't have yet |
| Changed files (exist on both, content differs) | 52 | Files present in both but diverged |
| Directories new to production | 66 | — |
| "Production-only" (exist on production, not in local repo HEAD) | 22 | See caveat below |

**168 new files, by area:**

| Area | Count |
|---|---|
| Admin panel (`src/app/admin/**`) | 53 |
| New Prisma migrations | 22 |
| Sandbox/style dev pages (`sandbox*`, `style`) | 23 |
| Client Presentations (`src/app/c/**`) | 14 |
| `src/lib/*` (feed sync, drive sync, image mirror, SEO helpers, etc.) | 14 |
| `src/lib/ai/*` (AI document extraction) | 8 |
| API routes (`src/app/api/**`) | 7 |
| Public `preview-*` routes | 7 |
| `scripts/*` | 6 |
| `src/lib/crm/*`, `src/lib/devFeeds/*` | 5 |
| Root/misc (`.github/workflows`, `STAGING.md`, backup files, etc.) | 8 |

**52 changed files, by area:** admin panel (16), preview-project(s)/home (13), root config — `package.json`, `.gitignore`, `README.md`, `next.config.mjs` (8), components (7), `[lang]` routes (4), `src/lib`/`src/sanity` (2), Prisma schema (1), `src/middleware.ts` (1).

**"Production-only" files — important caveat:** this list is files present on production's live filesystem but absent from the local repo's *committed* (`git archive HEAD`) state. Cross-checking against the local *working tree* (including uncommitted files) shows **most of these already exist locally too, just uncommitted** — they are leftover artifacts of unrelated concurrent work (a German-language landing-page import and a blog/insights migration) that was deliberately left uncommitted in this session and is not part of the redesign/Development feature set. Only three files have **no local counterpart at all**:
- `migration/01-assets.mjs`, `migration/02-content.mjs` — one-time Sanity migration scripts, presumably run once and left on the server
- `ecosystem.config.js` — a PM2 process config file that exists only on production

The rest of the 22 (`scripts/de-content/*.md`, `scripts/importLandingsPrisma.cjs`, `src/app/[lang]/blog/BlogInsights.tsx`, `src/app/preview-insights/InsightsSeo.tsx`, `src/app/preview-project/Gallery.tsx`, etc.) exist locally as **untracked** files — meaning even the local/staging side of this merge has its own uncommitted-work backlog that should be resolved (committed or discarded) independently of the staging→production merge.

### package.json dependency diff

Staging has 4 dependencies + 1 devDependency production lacks: `@anthropic-ai/sdk`, `mammoth`, `qrcode`, `xlsx` (+ `@types/qrcode`). No packages exist in production only. No version mismatches on shared packages (e.g. `next@14.2.5`, `@prisma/client@^5.22.0`, `react@^18` match exactly on both).

### Local repo's own push state

The local repo (staging's source) is currently **4 commits ahead of `origin/redesign/home`** (pushed later in this session — verify before relying on `origin` reflecting the exact state audited here): `7acf31c`, `ba37ba5`, `c62b20d`, `dde4c36`. It also has **52 uncommitted working-tree files** — the same unrelated concurrent work referenced above (blog/insights migration, landing-page imports), deliberately not part of any restoration commit made this session.

`/var/www/cve-staging` itself has **no `.git` directory at all** — staging is deployed via `git archive | tar -x` (CI) / rsync (manual script) of file content, not a live git checkout. There is no way to `cd` into staging and ask git what's deployed; the deployed state is only knowable by diffing against the source repo's HEAD at deploy time.

---

## 3. Environment & Config

### Environment variable names (values never inspected)

**Present in staging `.env` only:**
```
ANTHROPIC_API_KEY
CRON_SECRET
DEV_FEED_KEY_BBF
DEV_FEED_KEY_INEX
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
```

**Present in production `.env` only:** none.

**Present in both:** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `AUTH_URL`, `DATABASE_URL`, `EMAIL_HOST`, `EMAIL_PASSWORD`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_TO`, `EMAIL_USER`, `MONDAY_API_KEY`, `MONDAY_NEWSLETTER_BOARD_ID`, `NEXT_PUBLIC_SITE_URL`, `SANITY_API_TOKEN`, `SANITY_DATASET`, `SANITY_PROJECT_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

**`NEW_PROJECTS_INDEXABLE`** — confirmed absent from *both* `.env` files (directly verified by this audit, not just the name-diff). Since the code checks `process.env.NEW_PROJECTS_INDEXABLE === "true"`, it currently evaluates to `false` everywhere — new Development pages are noindexed in both environments today.

**`CRON_SECRET` — see §6 for a live, currently-broken production feature this causes.** Production's own `.env` does not define `CRON_SECRET`, and a *separate* file the production crontab expects, `/var/www/cyprusvipestates/.env.production`, **does not exist on disk at all**.

### Nginx

**Production** (`cyprusvipestates.com`): locale-redirect logic (`/en` → `/`), a large legacy-German-URL redirect map, static assets (`/_next/static/`, `/uploads/`) served directly via `alias` (not proxied), `/admin` explicitly noindexed, everything else indexable (no site-wide noindex), standard security headers, no `auth_basic`.

**Staging** (`design.cyprusvipestates.com`): single server_name, **site-wide `X-Robots-Tag: noindex, nofollow`** on every response, `robots.txt` served with `auth_basic off`, `/uploads/` served via `alias` (added earlier this session — previously fell through to the Node app and 500'd), no `auth_basic` currently active (removed on request), longer proxy timeouts (300s) to accommodate long-running Drive-sync/AI operations.

### Crontab

| Schedule | Target | App | Status |
|---|---|---|---|
| `*/5 * * * *` | `/api/cron/publish-scheduled` on `localhost:3000` | **Production** | **Currently failing — see §6** |
| `30 3 * * *` | `/usr/local/bin/cvp-db-backup.sh` | DB backup (both apps, shared DB) | Healthy — see §5 |
| `30 4 * * *` | `/api/cron/drive-sync` on `127.0.0.1:3200` | **Staging only** | Working |
| `0 4 * * *` | `/api/cron/feed-sync` on `127.0.0.1:3200` | **Staging only** | Working |

**There is currently no drive-sync/feed-sync cron targeting production.** If the merge cuts production over to the Development system without adding an equivalent cron entry (or repointing these), production will never automatically sync feed data or mirror images post-merge.

`/etc/cron.d/`: only standard OS jobs (certbot, e2scrub_all, monarx-update, sysstat) — nothing app-related.

### PM2

| App | Mode | Instances | Port | cwd |
|---|---|---|---|---|
| `cyprusvipestates` | cluster | 2 | 3000 | `/var/www/cyprusvipestates` |
| `cve-staging` | fork | 1 | 3200 | `/var/www/cve-staging` |
| `private-collection` | fork | 1 | (unrelated third app on this VPS) | — |

Production: 6 restarts / 5h uptime at time of check (healthy). Staging: high cumulative restart count, consistent with this session's repeated rebuild/reload cycles.

---

## 4. Routing & SEO State

### NEW_PROJECTS_INDEXABLE and sitemap

Confirmed unset (defaults `false`) in both environments (see §3). Production's live `sitemap.xml` today is a sitemap **index** pointing at 5 sub-sitemaps: `projects`, `blog`, `pages`, `developers`, `case-studies`. **No Development/preview-project URLs are in production's sitemap** — consistent with the fact that route not existing on production at all yet.

Two separate sitemap implementations exist in the codebase: `src/app/sitemap.xml/route.ts` (the index, referenced by `robots.txt`, live) and `src/app/api/sitemap/route.ts` (a parallel flat-`urlset` generator that *does* fold in gated `preview-project` URLs behind `NEW_PROJECTS_INDEXABLE` — not currently linked from `robots.txt`, appears to be a newer/alternate implementation not yet wired in as the canonical one).

### Legacy Project model — existing visibility controls

The legacy `Project` model already has:
- `status: ContentStatus` (`DRAFT | PUBLISHED | SCHEDULED | ARCHIVED`) — the actual public-visibility gate
- `isSold: Boolean` — marks sold, does not by itself hide the listing
- `isFeatured`, `isNew`, `listingPriority: Int` — prominence/sort, not visibility
- No dedicated `isActive`/`isHidden` boolean — visibility is controlled purely via `status`

All 221 English-language legacy Projects currently in the database are `status: PUBLISHED` (verified by direct query) — there is no existing draft/archived legacy inventory to reason about; every legacy Project is live today.

### Legacy Project ↔ Development overlap table

34 Developments are currently `publishStatus: published`. Matched against all 221 legacy Projects using normalized-token Jaccard similarity on name (stopwords like "residences/villas/park/paphos" stripped). **This is a heuristic name match, not a verified real-world identity match — a human must confirm each row before wiring up an activate/deactivate mapping.**

| Legacy slug | Legacy title | Development slug | Development name | Confidence |
|---|---|---|---|---|
| `cypress-groove-bbf` | Cypress Grove | `cypress-grove` | :cypress grove | High |
| `riverside-domenica` | Riverside | `riverside` | riverside | High |
| `galaxy-residences-aristo` | Galaxy Residences | `grand-residences` | Galaxy Residences | High |
| `eden-golf-bbf` | Eden Golf | `golf-residences` | Eden Golf | High |
| `luma-genesis` | Luma Genesis | `luma-genesis` | Luma Genesis | High (slug-identical) |
| `noble-apartments` | Noble Apartments | `noble` | Noble | High |
| `oculus-domenica` | Oculus | `oculus` | oculus | High |
| `quatrro` | QUATRRO | `quatrro` | Quatrro | High (slug-identical) |
| `velaro-homes` | Velaro Homes | `velaro-homes` | Velaro Homes | High (slug-identical) |
| `neon-homes-oli` | Neon Homes | `neon-homes` | Neon Homes | High |
| `lazzero-park` | Lazzero Park | `lazzero-park` | Lazzero Park | High (slug-identical) |
| `celestia-island-blue` | Celestia | `celestia` | Celestia | High |
| `aion-ku` | Aion | `aion` | Aion | High |
| `emerald-park-luma` | Emerald Park | `emerald-park` | Emerald Park | High |
| `pearl-park-aristo` | Pearl Park Residences | `universal-park-residences` | Pearl Park Residences | High |
| `avrora-court-aristo` | Avora Court | `aurora-residence` | Avora Court | High |
| `imperial-residences-aristo` | Imperial Residences | `magestic-residences` | Imperial Residences | High |
| `royal-residences-aristo` | Royal Residences | `king-residences` | Royal Residences | High |
| `andriana-court-aristo` | Andriana Court | `city-living-court` | Andriana Court | High |
| `ppremier-residences-aristo` | Premier Residences | `venus-rock-residences` | Premier Residences | High |
| `pelagos-beachfront-villas-aristo` | Pelagos Beachfront Villas | `chloraka-beachfront-villas` | Azure Beachfront Villas | Medium — different qualifier word ("Pelagos" vs "Azure"), verify same building |
| `azalea-apartments` | Azalea Apartments | `universal-villas` | Azalea Villas | Medium — "Apartments" vs "Villas", verify same building |
| `eniko-mare-domenica` | Eniko Mare | `eniko-mare` | apartments-in-paphos-eniko-mare | Medium |
| `aquamarine-villas-aristo` | Aquamarine Villas | `sunny-coastal-residences` | Aquamarine Coastal Villas | Medium |
| `begonia-residences-aristo` | Begonia Residences | `chloraka-residences` | Melania - Begonia Residences | Medium |
| `meteora-residences-aristo` | Meteora Residences | `meteora-residences` | Meteora Residential Development | Low-Medium |
| `kamares-village` | Kamares Village | `neo-chorio-villas-1` | Agnades Village 1 | **Likely false positive** — matched only on generic "village" token, different specific names |
| `kamares-village` | Kamares Village | `argaka-villa` | Argaka Village 6 | **Likely false positive** — same reason |
| `pearl-sea-caves-villa-1-island-blue` | Pearl Sea Caves Villa 1 | `chloraka-rose-residences` | Roseland Villas 1 | **Likely false positive** |
| — | (no match) | `venus-ridge-villas` | Ridge Residences | **None found** — new Development with no legacy counterpart |
| — | (no match) | `prodromi-modern-living` | Grigio Court | **None found** |
| — | (no match) | `city-gardens` | Jasmine Gardens | **None found** |
| — | (no match) | `kato-paphos-residences` | Onero Residences | **None found** |
| — | (no match) | `blackpine` | :blackpine | **None found** |

25 rows scored a perfect token-overlap match; the remaining published Developments either scored low enough to be flagged "likely false positive" (matched only on a generic filler word) or scored zero. **All 34 rows should be manually confirmed by whoever owns the ACTIVATE/DEACTIVATE feature before it goes live** — a name match is not proof of building identity, and two "High" matches above (Pelagos↔Azure, Apartments↔Villas) already show the heuristic can match genuinely different qualifiers on the same underlying project.

---

## 5. Backup Readiness

**Database:** 44 MB total. Largest tables: `projects` (6.5 MB / 887 rows, all 4 locales), `blogs` (5.5 MB / 126), `media` (5.0 MB / 4,173), `page_views` (4.0 MB / 10,634), `development_units` (3.5 MB / 1,805), `developer_feed_analyses` (3.0 MB / 7), `singlepages` (2.8 MB / 182), `developers` (1.1 MB / 88), `developments` (1.0 MB / 227).

**Backup mechanism — healthy and automated.** `/usr/local/bin/cvp-db-backup.sh` runs daily at 03:30 via crontab, `pg_dump`s the shared database, gzips, writes to `/var/backups/cyprusvipestates/db/`, with 14-day retention on weekdays and 8-week retention on Sundays. Verified directly: the most recent backup is from **this morning, 2026-07-15 03:30:05, 7.3 MB, logged "OK"** — 17 backups currently retained, oldest dated 2026-06-28. A `RESTORE.md` file sits alongside the backups. This is a well-functioning, currently-working system — **do not confuse this with the separate, stale one-off `.sql.gz` files sitting in `/root`** (dated 2026-07-05/06, unrelated to this cron, likely manual snapshots from an earlier incident).

**Non-git assets:** `/var/www/cyprusvipestates/public/uploads` is **5.0 GB**. `cve-staging/public/uploads` is a **symlink** to this exact same directory — there is only one physical copy of this 5GB asset store, shared by both apps. Any backup plan for "uploads" only needs to cover this single directory once.

No hosting-panel (e.g. Hostinger) automated snapshot mechanism was found in a top-level `/root` look — the file-level backup coverage for `public/uploads` currently rests entirely on whatever ad-hoc tarballs exist (e.g. the `prod-tree-backup-20260706-recon.tar.gz` found in `/root`, now 9+ days old) rather than a recurring job. **This is the one real backup gap**: the database is backed up daily and current; the 5GB uploads directory has no equivalent recurring backup.

---

## 6. Traffic-Critical Features on Production

### Lead / form submission routes

| Route | Purpose | Notifies |
|---|---|---|
| `src/app/api/leads/route.ts` | Canonical lead capture (contact/project/blog forms) | Telegram + internal/client email |
| `src/app/api/monday/route.ts` | Legacy alias, forwards to `/api/leads` for old frontend forms | Same as above |
| `src/app/api/roi-calculator/route.ts` | ROI calculator submissions | Telegram + localized (en/de/pl/ru) client email |
| `src/app/api/monday-newsletter/route.ts` | Newsletter signup | Monday.com board sync (no Telegram) |
| `src/app/api/email/route.ts` | Partners-page enquiry (heavy inline anti-spam) | Telegram + email |
| `src/app/api/c/[token]/favorite`, `.../view` | Client-presentation view/favorite tracking (token-authed, public) | Telegram |

All share `src/lib/antispam.ts`'s `ALLOWED_HOSTS` allow-list, which currently includes `cyprusvipestates.com`, `www.cyprusvipestates.com`, and staging's raw IP `72.60.89.239` with a code comment "remove after cutover" — **a merge/cutover checklist item**.

### Tracking

GTM `GTM-MQNF6L9V`, GA4 `G-WLD3B6GN9P` (loaded only via GTM, not directly), Google Ads `AW-16992138077`, Meta Pixel `1238429281352397`, LinkedIn Insight `10107329`, Microsoft Clarity `qoasnhd0ms` — all gated behind cookie-consent (`hasAnalytics`) except a first-party cookieless `/api/analytics/track` beacon which is always on. A single `DISABLE_TRACKING` flag in `src/app/[lang]/layout.tsx` (currently `false`) can kill GA4/Clarity/Pixel but not GTM/Ads/LinkedIn/first-party tracking. No staging-specific tracking suppression exists beyond the IP allow-list entry above.

### Cron routes

`drive-sync`, `feed-sync` (query-param `?key=` auth against `CRON_SECRET`), `publish-scheduled` (header `Authorization: Bearer <CRON_SECRET>`, constant-time comparison). Also `src/app/api/dev/sync/route.ts` — an **unauthenticated** manual trigger with no secret check at all, labeled "the admin button comes later."

**Live finding: `publish-scheduled` is currently broken on production.** Its crontab entry reads `CRON_SECRET` from `/var/www/cyprusvipestates/.env.production`, which **does not exist on disk**. The route's own `authorized()` check also independently fails since `CRON_SECRET` is absent from production's real `.env` too (§3). Direct inspection of `/var/log/cvp-cron-publish.log` (931 KB, still growing) confirms: thousands of successful `{"ok":true,...}` runs going back weeks, then a hard transition to `{"error":"Unauthorized"}` on every run starting **2026-07-15T08:15:01Z** (today) and continuing every 5 minutes since (94+ consecutive failures at last check). **Any content scheduled to auto-publish on production today has not gone live.** Root cause of the file's disappearance could not be conclusively determined from available evidence; it should be treated as an open incident regardless of cause — either restore `.env.production` with a valid `CRON_SECRET`, or repoint the crontab entry at production's real `.env`.

### SEO infrastructure

`robots.ts` (disallows `/admin`, `/api`, `/c/`, tracking-parameter query patterns; points at `/sitemap.xml`), `sitemap.xml/route.ts` (the live index), `sitemaps/[type]/route.ts` (5 per-type generators with hreflang). A second, currently-unreferenced `api/sitemap/route.ts` exists that already knows about the `NEW_PROJECTS_INDEXABLE` gate — worth deciding whether this becomes the canonical sitemap at cutover or gets removed.

### Redirects (`src/middleware.ts`)

1. `/properties` → `/projects` (308, all locales)
2. `/faq`, `/case-studies`, `/case-studies/[slug]` → rewritten (not redirected) to `preview-faq`/`preview-case-studies` equivalents, **English only** — `/de/faq` etc. still hit the old Sanity-backed implementation untouched
3. Singlepage canonicalization via `src/lib/nestedPageRedirects.json` — 23 entries across all 4 locales (en 8, de 7, pl 4, ru 4), not German-specific; maps flat leaf slugs to canonical nested parent/child paths to prevent duplicate-content URLs
4. Standard `next-intl` locale handling (English prefixless, `localeDetection: false`)
5. Matcher excludes `api`, `_next`, `admin`, `uploads`, `sandbox`, every `preview-*` top-level route by exact name, and `c/` — two of these exclusions exist specifically because of bugs fixed earlier this session (a bare `preview` prefix previously broke the in-`[lang]`-tree `preview-project/[slug]` route; missing `c/` exclusion previously 404'd every client-presentation link)

### Other

No payment/booking integration exists anywhere in the codebase (confirmed via grep for stripe/paypal/checkout — zero matches). Draft-mode preview routes, a server-side PDF brochure generator (filesystem-path-dependent on `public/uploads`), and the admin/CRM panel (staff-only, NextAuth-gated) round out the remaining production-facing surface.

---

## 7. Risk List

Ranked by how much damage a mishandled merge could do, based strictly on the findings above.

1. **Wrong-repo / wrong-branch confusion.** Production is a different git repo than staging, currently on a non-`main` feature branch. **Any merge tooling that assumes "push to production's main" is operating on the wrong branch entirely**, and a naive `git reset`/`clean` against production risks repeating the exact incident that necessitated the current 8 uncommitted hotfixes. *Mitigate: explicitly identify and pin the exact production branch/commit before any write operation; never run `git clean`/`reset --hard` against production without first confirming there are zero uncommitted changes worth preserving (there currently are 8).*

2. **8 uncommitted production hotfixes have no commit anywhere.** If lost, the FAQ/Case-Studies rollout content (Form.tsx additions, tokens.css rules, middleware rewrite, sanity.utils.ts function, 3 preview-* directories) disappears with no recovery path except redoing the surgical patch work. *Mitigate: commit these to production's own repo (or a documented equivalent) before any further destructive operation touches that directory.*

3. **Production's `publish-scheduled` cron has been silently failing since 08:15 UTC today.** Scheduled content is not auto-publishing right now. This predates and is unrelated to the merge itself but will still be broken *after* a merge unless separately fixed. *Mitigate: restore/create `.env.production` with a valid `CRON_SECRET` (or repoint the crontab line at the real `.env`) before or independently of the merge.*

4. **No production cron for drive-sync/feed-sync.** If the merge activates the Development system on production without also adding these two cron entries (repointed at port 3000 or wherever production ends up), feed data and mirrored images will never auto-refresh there — this session's entire "why are the pictures missing" investigation would recur on production. *Mitigate: add drive-sync/feed-sync crontab entries targeting production as part of the cutover, not as an afterthought.*

5. **Production's `prisma/migrations` folder is 22 migrations behind what's actually applied to the shared DB.** Not a live-data risk (the DB itself is fine), but a serious trap for anyone who later runs `prisma migrate deploy`/`resolve` from production's stale tree, or provisions a fresh environment from it. *Mitigate: sync production's migration folder to match the local repo's 33 before or during the merge, purely as a git-hygiene fix — no `migrate deploy` needs to run against the live DB since it's already current.*

6. **`GOOGLE_REFRESH_TOKEN`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`ANTHROPIC_API_KEY`/`CRON_SECRET`/`DEV_FEED_KEY_*` are entirely absent from production's `.env`.** Any merged code path that depends on these (Drive sync, AI extraction, cron auth) will fail immediately post-merge without a manual env update. *Mitigate: treat the 7 staging-only env vars as a mandatory pre-cutover checklist, not something the code merge itself can carry.*

7. **`ALLOWED_HOSTS` in `src/lib/antispam.ts` still allow-lists staging's raw IP `72.60.89.239`**, per its own "remove after cutover" comment. Leaving it in doesn't break anything today but is a known, already-flagged cleanup item for cutover. *Mitigate: remove at cutover as already planned by whoever wrote that comment.*

8. **The legacy↔Development overlap table is a name-heuristic, not a verified identity match.** Two of the 25 "High" confidence rows already show mismatched qualifiers (Pelagos vs Azure, Apartments vs Villas) on what's presumably the same building, and 3 rows are flagged likely-false-positives purely from a shared generic word ("village"/"villa"). *Mitigate: have a human (ideally whoever knows the actual portfolio) walk the table in §4 before wiring any activate/deactivate logic to it — do not trust the "High" label alone.*

9. **5GB `public/uploads` has no recurring backup**, unlike the database (which is backed up daily and healthy). A single shared directory serves both apps via symlink, so any accidental deletion during merge work (e.g. a repeat of the `rsync --delete` class of mistake already seen once this session) has no automated recovery path — only whatever manual tarball happens to be lying around. *Mitigate: stand up a simple recurring `tar`/rsync-to-cold-storage job for `public/uploads` before doing any further risky operation near it, independent of the merge itself.*

10. **`/var/www/cve-staging` has no `.git` directory** — its deployed state can only be inferred by diffing against the source repo's HEAD at deploy time, not inspected directly on the server. *Mitigate: when writing the actual migration plan, always diff against the local repo's current HEAD (or the specific commit staging was last built from) rather than assuming "whatever's on the staging server" is directly queryable.*

11. **The local/staging repo itself has 52 uncommitted working-tree files** (unrelated blog/insights migration and landing-page import work) and is 4 commits ahead of `origin/redesign/home`. Not itself a merge-safety risk, but worth resolving (commit or discard) before treating "staging's repo" as a clean, fully-known merge source. *Mitigate: decide the fate of the 52 uncommitted files (they were deliberately excluded from this session's restoration work as "unrelated") before finalizing exactly what "staging's code" means for the merge.*
