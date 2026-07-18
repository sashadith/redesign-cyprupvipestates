# Deployment — Cyprus VIP Estates

Two environments, one shared production database, two separate PM2 apps,
two separate deploy scripts. This document covers both, plus the safety
mechanisms (`verify-runtime-assets.sh`) and rollback procedures that came out
of the 2026-07 staging→production merge.

## Environments

| | Staging | Production |
|---|---|---|
| URL | https://design.cyprusvipestates.com | https://cyprusvipestates.com |
| PM2 app | `cve-staging` (fork mode) | `cyprusvipestates` (cluster, 2 instances) |
| Port | 3200 | 3000 |
| App dir | `/var/www/cve-staging` | `/var/www/cyprusvipestates` |
| Deploy script | `scripts/deploy-staging.sh` | `scripts/deploy-prod.sh` |
| Indexing | `X-Robots-Tag: noindex, nofollow` (nginx, domain-wide) + `robots.txt: Disallow: /` | Indexed normally; per-page `<meta robots>` control only |
| Access | Public, no Basic Auth (removed 2026-07-01 on request) | Public |
| Database | Same shared Postgres DB as production (read-mostly use) | `cyprusvipestates` on `localhost:5432` |
| `public/uploads` | Symlink → `/var/www/shared-uploads` | Symlink → `/var/www/shared-uploads` |

Both apps point `public/uploads` at the same physical directory
(`/var/www/shared-uploads`, introduced during the Phase 3 retry — see
"Lessons learned" below). There is no upload isolation between the two
environments: deleting or overwriting an upload on one destroys it on both.

Staging uses the **production database** so it renders real content. Lead
delivery is disabled there (`MONDAY_API_KEY`/`TELEGRAM_BOT_TOKEN` blanked in
its `.env`) so form tests never reach the real CRM.

## Deploy scripts

### `scripts/deploy-staging.sh`

Syncs the **current local working tree** (uncommitted WIP included, by
design — see the script's own comment on why `--delete` was removed) to
`cve-staging`, then does a clean `rm -rf .next && npm run build` with a
capped `DATABASE_URL`, runs the `verify-runtime-assets.sh` gate, and reloads.

```bash
git checkout redesign/home && git pull --ff-only
./scripts/deploy-staging.sh
```

There's also a GitHub Actions workflow (`.github/workflows/deploy-staging.yml`)
that auto-deploys `redesign/home` on push — it checks out the **committed**
tree only, so it can diverge from what the script just synced if you have
uncommitted changes locally. Don't rely on both at once for the same change.

### `scripts/deploy-prod.sh`

Deploys a clean, **committed git ref** (default `main`) to production —
never the working tree. Requires a typed confirmation (or `--yes`), verifies
the target directory actually is the production app before touching it,
previews every file an update would delete, and runs a post-deploy health
check against the homepage and one of its own static assets.

```bash
./scripts/deploy-prod.sh --dry-run          # preview only, no changes
./scripts/deploy-prod.sh                    # deploy `main`, prompts to confirm
CVP_PROD_REF=main CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh   # opt-in DB migration
```

`npm ci` and `prisma migrate deploy` are both opt-in (`CVP_RUN_INSTALL=1`,
`CVP_RUN_MIGRATE=1`) since they touch shared state — leave them off for a
pure code deploy.

Both scripts require VPS SSH access (`~/.ssh/cvp_vps`, or `CVP_SSH_KEY`), and
both cap the build-time `DATABASE_URL` with `connection_limit=5&pool_timeout=30`
— `next build`'s static-generation phase spawns one worker per available CPU,
and building on a higher-core machine than the VPS can otherwise stack more
connections than Postgres's `max_connections` allows. Only the one-off build
invocation is capped; the real `.env` on disk, and pm2's serving processes,
are never touched.

## Post-deploy smoke test

After every production deploy, check:

- Homepage (`/`) — 200
- One project detail page (`/projects/<slug>`) — 200
- One `/c/<token>` client-presentation link — 200
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

### Routine rollback (regular `deploy-prod.sh` use)

Every production deploy is a named, committed git ref — rollback is
redeploying the previous good ref:

```bash
CVP_PROD_REF=<previous-good-sha-or-tag> ./scripts/deploy-prod.sh
```

No directory surgery needed; the script's own safety checks (identity
verification, deletion preview) apply exactly the same as a forward deploy.

### Full-tree atomic swap (historic — used only for the 2026-07-16 repo cutover)

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
| `0 5 * * *` | `action-digest` (Action Center Telegram digest) | production, `?key=$CRON_SECRET` — **not yet installed, see note below** |

VPS system clock is UTC (confirmed: `Development.syncedAt` rows written by
`feed-sync`'s `0 4 * * *` entry land at `04:00:xx.xxxZ`) — crontab times above
are plain UTC, not Cyprus-local. `action-digest` is specified as "daily 08:00
Cyprus time"; Cyprus is EEST (UTC+3) in summer, so `0 5 * * *` UTC = 08:00
Cyprus — **this entry has not been added to the production crontab yet**
(a live infra change, done separately from this code change). Note it'll need
revisiting to `0 6 * * *` when Cyprus switches to EET (UTC+2) in winter, since
the VPS crontab has no timezone awareness of its own.

Staging's own `drive-sync`/`feed-sync` entries (previously hitting
`127.0.0.1:3200`) were **disabled** (commented out, not deleted) in the
crontab on 2026-07-16 once production took over both jobs post-cutover —
kept in place, commented, for the record.

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
