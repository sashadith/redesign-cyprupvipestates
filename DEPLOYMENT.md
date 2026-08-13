# Deployment — Cyprus VIP Estates

Two environments, one shared production database, two separate PM2 apps,
two separate deploy scripts. This document covers both, plus the safety
mechanisms (`verify-runtime-assets.sh`) and rollback procedures that came out
of the 2026-07 staging→production merge.

## Environments

| | Staging | Production |
|---|---|---|
| URL | https://design.cyprusvipestates.com | https://cyprusvipestates.com |
| PM2 app | `cve-staging` (fork mode, 1 instance) | `cyprusvipestates` (cluster, 2 instances) |
| Port | 3200 | 3000 |
| App dir | `/var/www/cve-staging` (plain directory, unchanged) | `/var/www/cyprusvipestates` — **symlink** into `/var/www/releases/` since 2026-07-24, see "Production release structure" below |
| Deploy script | `scripts/deploy-staging.sh`, run from whatever **feature branch** you're testing (deploys the local working tree, uncommitted WIP included) | `scripts/deploy-prod.sh`, deploys a clean **committed ref — `main` only** by default (`CVP_PROD_REF` can override, but there should be no routine need to) |
| Indexing | `X-Robots-Tag: noindex, nofollow` (nginx, domain-wide) + `robots.txt: Disallow: /` — enforced at the nginx layer, so no page-level metadata mistake can accidentally get staging indexed | Indexed normally; per-page `<meta robots>` control only |
| Access | Public, no Basic Auth (removed 2026-07-01 on request) | Public |
| Database | **Same shared Postgres DB as production** (read-mostly use in practice, but nothing enforces that — see below) | `cyprusvipestates` on `localhost:5432` |
| Crons | **None** — production's crons own the shared DB; staging's own `drive-sync`/`feed-sync` entries were disabled (commented out, not deleted) 2026-07-16 once production took over both jobs | All production-facing crons active — see "Cron topology" below for the full schedule |
| `public/uploads` | Symlink → `/var/www/shared-uploads` | Symlink → `/var/www/shared-uploads` |

Both apps point `public/uploads` at the same physical directory
(`/var/www/shared-uploads`, introduced during the Phase 3 retry — see
"Lessons learned" below). There is no upload isolation between the two
environments: deleting or overwriting an upload on one destroys it on both.

**Staging shares the production database — content edits made there ARE live
data, not a sandbox copy.** It renders real content specifically so
stakeholders previewing a feature branch see the real site, but there is no
technical isolation: creating, editing, or deleting a CMS row, project,
development, or any other DB record while pointed at staging changes what
production serves too, immediately. Lead delivery is the one thing
deliberately disabled there (`MONDAY_API_KEY`/`TELEGRAM_BOT_TOKEN` blanked in
its `.env`) so form tests never reach the real CRM — everything else reads
and writes the one shared database.

## The nginx layer (routing decisions made OUTSIDE this repo)

Production's nginx vhost (`/etc/nginx/sites-enabled/cyprusvipestates` on the
VPS) makes real routing/redirect decisions **before a request ever reaches
the Next.js app** — most importantly, a blanket rule that 301-redirects any
`/en` or `/en/{path}` to the prefixless equivalent:

```nginx
location = /en { return 301 /; }
location ^~ /en/ { rewrite ^/en/(.*)$ /$1 permanent; }
```

**This is not visible from the app code.** `src/middleware.ts` has its own
next-intl-based default-locale handling (and, since 2026-07-19, its own
explicit `/en/` 301 logic — see `EN_REDIRECT_TITLE_SWEEP_EXCLUDE`) that looks
complete and tests correctly in local dev — but in production, nginx's rule
above wins every time (`^~` prefix match, evaluated before the request is
ever proxied to the app) and the app-level logic never runs. This was
discovered the hard way: an EN-migration redirect fix was built, tested
locally, and deployed at the app level on 2026-07-19, then found to have
zero effect in production for exactly this reason — nginx had already been
doing its own (subtly different, exclude-list-unaware) `/en/` redirect the
whole time, silently, with no trace of it in this repo or any doc.

**A tracked mirror of the live config now lives at `ops/nginx/`** (see
`ops/nginx/README.md` for how to keep it in sync — there's no automation
enforcing this yet, it's a manual copy-back-after-editing discipline).
Before treating `src/middleware.ts` as the authority on any `/en/`,
locale-prefix, or path-rewrite behavior, check `ops/nginx/cyprusvipestates.conf`
too — nginx and the app both make routing decisions, and nginx's run first.

## Standard workflow

```
feature branch  →  deploy-staging.sh  →  verify on staging  →  merge to main  →  deploy-prod.sh
```

1. Branch off `main` for any change (`git checkout -b feat/my-change main`).
2. Push it up, then `git checkout feat/my-change && ./scripts/deploy-staging.sh`
   to preview it on https://design.cyprusvipestates.com. Repeat as you iterate
   — deploy-staging.sh deploys whatever's currently checked out locally,
   uncommitted WIP included, so there's no need to commit between iterations.
3. Once verified, open a PR into `main` (or merge directly if working solo)
   and push.
4. `git checkout main && git pull --ff-only && ./scripts/deploy-prod.sh`
   (no branch flag needed — it defaults to `main`) to ship it.
5. Run `./scripts/verify-landing-merges.sh` against production immediately
   after **every** deploy — not just ones that appear to touch
   `DE_LANDING_MERGES`. Not optional, not "when you remember" — see below
   for why, but in short: the 2026-07-28 incident wasn't caused by a
   redirect-focused deploy, it was caused by an *unrelated* deploy's clean
   `main` export silently not containing another branch's still-unmerged
   table entry. Any deploy can trigger that failure mode, so the check runs
   after any deploy. It's cheap (a handful of curls) and the failure mode is
   silent — exactly the combination that argues for always-on over
   conditional.

Staging and production are deliberately decoupled deploy-wise (different
scripts, different trigger points) but share the one database — see the
warning above before using staging for anything beyond a visual/functional
preview.

## Landing-page merge redirects — a deploy-ordering trap

`DE_LANDING_MERGES` in `src/middleware.ts` (paired with exact-match
`location` blocks in `ops/nginx/cyprusvipestates.conf`) is a plain object
literal — every entry lives in the same file. **Two feature branches that
both add entries to it, built independently off `main` rather than off each
other, will silently overwrite each other's entries the moment both get
deployed** — `deploy-prod.sh` exports and rsyncs a clean tree of whichever
ref you give it; the second deploy's tree simply doesn't contain the first
deploy's addition, and there's no merge step to catch that. This isn't
theoretical: it happened on 2026-07-28 — a `grosse-villen-zypern` redirect
that had verified clean minutes earlier came back 404 the moment a sibling
branch adding `haeuser-auf-zypern` entries was deployed on top.

**Rule for any run of landing-page consolidation batches (the ~94-page
audit that motivated this section is ongoing as of 2026-07-28): each new
batch branches from the tip of the previous batch's branch, not from `main`,
until that branch is actually merged to `main`.** Once merged, branch from
`main` again as normal. If you're not sure whether the branch you're
starting from already contains every merge currently live in production,
check `git merge-base --is-ancestor <branch> origin/main` and — if false —
`./scripts/verify-landing-merges.sh` against production to see what's
actually live before assuming your starting point is current.

After **every** deploy — regardless of whether that deploy looks like it
touched this table — run:

```bash
./scripts/verify-landing-merges.sh                                          # production
CVP_VERIFY_HOST=https://design.cyprusvipestates.com ./scripts/verify-landing-merges.sh   # staging
```

It reads `DE_LANDING_MERGES` directly out of the checked-out `middleware.ts`
(never a hardcoded URL list, so it can't go stale as the table grows) and
confirms every entry single-hops to its target with a 200 landing. A ✗ row
means this deploy is not verified — do not consider it done until it's ✓.

## Deploy scripts

### `scripts/deploy-staging.sh`

Syncs the **current local working tree** (uncommitted WIP included, by
design — see the script's own comment on why `--delete` was removed) to
`cve-staging`, then does a clean `rm -rf .next && npm run build` with a
capped `DATABASE_URL`, runs the `verify-runtime-assets.sh` gate, and reloads.

```bash
git checkout <your-feature-branch> && git pull --ff-only
./scripts/deploy-staging.sh
```

There's also a GitHub Actions workflow (`.github/workflows/deploy-staging.yml`),
manually triggered (`workflow_dispatch`) against whichever branch/ref you pick —
it checks out the **committed** tree only, so it can diverge from what the
script just synced if you have uncommitted changes locally. Don't rely on both
at once for the same change. (Before 2026-07-18 this workflow auto-fired on
every push to `redesign/home`; that branch was merged into `main` and retired
as the active line of work — see "Branch history" below — so there's no
single fixed branch left to auto-trigger from.)

### `scripts/deploy-prod.sh`

Deploys a clean, **committed git ref** (default `main`) to production —
never the working tree. Builds happen entirely in an isolated release
directory (`/var/www/releases/cve-<timestamp>/`); the live site is never
touched during the build itself, only at one atomic symlink swap once every
gate has passed — see "Production release structure" below for the full
mechanism. Requires a typed confirmation (or `--yes`) and verifies the
current live symlink actually resolves to the production app before doing
anything.

```bash
./scripts/deploy-prod.sh --dry-run          # preview only, no changes
./scripts/deploy-prod.sh                    # deploy `main`, prompts to confirm
CVP_PROD_REF=main CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh   # opt-in DB migration
```

`npm ci` and `prisma migrate deploy` are both opt-in (`CVP_RUN_INSTALL=1`,
`CVP_RUN_MIGRATE=1`) since they touch shared state — leave them off for a
pure code deploy. `node_modules` and `.next/cache` are always copied forward
from the currently-live release regardless, so a routine deploy without
`CVP_RUN_INSTALL=1` still gets a fast, incremental build — only skip `npm ci`
when `package.json` hasn't changed since the last deploy.

Both scripts require VPS SSH access (`~/.ssh/cvp_vps`, or `CVP_SSH_KEY`), and
both cap the build-time `DATABASE_URL` with `connection_limit=5&pool_timeout=30`
— `next build`'s static-generation phase spawns one worker per available CPU,
and building on a higher-core machine than the VPS can otherwise stack more
connections than Postgres's `max_connections` allows. Only the one-off build
invocation is capped; the real `.env` on disk, and pm2's serving processes,
are never touched.

## Production release structure

Rewritten 2026-07-24 from an in-place build (which ran `npm run build`
directly inside the live app directory while the 2 pm2 cluster instances
kept serving out of it — Next.js deletes and rewrites chunks/manifests
mid-build, so the site was effectively broken for the entire build window,
240–340s measured) to a release-directory + symlink-swap model. The build
now happens completely outside the live path; the live site only changes at
one atomic symlink swap, after every gate below has passed.

```
/var/www/releases/cve-<UTC-timestamp>/   one directory per deploy
/var/www/cyprusvipestates                symlink -> current release (the NAME
                                          is unchanged from before the rewrite —
                                          nginx, crontab, and ecosystem.config.js
                                          all still reference this exact path,
                                          untouched by the rewrite)
/var/www/shared/.env                     real file, symlinked into every release
/var/www/shared/secrets/                 real dir,  symlinked into every release
/var/www/shared-uploads/                 real dir,  symlinked into every release's
                                          public/uploads (pre-existing, unchanged)
/var/www/deploy-logs/                    .deploy-status / .deploy-build.log —
                                          NOT part of any release
```

`.env` and `secrets/` are gitignored/rsync-excluded (so they never land inside
a freshly-checked-out release on their own) — instead the real files live once
in `/var/www/shared/`, and every release gets a fresh `ln -sfn` symlink to them.

### The three gates

All three run **after the build, before the symlink swap** — a failure at
any of them means the live site was never touched; the old release just
keeps serving.

1. **BUILD_ID gate** — `$RELEASE/.next/BUILD_ID` must exist and be
   non-empty. Protects against a build that crashed partway through (e.g.
   an OOM) without the script's `set -e` catching it.
2. **`verify-runtime-assets.sh`** — every file read via `fs.readFile`/
   `readFileSync` at request time (invisible to `next build`'s static
   import-graph check) must actually exist in the new release. Protects
   against the `DejaVuSans.ttf` class of bug (see "Lessons learned").
3. **`verify-www-data-access.sh`** — nginx's worker user (`www-data`) must
   be able to traverse the full directory chain and read a real
   `.next/static/*.css` file, checked with `sudo -u www-data`, not just
   root's own view of the permission bits. Protects against the
   release-directory-permissions class of bug (see "Lessons learned") — a
   release can build cleanly and pass gates 1–2 while still being unreadable
   by nginx if the directory itself isn't traversable by `www-data`.

### If a deploy fails

This is the main behavior change from before the rewrite: **a failed deploy
never affects the live site.** The symlink still points at the previous
(working) release; pm2 is still serving it; nothing was reloaded. The only
cleanup needed is deleting the failed release directory
(`/var/www/releases/cve-<timestamp>/`) — the script's own retention logic
(keep newest 3 + the live one) does this automatically on the next
successful deploy anyway, so manual cleanup is optional, not urgent.

## Post-deploy smoke test

After every production deploy, check:

- Homepage (`/`) — 200
- One project detail page (`/projects/<slug>`) — 200
- One `/c/<token>` client-presentation link — 200
- One `/book/<token>` booking link — 200 (see docs/BOOKING-PAGE.md; sits
  outside `[lang]` same as `/c/<token>`, so it needs the same middleware
  matcher exclusion — missing it silently 404s every booking link)
- `/sitemap.xml` — 200
- Lead form (`/api/leads`) — a request with valid required fields returns
  `{"ok":true,"created":true}`; a request missing them returns `{"ok":false}`
  with HTTP 200 (the anti-spam guard's designed behavior, not an error). A
  full real submission triggers a live Telegram message + email to the
  business — only do that with explicit go-ahead, and delete the test lead
  (`Lead` + its `LeadActivity` rows) afterward.
- `/api/dev/sync` with no `Authorization` header — 401 (see Phase 4.3).

**Admin login is a manual check, not an automated one.** The admin's
password lives only in the `users` table, changed through the panel — never
in `.env` (see `prisma/seed-admin.mjs` below). There is no environment value
to script a login test against, and there shouldn't be: the account owner
should log in themselves after a deploy that could plausibly affect
auth, and report if it fails.

## The `verify-runtime-assets.sh` gate

Runs against a freshly-built tree, before that build is allowed to go live
(before `pm2 reload` in both deploy scripts). It exists because `next build`
only validates the static `import`/`require` graph — a file read via
`fs.readFile`/`readFileSync` at **request time**, using a literal path, is
invisible to the build and only fails on the first real request that
reaches it.

Currently checks:
- `public/fonts/DejaVuSans.ttf` — loaded by `Font.register()` in the PDF
  brochure route.
- `public/medousa-feed.xml` — read by the medousa feed adapter.
- `public/uploads` resolves to a non-empty directory (covers the logo,
  hardcoded distance icons, and mirrored feed/Drive images without
  enumerating each one).

**To extend it** when new code reads a file at runtime: search for new
literal-path call sites —

```bash
grep -rn "readFile(join(\|readFileSync(join(" src/
```

— and decide per call site: a fixed, always-required file goes into
`REQUIRED_FILES` in `scripts/verify-runtime-assets.sh`; a data-dependent or
dynamic path (e.g. per-project images under `public/uploads`) doesn't need
enumerating, since the existing `public/uploads` directory check already
covers it.

## Rollback

### Fast rollback (switch to an already-built release)

The last 3 releases are kept on disk (`/var/www/releases/cve-<timestamp>/`,
see "Production release structure" above) specifically so a rollback
doesn't need a rebuild:

```bash
ls -1dt /var/www/releases/cve-*   # find the previous good timestamp
ln -sfn /var/www/releases/cve-<previous-good-timestamp> /var/www/cyprusvipestates.new
mv -T /var/www/cyprusvipestates.new /var/www/cyprusvipestates
pm2 reload cyprusvipestates --update-env
```

Under 5 seconds, DB untouched (schema is additive-only). This never touches
`.env` or `secrets/` — every release already has its own `ln -sfn` symlink
to the same stable `/var/www/shared/.env` and `/var/www/shared/secrets/`,
regardless of which release is currently live, so switching which release
`/var/www/cyprusvipestates` points at doesn't require touching them at all.

### Routine rollback (rebuild an older ref)

Still valid, and the only option once the release you want is no longer on
disk (older than the retained 3): every production deploy is a named,
committed git ref.

```bash
CVP_PROD_REF=<previous-good-sha-or-tag> ./scripts/deploy-prod.sh
```

This builds a brand-new release from that ref like any forward deploy — same
three gates, same symlink swap — it just happens to check out older code.

### Full-tree atomic swap (historic — superseded 2026-07-24 by the release-directory + symlink-swap model above, kept for institutional memory only)

Production used to be served from a different, separately-tracked git repo
than staging. Retiring that repo and moving production onto this repo's
tree (the "merge") wasn't a normal incremental deploy — it replaced the
entire live directory in one step, so it used a directory-rename swap
instead of `deploy-prod.sh`'s in-place rsync:

```bash
# Build the new tree next to the live one, verify it, then swap:
git archive <merge-candidate-tag> | tar -x -C /var/www/cyprusvipestates-next
# ... npm ci, capped-DATABASE_URL build, verify-runtime-assets.sh — same
#     as deploy-prod.sh's steps, just against a fresh directory instead of
#     the live one in place ...
bash scripts/verify-runtime-assets.sh /var/www/cyprusvipestates-next   # hard gate — must exit 0

mv /var/www/cyprusvipestates /var/www/cyprusvipestates-<label>-<date>
mv /var/www/cyprusvipestates-next /var/www/cyprusvipestates
pm2 reload cyprusvipestates --update-env
```

Rollback is the same two `mv`s in reverse:

```bash
mv /var/www/cyprusvipestates /var/www/cyprusvipestates-<new-label>-<date>
mv /var/www/cyprusvipestates-<label>-<date> /var/www/cyprusvipestates
pm2 reload cyprusvipestates --update-env
```

Both directions are near-instant (single `mv` on the same filesystem, not a
copy) and trivially reversible — this is what made same-day rollback and
retry viable during the actual cutover (rolled back once, ~6 minutes after
the first swap, after the PDF-brochure regression below was caught; retried
successfully after the fix).

This procedure is documented for institutional memory in case a future
change needs the same full-tree-replacement treatment. Routine deploys
should use `deploy-prod.sh`, not this.

## Cron topology

All production-facing cron jobs run against `cyprusvipestates` on port 3000
and authenticate with `CRON_SECRET` (read fresh from `.env` on each run, not
hardcoded in the crontab):

| Schedule | Job | Target |
|---|---|---|
| `*/5 * * * *` | `publish-scheduled` (publishes scheduled content) | production, `Authorization: Bearer $CRON_SECRET` |
| `30 4 * * *` | `drive-sync` | production, `?key=$CRON_SECRET` |
| `0 4 * * *` | `feed-sync` | production, `?key=$CRON_SECRET` |
| `30 3 * * *` | `cvp-db-backup.sh` | DB dump, not app-specific |
| `0 5 * * 0` | `cvp-uploads-backup.sh` | shared uploads dir, weekly |
| `0 5 * * *` | `action-digest` (Action Center Telegram digest) | production, `?key=$CRON_SECRET` |
| `30 5 * * *` | `gsc-sync` (Google Search Console daily sync — see src/lib/gsc/) | production, `?key=$CRON_SECRET` — installed 2026-07-18; a no-op ("skipped: not configured") until `GSC_SERVICE_ACCOUNT_KEY_PATH`/`GSC_SITE_PROPERTY` are set, see .env.example |
| `0 2 * * *` | `psi-sync` (Core Web Vitals nightly sync — see src/lib/psi/) | production, `?key=$CRON_SECRET` — installed 2026-07-18; a no-op until `PSI_API_KEY` is set |
| `0 6 * * 0` | `seo-advisor` (weekly Claude-analyzed SEO suggestions, Sundays — see src/lib/seoAdvisor/) | production, `?key=$CRON_SECRET` — installed 2026-07-18; a no-op until `ANTHROPIC_API_KEY` is set (it already is) |
| `2,7,12,17,22,27,32,37,42,47,52,57 * * * *` | `email-inbound` (files matched lead replies into their timeline, read-only IMAP — see src/lib/emailInbound/) | production, `?key=$CRON_SECRET` — installed 2026-07-25; offset from `publish-scheduled`'s `*/5` so the two never fire in the same wall-clock second |
| `4,9,14,19,24,29,34,39,44,49,54,59 * * * *` | `booking-reminders` (Telegram 1h/10m meeting reminders for confirmed bookings — see src/app/api/cron/booking-reminders/) | production, `?key=$CRON_SECRET` — installed 2026-07-25; offset +4 from `publish-scheduled`'s `*/5` and distinct from `email-inbound`'s +2, so no two of the three ever land on the same wall-clock second |

VPS system clock is UTC (confirmed: `Development.syncedAt` rows written by
`feed-sync`'s `0 4 * * *` entry land at `04:00:xx.xxxZ`) — crontab times above
are plain UTC, not Cyprus-local. `action-digest` is specified as "daily 08:00
Cyprus time"; Cyprus is EEST (UTC+3) in summer, so `0 5 * * *` UTC = 08:00
Cyprus. Note it'll need revisiting to `0 6 * * *` when Cyprus switches to EET
(UTC+2) in winter, since the VPS crontab has no timezone awareness of its own
— `gsc-sync`'s `30 5 * * *` has the same seasonal drift.

Staging's own `drive-sync`/`feed-sync` entries (previously hitting
`127.0.0.1:3200`) were **disabled** (commented out, not deleted) in the
crontab on 2026-07-16 once production took over both jobs post-cutover —
kept in place, commented, for the record.

**One-time migration window (2026-07-24).** The `*/5 * * * * publish-scheduled`
cron (or any cron reading `/var/www/cyprusvipestates/.env`) can fail exactly
once if it happens to fire during the sub-second window of a one-time
`mv`+`ln -s` infrastructure migration, when the path briefly doesn't exist.
Not a concern for routine deploys — those use `ln -sfn` + `mv -T` to replace
an already-existing symlink name, with no such gap — only for one-time
migrations like the 2026-07-24 release-structure cutover. A failed run just
retries at the next 5-minute tick; no action needed.

## Branch history

**2026-07-18 — `redesign/home` renamed to `main`.** The entire homepage
redesign had lived on `redesign/home` since the design work began; by this
date it was what production actually ran, while `main` sat 139 commits stale
(a live trap: a deploy invoked without an explicit branch flag would have
silently shipped months-old code). Resolved by force-pushing `redesign/home`
onto `main` (`git push origin redesign/home:main --force-with-lease`) —
`main`'s prior state had zero commits not already present on `redesign/home`,
so nothing of value was lost; its old history remains reachable via the
commit shas below if ever needed. `main` was set as the repository's default
branch on GitHub. `redesign/home` itself was kept (not deleted) for a grace
period but is no longer the active line of work — do not branch off it or
push to it.

- Old `main` tip (superseded): `86649d2`
- New `main` tip (= `redesign/home` HEAD at rename time): `6253a49`

**2026-07-18 — `wip/content-imports` audited and deleted.** This branch held
one commit (`d12f06d`) of unrelated concurrent WIP snapshotted off to the side
during the 2026-07-16 staging→production merge, explicitly marked "not
reviewed/finished." Fully dispositioned before deletion:

- Blog/Insights listing migration — **discarded**; `main`'s own version had
  already evolved past this snapshot independently.
- DE/PL/RU landing-page import scripts + 21 markdown content files — the
  import had already run against the shared production database before this
  branch's code was ever committed to `main` (all 21 pages verified live).
  **Archived** to `legacy-scripts/landing-imports/`.
- `OffPlanSnapshotBlockComponent` (stats grid + district table, unwired to
  any page) — live-checked https://cyprusvipestates.com/off-plan-properties-cyprus,
  confirmed no equivalent block renders there. **Extracted** to its own
  branch, `feature/offplan-snapshot` (not merged — unreviewed, unwired),
  for later evaluation.
- Small SEO/ops hardening (`robots.ts` `/c/` disallow, `next.config.mjs`
  X-Robots-Tag header + `serverActions.bodySizeLimit`, Telegram
  lead-notification emoji cleanup) — verified none of it existed in `main`
  yet, **cherry-picked** in.
- "Top property matches" in the lead Telegram notification — the WIP code
  called `matchDevelopmentsForLead()` with a signature that predated the
  current `src/lib/crm/matching.ts` API (built later, in the Action Center
  work). **Re-implemented fresh** against the current API rather than merged.
- Two planning docs (`SEO-GROWTH-ROADMAP-2026.md`, `DATA-INSIGHTS-LAYER-
  SPEC.md`) — pure documentation, no code impact. **Merged** into `docs/`,
  each flagged with a note that their "Development/Project are two separate
  systems" framing predates the routing-layer unification (2026-07-17).

Branch deleted (both local and `origin`) once every slice above was resolved
and deployed to production.

## Lessons learned

**`.env` as a stale bootstrap credential, not a source of truth.**
`prisma/seed-admin.mjs` originally used `upsert`, which overwrote the admin
user's password hash with `ADMIN_PASSWORD` from `.env` on every run. Since
the account's *real* password lives in the database and is changed through
the admin panel, any re-run of the seed script — or simply `.env` never
being updated after a panel password change — silently reset it back to a
stale value. This looked exactly like a broken account (`CredentialsSignin`)
and was investigated as one twice before the actual cause (a deliberate
panel password change the seed script would have clobbered on its next run)
was found. Fixed by making the script create-only: it now checks whether the
account exists first and never touches an existing user's password.
`ADMIN_PASSWORD` in `.env` is only relevant for creating this account for
the very first time on a fresh database — it's fine, and expected, for it to
be absent or stale afterward.

**The runtime-asset class of failure.** The first production cutover
attempt (2026-07-16) passed a clean build with zero errors and still 500'd
on the very first PDF-brochure request: `public/fonts/DejaVuSans.ttf`
existed in production's old, separately-tracked repo but had never been
committed to this one. `next build` only walks the static `import` graph —
a file reached exclusively through `fs.readFile`/`readFileSync` at request
time is invisible to it. The build succeeding proves nothing about whether
that class of dependency is present. `verify-runtime-assets.sh` exists
specifically to catch this: it's a hard, explicit gate that runs against the
built tree and blocks `pm2 reload`/the swap if a known runtime-only asset is
missing — the same class of bug can't recur silently, though it does rely on
a human periodically re-running the `grep` above to keep the checked list
current as new code is added.

**Rsync UID/GID leak (`deploy-prod.sh` history).** An early version of the
script used `-a` (archive mode), which preserves the *source* files'
numeric UID/GID. Since the source was a local `mktemp` export, that meant
the local machine's user ID got applied to the live directory on the VPS —
once locking it to `700` owned by a foreign UID, invisible to `curl` (the
app still served fine) but making every static asset 403 for nginx's
worker. Fixed by dropping `-o`/`-g` from the rsync flags and force-correcting
the app directory's ownership before every build, unconditionally.

**Build-time connection exhaustion.** Running an isolated build on a
higher-core-count machine than the 2-CPU VPS spawned far more parallel
`next build` static-generation workers than the VPS itself ever would, each
opening its own Prisma connection pool — enough to hit Postgres's
`max_connections` ("too many clients already"). Not a live-traffic risk
(steady-state pool usage was confirmed at ~15% of capacity), but real during
builds. Fixed by capping the build-time-only `DATABASE_URL` with
`connection_limit=5&pool_timeout=30`, baked into both deploy scripts and the
CI workflow permanently.

**`tar` over a symlinked path silently backs up nothing (2026-08-03).**
`public/uploads` has been a symlink to `/var/www/shared-uploads` since the
2026-07-24 release-directory + symlink-swap model (see "Production release
structure" above). `cvp-uploads-backup.sh`'s `tar -czf ... uploads` — without
`-h`/`--dereference` — archives the symlink itself, not its target: a
~125-byte tarball containing one symlink entry, not the 5+ GB of real files
behind it. The script's own size guard (`< 1MB → ERROR`) correctly caught
this on every run since 2026-07-19, but the failure only ever reached
`/var/log/cvp-uploads-backup.log` — nobody was watching it, so the uploads
directory silently had zero working backups for three weeks. Any `tar` (or
similar archiver) invoked against a path under `public/uploads`, or against
`/var/www/cyprusvipestates` itself (also a symlink, to the live release —
see the same section), needs `-h`/`--dereference` or the equivalent, or it
will archive a symlink instead of content. Fixed in `cvp-uploads-backup.sh`;
`cvp-db-backup.sh` uses `pg_dump` directly and was never affected. `psql -l`
periodically listing an unexpected extra database can also be a signal worth
checking against `pg_stat_activity` before dropping it — `cyprusvipestates_forensic_before`,
a temporary safety-net DB created after a 2026-07-27/28 staging incident (see
"Staging is not a write sandbox" below), was found and removed 2026-08-03,
weeks after it was meant to be temporary.

**Client-side animation bugs are invisible to curl/SSR verification.** A
homepage stats-counter fix was verified after deploy by curling the page and
confirming the server-rendered HTML showed real numbers (not `0`) — it did,
and the deploy was reported verified. In the actual browser, the counters
still rendered `0`: the count-up effect used React *state* in its own
dependency array, so setting that state re-ran the effect (tearing down the
`setInterval` it had just started) before the animation's first tick — a
purely client-runtime bug that no amount of curling the HTML source could
ever have revealed, since SSR output was correct throughout. **Any change to
a client-side (`"use client"`) animation, transition, or interaction must be
checked in an actual browser, not just via curl/view-source** — curl can
confirm the initial/SSR state is correct but is structurally blind to what
happens after hydration.

**The deploy-wrapper premature-exit bug.** `deploy-prod.sh`'s remote
build+reload used to be one blocking `ssh host bash -s <<HEREDOC` call,
trusted for its own exit code to mean "the remote work finished." On
2026-07-18 this was observed THREE TIMES returning control (exit code 0) to
the local script while `next build` was still actively running on the VPS —
confirmed each time via `pgrep`/`pm2 pid` on the server immediately after.
Every one of those deploys was manually salvaged by polling the VPS directly
until the build genuinely finished before trusting the result. The exact
SSH-level cause wasn't conclusively isolated (no `ServerAliveInterval`/
`ServerAliveCountMax` was set on these scripts' `ssh` calls, unlike
deploy-staging's CI workflow — the leading suspect for a silently-dropped
long-idle connection during a multi-minute build with long silent gaps), but
the real fix doesn't depend on knowing the exact cause: both `deploy-prod.sh`
and `deploy-staging.sh` now launch the remote build in the background and
independently **poll** for its real completion — a written exit-status file
first, then (for `deploy-prod.sh`) a `pm2 pid` comparison confirming every
cluster instance was actually replaced, then the health check — before ever
printing success. A failed or timed-out build now exits non-zero with the
remote build log's tail, rather than silently looking fine. **Never trust a
single blocking call's exit code for a multi-minute remote operation** —
verify completion independently, from the outside, against the system's own
state.

**The `.env`/`secrets` symlink self-reference trap (2026-07-24).** During the
release-structure migration, an ad-hoc rollback attempt (run from a second
terminal, not through any script) tried to reverse the `.env`/`secrets`
extraction directly — moving the real files in `/var/www/shared/` back onto
the paths that were, by that point, already symlinks pointing at those exact
same real files. `mv` correctly refused: "cannot move to a subdirectory of
itself." No damage was done (the command just failed), but it cost real
debugging time before the actual cause (an unrelated, correctly-working
migration, not a bug) was found. **If the shared-state extraction ever needs
reversing by hand, the symlinks must be removed FIRST, then the real files
moved back — never the other way around:**

```bash
set -e
rm /var/www/cyprusvipestates/.env /var/www/cyprusvipestates/secrets
mv /var/www/shared/.env    /var/www/cyprusvipestates/.env
mv /var/www/shared/secrets /var/www/cyprusvipestates/secrets
```

This is not a routine operation — it only applies if the release-directory
model itself is ever being fully decommissioned, not to a normal rollback
(see "Fast rollback" above, which never touches `.env`/`secrets` at all).

**Shared-database migration discipline (2026-07-25) — two incidents, same
root cause.** There is only ONE Postgres database. `cve-staging` and
`cyprusvipestates` (prod) both connect to the exact same `cyprusvipestates`
DB on `localhost:5432` (see "Environments" above) — there is no separate
staging database to rehearse a migration against in isolation. The closest
thing to real isolation is a disposable `createdb` copy on the VPS restored
from a real `pg_dump` backup, which proves the migration SQL itself is
correct but says nothing about whether the code *currently running in prod*
is compatible with the new schema.

Both incidents that day had this exact shape: a LeadStatus enum rework
(Batch B) and an email-optional/`countryOfResidence` migration (Batch A)
were each applied to the shared DB during what felt like a "verify against
staging" step — except staging IS prod's data, so that step wasn't a
rehearsal, it was the production-affecting change itself, hours before the
corresponding code was actually merged and deployed. The OLD code, still
live in prod, immediately started throwing on real requests — `22P02`
(Postgres rejecting the removed enum literal) for the first incident,
`P2032` (Prisma refusing to deserialize a now-nullable column as
non-nullable) for the second. Neither was caught by `prisma migrate status`,
which only reports migrations known locally but not yet applied to the DB —
never the reverse (a migration already applied to the DB but missing from
the local `prisma/migrations/` folder, which is exactly this failure mode).
The check that actually catches it:

```bash
# On the shared DB:
psql "$DATABASE_URL" -tAc "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name" > /tmp/db.txt
# On the ref being checked (e.g. main):
ls prisma/migrations/ | grep -v migration_lock | sort > /tmp/local.txt
diff /tmp/db.txt /tmp/local.txt   # anything only in db.txt is undeployed drift
```

**The rule this enforces: a schema migration and the code that depends on
it always land on `main` together, and the code is deployed to prod BEFORE
— or in the exact same operation as — the migration is applied against the
shared DB.** Never run `prisma migrate deploy` (or any raw DDL) against the
shared DB while its corresponding code still lives only on a feature
branch — the instant the migration lands, the DB is ahead of whatever code
is actually running, and the next request that touches the changed
column/enum/table fails immediately, in real time, not "before the next
deploy." **`prisma migrate deploy` against the shared DB is therefore a
point-of-no-return step, on the same footing as a `DROP` or a destructive
rename — treat it as its own announced halt, separate from "deploy the
code,"** even when both are part of the same feature and land minutes apart.
Rehearsing the SQL on a disposable `createdb` copy first only proves the SQL
is safe; it proves nothing about whether prod's currently-live code can
survive the DB changing under it. Confirm the dependent code is already
deployed, or about to be deployed in the same breath, before the migration
ever touches the shared DB.

**A third incident (2026-08-10) — the rule above existed only in prose.**
`prisma migrate deploy` ran directly against the shared DB from
`fix/crm-status-plausibility`, a branch that was never merged to `main` —
the DB ended up with `leads.viewingScheduledAt` (migration
`20260810090000_add_lead_viewing_scheduled_at`) that no migration in
`main`'s history ever created. Caught the next day, by chance, when a later
migration tried to add the same column and got "already exists" — not by
the `diff` check above, which nobody ran by hand in the moment. No data was
at risk (the column was empty, nothing live reads it) and the exact
triggering command couldn't be reconstructed (non-interactive SSH sessions
never write to `.bash_history`), but the shape is the same as the two prior
incidents: a write against the shared DB that ran ahead of what `main`
actually contains.

**The fix: `scripts/migrate-deploy-safe.sh` enforces this instead of relying
on remembering to.** It wraps `migrate deploy`, `migrate resolve`,
`migrate reset`, and `db push` — every Prisma command that mutates schema or
migration history — resolves the target database name from `DATABASE_URL`,
and hard-aborts if it resolves to `cyprusvipestates` (the shared DB) unless
`CVP_CONFIRM_PROD_MIGRATE=yes` is set for that exact invocation. **Never run
`npx prisma migrate ...` or `npx prisma db push` directly — always through
this wrapper.** `deploy-prod.sh`'s `CVP_RUN_MIGRATE=1` path already calls it
(with the confirmation set automatically, since opting into `RUN_MIGRATE=1`
at the `deploy-prod.sh` call site already is the deliberate, separate
confirmation this exists to require). `scripts/assert-not-prod-db.mjs`
(2026-07-23) was an earlier attempt at the same guard, but as an opt-in
import only one one-off script ever actually called — nothing stopped a bare
`prisma migrate deploy` from running straight past it, which is exactly what
happened here.

**`cp -a` on the live symlink silently writes into the running release
(2026-07-26).** While building an isolated test copy to verify a fix against
real feed data, `cp -a /var/www/cyprusvipestates /var/www/tmp-sync-test/xyz`
was used, expecting a real, independent directory tree. It isn't one:
`/var/www/cyprusvipestates` is itself a symlink to the current release, and
`cp -a` (like plain `cp -r`) preserves symlinks by default rather than
dereferencing them — the "copy" was just a second symlink pointing at the
exact same live release directory. A subsequent `scp` meant for the isolated
copy landed directly on `/var/www/releases/cve-<current>/src/...`, silently
overwriting a file inside the release currently serving production traffic.
No visible damage resulted only because Next.js in production serves the
already-compiled `.next` output, not the raw `.ts` source tree — a
coincidence of this stack, not a safety property to rely on. The mistake was
caught immediately via `readlink -f` and reverted via checksum comparison
against the deployed git commit, but it was a real near-miss: a write against
the currently-running release, not a sandboxed copy.

**The rule this enforces: never write to any path reached by resolving
`/var/www/cyprusvipestates` (or a copy of it made without dereferencing
symlinks) — that path is always the live release, whichever timestamp it
currently points to.** Before writing into what's meant to be an isolated
copy, resolve the real target first, then copy with symlinks NOT followed
(`rsync -a --no-links`, excluding `node_modules`/`.next` which can be
re-symlinked in separately) into a directory that does not itself live under
`/var/www/releases/`:

```bash
LIVE_REAL=$(ssh "$HOST" "readlink -f /var/www/cyprusvipestates")
echo "$LIVE_REAL"   # confirm this is the release you expect before copying anything
ssh "$HOST" "rsync -a --no-links '$LIVE_REAL/' /var/www/tmp-sync-test/some-name/ --exclude node_modules --exclude .next"
ssh "$HOST" "ln -s '$LIVE_REAL/node_modules' /var/www/tmp-sync-test/some-name/node_modules"
# .env / secrets / public/uploads are themselves symlinks into /var/www/shared*
# — recreate those specific symlinks explicitly, they won't come along via --no-links:
ssh "$HOST" "ln -sf /var/www/shared/.env /var/www/tmp-sync-test/some-name/.env"
```

Test overlays (a fixed file copied in to verify a real-data sync before
deploying) must only ever land inside such a verified, separately-rooted
directory — never inside `/var/www/releases/` itself, and never inside
anything reached by following `/var/www/cyprusvipestates` without first
confirming, via `readlink -f`, exactly where it points.

**Any write path can leak through a symlink, not just the obvious ones
(2026-07-27).** The `cp -a` incident above was about overwriting a *source*
file. The same class of mistake resurfaced one incident later in a different
shape: an isolated test copy's `node_modules` was itself set up as a symlink
back to the live release's real `node_modules` (reasonable — packages
themselves are read-only and identical, no need to duplicate hundreds of MB
per test run). But `prisma generate` **writes** into
`node_modules/.prisma/client` and `node_modules/@prisma/client` — so that one
symlinked directory turned a read-only convenience into a write straight into
the live release. It happened to be harmless this time only by accident (an
unrelated `scp -r` nesting bug meant the regenerate ran against the old
schema and reproduced equivalent output), not because the setup was safe.

**The rule this enforces: before symlinking ANY directory from a live
release into an isolated copy, ask what will *write* into it — not just what
will be read from it.** `node_modules` as a whole is not safe to symlink
wholesale if anything in the test run touches Prisma codegen; the
`.prisma/`  and `@prisma/client` subpaths specifically must be real, separate
copies (or a real `npm ci`), while every other package underneath can still
be symlinked freely since nothing writes there. The same question applies to
any other tool a future test might run — a linter with an auto-fix mode, a
codegen step, anything with a `--write`/`--fix` flag — not just Prisma.
`readlink -f` before copying tells you where a path resolves; it does not
tell you which of the paths you're about to create are write targets. Check
both, for every symlink a test setup creates, not only for the top-level
release path.

## Isolated testbed (`/opt/cvp-testbed/`)

After five incidents in this shape — a write meant for an isolated test copy
leaking through a symlink into the live release or the shared DB — the fix
is structural, not another rule to remember: a **persistent, dedicated
testbed with zero symlinks back into `/var/www`**, for any verification that
needs to run real code (`prisma generate`, a sync/backfill script, anything
beyond a read-only query) before it's safe to run against production.

**Location: `/opt/cvp-testbed/`** — deliberately outside `/var/www` entirely.
No path or realistic relative symlink chain from here reaches
`/var/www/releases/...`; there is no shared parent directory to traverse
into by mistake.

```
/opt/cvp-testbed/
  repo/                  a real `git clone` (never rsync from a release) —
                         node_modules is a genuine `npm ci`, not linked to
                         anything in /var/www; .prisma/@prisma are real,
                         separate files on disk, so prisma generate can only
                         ever write here
  refresh.sh             pull a ref, npm ci --legacy-peer-deps, prisma generate
  db-testbed-up.sh       build a disposable DB + role from the latest backup
  db-testbed-down.sh     tear the disposable DB + role back down
  .env.testbed           written by db-testbed-up.sh — DATABASE_URL only,
                         never any other secret (see below)
```

**Footprint:** ~1.9G `node_modules` + a 66–81MB disposable DB, against 36G+
free — comfortable. Deliberately **no `next build`/`.next` here** (which
would add ~3.6G): everything this testbed exists to verify — sync logic,
backfills, migrations — is backend code that runs directly via `tsx`, the
same "use server" workaround used throughout this project's scripts; it
never needs the compiled Next.js output.

**Database isolation, not just by convention:** `db-testbed-up.sh` drops and
rebuilds `cyprusvipestates_test` from the latest real backup on *every* run
(cheap — the DB is under 100MB) — restoring the *code* to a known state but
never inheriting stale test data. It also creates a **fresh, disposable
Postgres role** (`cvp_testbed`, random password, regenerated every run) that
owns only that one database and has no grants on the real `cyprusvipestates`
DB. `.env.testbed` therefore can't be pointed at prod even by a coding
mistake in whatever script runs against it — the credential itself doesn't
work there. The backup file actually restored is always printed by the
script, so any test run's data state is traceable after the fact.

**Secrets stay out by policy, not just by what happens to be needed today.**
`.env.testbed` contains `DATABASE_URL` and nothing else. If a future test
genuinely needs another credential (an API key, SMTP/IMAP, a bot token),
that's a deliberate decision to make explicitly — which variable, why, and
whether it can be a dummy/sandbox value instead of the real one — not
something a setup script copies in by default because the app's own `.env`
happens to have it.

**Usage:**
```bash
/opt/cvp-testbed/refresh.sh <branch-or-ref>   # default: main
/opt/cvp-testbed/db-testbed-up.sh             # fresh disposable DB, prints backup used
cd /opt/cvp-testbed/repo
set -a && source /opt/cvp-testbed/.env.testbed && set +a
npx prisma migrate deploy    # bring the disposable DB's schema current, if the branch adds one
npx tsx <your-script>.mts    # run whatever needs verifying, against the disposable DB
/opt/cvp-testbed/db-testbed-down.sh           # tear down when done
```

**When to use it:** any time a verification needs to *write* something —
regenerate a Prisma client from a schema not yet on `main`, run a sync or
backfill function against real-shaped data, rehearse a migration end to end.
Read-only queries against the real DB (checking current state, sampling a
feed) don't need this — the testbed exists for the write side specifically,
where a mistake is otherwise hard to undo.

### Isolated-script DB safety — never a blanket `source shared/.env` (2026-08-12 incident)

A verification script needed both the testbed DB and shared API keys
(`GOOGLE_*`, `ANTHROPIC_API_KEY`) in one run, and did the obvious-looking
thing: `source .env.testbed; source /var/www/shared/.env`. `shared/.env`
*also* defines `DATABASE_URL` and, sourced second, silently overwrote the
testbed one — the script then ran a real Drive sync against the live
**production** database instead of the disposable testbed copy. The result
happened to be harmless (draft rows, correct data), but the isolation
property held that day by luck, not by anything enforcing it. This is the
same root mistake the policy two sections up already warns against
("secrets stay out by policy... a deliberate decision to make explicitly,
not something a setup script copies in by default") — it just hadn't been
made hard to get wrong yet.

**Two enforced layers, not one more rule to remember:**

1. **`/opt/cvp-testbed/with-shared-secret.sh VAR1 [VAR2 ...] -- <command>`**
   — the only sanctioned way to add shared secrets to a testbed run. Sources
   `.env.testbed` *first*, then pulls **only the explicitly named
   variables** out of `shared/.env` — never a blanket source, and it refuses
   outright if `DATABASE_URL` is ever named. Structurally, nothing extracted
   this way can shadow the testbed's own `DATABASE_URL`, regardless of what
   order anyone writes the commands in.
   ```bash
   /opt/cvp-testbed/with-shared-secret.sh GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN ANTHROPIC_API_KEY \
     -- npx tsx scripts/some-verification.mts
   ```
2. **`scripts/assert-not-prod-db.mjs`** — a final guard, run automatically by
   the wrapper above (and importable directly — `import
   "../scripts/assert-not-prod-db.mjs"` — at the top of any ad-hoc write
   script) that refuses to proceed at all if `DATABASE_URL` matches the real
   prod DB/role, unless `CVP_ALLOW_PROD_DB=1` is set explicitly for a
   deliberate, disclosed, **read-only** query. Belt-and-suspenders: even if
   some future path still manages to leak a prod `DATABASE_URL` into an
   isolated run, this stops it before any query executes.

`with-shared-secret.sh` lives in `/opt/cvp-testbed/` itself (VPS-local
tooling, same as `refresh.sh`/`db-testbed-up.sh`/`db-testbed-down.sh` —
never rsynced from a release); `assert-not-prod-db.mjs` lives in this repo's
`scripts/` so it's version-controlled and travels with every checkout,
including the testbed's own `git clone`.

## Staging is not a write sandbox — shared DB (2026-07-27/28 incident)

While reviewing the sync-control-panel feature (read-only editor, Force-Sync,
manual/auto toggle) on staging before its production sign-off, one or more of
those buttons got clicked to actual completion, not just viewed — staging
shares the production database (see "Environments" above), so this flipped
real `DevelopmentUnit.source` values and triggered real feed syncs on real
projects. The next 4am cron then found several no-longer-manual projects and
did what it's designed to do: `deleteMany` + `createMany` their units from
the live feed. **Real curated data was destroyed** — `domenica/eniko-mare`
lost 17 of its 18 hand-entered units outright, replaced by the single unit
the live feed happens to still carry for that project. Three other projects
were flipped/synced with less severe (in one case, no measurable) actual
content loss, purely by chance — the feed's own data happened to closely
match what was there. Full recovery required a forensic before/after backup
diff and a manual restore of the lost rows; see the git history around
2026-07-28 for the investigation and fix.

**The rule this enforces: staging is for *looking*, not for *doing*.**
Reviewing a feature's UI on staging — does the banner show, does the modal
render, does a button appear where expected — is exactly what it's for.
Actually completing a write action there (confirming a destructive modal,
clicking a sync button through to the end, saving a form) is functionally
identical to doing it directly against production, because it *is*
production's data. Any destructive or data-mutating action needed to verify
a feature belongs in the isolated testbed (`/opt/cvp-testbed/`, see above)
against its disposable database — never on staging, no matter how
convenient the already-deployed UI is sitting there. When asking someone
(including a future instance of this assistant) to "check it on staging,"
say explicitly whether that means look-only or whether a specific action is
authorized to run for real — don't leave it implicit.

**Outstanding cleanup (as of 2026-07-28): a forensic snapshot database,
`cyprusvipestates_forensic_before`, is deliberately still sitting on the VPS**
(restored from the 2026-07-27 05:31 backup, `cvp_post-feedref-backfill_
20260727_053113.sql.gz` — the last clean state before this incident). Kept
as a safety net for a few more days while the four affected projects
(eniko-mare, celestia, agnades-village-1, trinity-residences) get checked
in normal day-to-day use, in case anything else from this window surfaces
later. Safe to `dropdb cyprusvipestates_forensic_before` (and drop role
`cvp_forensic`) once that's confirmed — don't let it linger indefinitely.
