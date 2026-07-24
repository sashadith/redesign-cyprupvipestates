#!/usr/bin/env bash
# Deploy a CLEAN, COMMITTED git ref (default: main) to PRODUCTION → https://cyprusvipestates.com
#
# In active use since 2026-07-15; rewritten 2026-07-24 to a release-directory +
# symlink-swap model. The previous version built `npm run build` IN PLACE
# inside the live app directory while the 2 pm2 cluster instances kept serving
# out of that same directory — Next.js deletes and rewrites chunks/manifests
# mid-build, so the site was effectively broken for the entire build window
# (240–340s, measured). This version builds in an isolated release directory;
# the live path only ever changes via one atomic symlink swap once the new
# build is fully verified. The site is never touched during the build itself.
#
#       • deploys ONLY committed code from a git ref (never the dirty working tree);
#       • requires a typed confirmation (or --yes);
#       • verifies $DIR (the current live symlink) resolves to the expected app
#         before ever touching anything;
#       • DB migrations and `npm ci` are OPT-IN (they can affect shared state);
#       • runs a post-deploy health check AND a pm2-cwd sanity check.
#
# Release layout (migrated 2026-07-24 — see DEPLOYMENT.md):
#   /var/www/releases/cve-<UTC-timestamp>/   one directory per deploy
#   /var/www/cyprusvipestates                symlink -> current release (name unchanged —
#                                             nginx, crontab, ecosystem.config.js all still
#                                             reference this exact path, untouched)
#   /var/www/shared/.env                     real file, symlinked into every release
#   /var/www/shared/secrets/                 real dir,  symlinked into every release
#   /var/www/shared-uploads/                 real dir,  symlinked into every release's public/uploads
#   /var/www/deploy-logs/                    .deploy-status / .deploy-build.log — NOT part of any release
#
# Rollback (under 5 seconds, DB untouched — schema is additive-only):
#   ln -sfn /var/www/releases/cve-<previous-good-timestamp> /var/www/cyprusvipestates.new
#   mv -T /var/www/cyprusvipestates.new /var/www/cyprusvipestates
#   pm2 reload cyprusvipestates --update-env
#
# Incident this script's identity-check exists because of: an earlier ad-hoc
# (non-scripted) `rsync --delete` production deploy assumed the live dir held
# the same git history as the local working repo. It didn't, and the mismatch
# wiped files unique to it, including the entire public/uploads directory
# (2.7GB, ~21,523 files, no recent backup) — recovered from a stale tarball.
# That risk no longer applies to the main rsync (every deploy now rsyncs into
# a brand-new, empty release directory, never into a live one), but the
# identity check is kept as a sanity guard before doing anything at all.
#
# Usage:
#   ./scripts/deploy-prod.sh --dry-run              # preview only, no changes
#   ./scripts/deploy-prod.sh                        # deploy `main` (prompts to confirm)
#   CVP_PROD_REF=main CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh
#
# Requires VPS SSH access (key at ~/.ssh/cvp_vps, or set CVP_SSH_KEY).
set -euo pipefail

# ---- CONFIG — verify every line against your VPS before running -------------
KEY="${CVP_SSH_KEY:-$HOME/.ssh/cvp_vps}"
HOST="${CVP_PROD_HOST:-root@72.60.89.239}"
DIR="${CVP_PROD_DIR:-/var/www/cyprusvipestates}"   # stable symlink name — never a release path directly
APP="${CVP_PROD_APP:-cyprusvipestates}"            # TODO: confirm the LIVE pm2 app name
REF="${CVP_PROD_REF:-main}"                         # committed ref to deploy
RUN_INSTALL="${CVP_RUN_INSTALL:-0}"                 # 1 = npm ci --legacy-peer-deps on top of the
                                                     # copied-forward node_modules (only if deps changed;
                                                     # flag required repo-wide, see README — legacy Sanity
                                                     # peer conflicts. Missed once on 2026-07-23 deploying
                                                     # sanitize-html — build failed with "Module not found",
                                                     # caught before any reload happened.)
RUN_MIGRATE="${CVP_RUN_MIGRATE:-0}"                 # 1 = npx prisma migrate deploy
HEALTH_URL="${CVP_HEALTH_URL:-https://cyprusvipestates.com/projects}"
KEEP_RELEASES="${CVP_KEEP_RELEASES:-3}"             # releases kept on top of whichever is currently live
# ----------------------------------------------------------------------------

DRY=0; ASSUME_YES=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --yes)     ASSUME_YES=1 ;;
    *) echo "unknown flag: $a"; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# The ref must exist and be an ancestor of its pushed remote (i.e. already on origin),
# so we never ship a local-only commit no one has reviewed.
git rev-parse --verify "$REF" >/dev/null 2>&1 || { echo "✗ unknown git ref: $REF"; exit 1; }
if ! git merge-base --is-ancestor "$REF" "origin/$REF" 2>/dev/null; then
  echo "⚠️  $REF is not fully pushed to origin/$REF — push & get it reviewed first."
  [ "$ASSUME_YES" = 1 ] || { echo "aborting (use --yes to override)"; exit 1; }
fi
REF_SHA="$(git rev-parse --short "$REF")"

# Release directory name — computed once, locally, used throughout this run.
RELEASE_TS="$(date -u +%Y%m%d%H%M%S)"
RELEASE="/var/www/releases/cve-${RELEASE_TS}"

echo "──────────────────────────────────────────────"
echo " PRODUCTION DEPLOY"
echo "   ref:      $REF ($REF_SHA)"
echo "   host:     $HOST"
echo "   live:     $DIR (symlink)"
echo "   release:  $RELEASE"
echo "   pm2 app:  $APP"
echo "   npm ci:   $([ "$RUN_INSTALL" = 1 ] && echo 'yes (on top of copied node_modules)' || echo 'no (cp -a forward, reuse as-is)')"
echo "   migrate:  $([ "$RUN_MIGRATE" = 1 ] && echo 'yes (prisma migrate deploy)' || echo no)"
[ "$DRY" = 1 ] && echo "   MODE:     DRY RUN (no changes will be made)"
echo "──────────────────────────────────────────────"

if [ "$ASSUME_YES" != 1 ] && [ "$DRY" != 1 ]; then
  read -r -p "Type 'deploy-prod' to proceed: " ans
  [ "$ans" = "deploy-prod" ] || { echo "aborted."; exit 1; }
fi

# 1) Export a CLEAN tree of the ref (committed files only — no untracked WIP).
#    chmod the STAGE dir itself to 755: `mktemp -d` defaults to 700, and
#    rsync's -p (preserve permissions, below) copies THIS directory's mode
#    onto $RELEASE — a 700 $STAGE silently re-700's $RELEASE even after we
#    explicitly chmod it, exactly what broke the 2026-07-24 deploy attempt.
STAGE="$(mktemp -d)"; chmod 755 "$STAGE"; trap 'rm -rf "$STAGE"' EXIT
echo "→ exporting clean $REF → $STAGE"
git archive "$REF" | tar -x -C "$STAGE"

# 1.5) Identity check — $DIR (the live symlink) must resolve to THIS app before
#      we touch anything. No deletion-preview needed anymore: every deploy now
#      rsyncs into a brand-new, empty release directory, never into a live one.
echo "→ verifying $HOST:$DIR is the expected app"
remote_name="$(ssh -i "$KEY" "$HOST" "node -pe \"require('$DIR/package.json').name\" 2>/dev/null" || echo "")"
if [ "$remote_name" != "cyprusvipestates" ]; then
  echo "✗ $HOST:$DIR/package.json name is '$remote_name', expected 'cyprusvipestates'."
  echo "  Refusing to proceed against a symlink that doesn't identify as this app."
  exit 1
fi
echo "   ✓ $DIR identifies as cyprusvipestates"

# 2) Create the new release directory and sync the clean tree into it.
#    Plain, additive rsync — the target is always freshly created and empty,
#    so --delete (and its old deletion-preview/confirmation dance) no longer
#    applies. Same excludes as before for the pieces that live outside the
#    release lifecycle (node_modules/.next handled separately below; .env/
#    secrets/uploads are shared-state symlinks, never rsynced content).
RSYNC_OPTS=(-rlptDz
  --exclude node_modules --exclude .next --exclude .git --exclude .local-db
  --exclude '.env' --exclude '.env.local' --exclude 'scripts/images' --exclude 'public/uploads' --exclude secrets)
[ "$DRY" = 1 ] && RSYNC_OPTS+=(--dry-run -v)

echo "→ creating release dir + rsyncing clean $REF tree"
# Belt-and-suspenders on top of the remote script's own `umask 022`: a
# non-interactive SSH session's default umask isn't guaranteed (observed
# 2026-07-24 landing at 077 here, producing drwx------ and 403-ing every
# static asset for nginx's www-data worker even though the build itself
# succeeded and every root-run check passed). Fix the bit explicitly too,
# don't just rely on umask having been inherited correctly.
ssh -i "$KEY" "$HOST" "mkdir -p '$RELEASE' && chmod 755 '$RELEASE'"
rsync "${RSYNC_OPTS[@]}" -e "ssh -i $KEY" "$STAGE/" "$HOST:$RELEASE/"
# `-p` above (preserve permissions) copies $STAGE's own mode onto $RELEASE —
# even with $STAGE now chmod'd to 755, re-assert $RELEASE's permissions here
# too. Two independent layers (source-side + post-sync) since one alone
# (either the earlier chmod above, or relying on $STAGE being 755) already
# proved insufficient once: the 2026-07-24 retry deploy re-broke this via
# rsync -p overwriting the pre-rsync chmod with $STAGE's then-700 mode.
ssh -i "$KEY" "$HOST" "chmod 755 '$RELEASE'"

if [ "$DRY" = 1 ]; then
  echo "✓ dry run complete — no build, migrate, or reload performed."
  ssh -i "$KEY" "$HOST" "rmdir '$RELEASE' 2>/dev/null" || true
  exit 0
fi

# 3) Build + (optional) install/migrate + swap + reload on the VPS.
#
#    Same backgrounded + polled pattern as before (see git history for the
#    2026-07-18 incident writeup this pattern exists because of) — a single
#    blocking ssh call was once observed reporting success while the remote
#    build was still actively running. Launch in the background, poll a
#    written exit-status file, THEN confirm pm2 actually replaced every
#    instance and the new instances are serving from the new release, THEN
#    health-check — never trust one blocking call's own completion signal for
#    a multi-minute build.
echo "→ starting build + swap + reload on the VPS (backgrounded, polled — this can take several minutes)"

BEFORE_PIDS="$(ssh -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$HOST" "pm2 pid '$APP'" 2>/dev/null || true)"

mkdir -p "$STAGE/.deploy" # local scratch only, for the heredoc file below
REMOTE_SCRIPT="$STAGE/.deploy/run.sh"
cat > "$REMOTE_SCRIPT" <<REMOTE
#!/usr/bin/env bash
set -euo pipefail
# A non-interactive SSH session's default umask isn't guaranteed — observed
# landing at 077 here (2026-07-24), silently producing drwx------ dirs that
# built and passed every root-run check but 403'd every static asset for
# nginx's www-data worker. Force a sane umask for everything this script
# creates, on top of the explicit chmod 755 the outer script now also does
# right after mkdir (belt-and-suspenders, not either/or).
umask 022
mkdir -p /var/www/deploy-logs
trap 'echo \$? > /var/www/deploy-logs/.deploy-status' EXIT

RELEASE="$RELEASE"
DIR="$DIR"
SHARED="/var/www/shared"
SHARED_UPLOADS="/var/www/shared-uploads"

# The release the currently-serving processes are ACTUALLY running from
# (resolve the live symlink now, before we touch anything) — this is what we
# copy node_modules/.next/cache forward from, not just "whatever \$DIR says"
# in case that ever changes mid-run (it never does in this single-flight
# script, but this is the explicitly-correct source regardless).
CURRENT_REAL="\$(readlink -f "\$DIR")"
echo "· current live release: \$CURRENT_REAL"

echo "· copying node_modules forward (~seconds, local disk)"
cp -a "\$CURRENT_REAL/node_modules" "\$RELEASE/node_modules"

if [ -d "\$CURRENT_REAL/.next/cache" ]; then
  echo "· copying .next/cache forward (preserves incremental build cache)"
  mkdir -p "\$RELEASE/.next"
  cp -a "\$CURRENT_REAL/.next/cache" "\$RELEASE/.next/cache"
fi

# .env / secrets — real files live outside the release lifecycle entirely,
# symlinked into every release. Idempotent: safe to re-run.
ln -sfn "\$SHARED/.env"    "\$RELEASE/.env"
ln -sfn "\$SHARED/secrets" "\$RELEASE/secrets"

# public/uploads must be a symlink to the persistent, outside-the-release
# share (holds mirrored feed/Drive images and signature images) — same
# idempotent check as before, now applied to the new release. Never rm -rf a
# real directory here: if public/uploads somehow exists as an actual
# directory with content, that's a signal something upstream broke — fail
# loud instead of silently discarding data.
mkdir -p "\$SHARED_UPLOADS"
if [ -L "\$RELEASE/public/uploads" ] && [ "\$(readlink -f "\$RELEASE/public/uploads")" = "\$(readlink -f "\$SHARED_UPLOADS")" ]; then
  echo "· public/uploads symlink OK -> \$SHARED_UPLOADS"
elif [ -e "\$RELEASE/public/uploads" ] && [ ! -L "\$RELEASE/public/uploads" ]; then
  echo "✗ \$RELEASE/public/uploads exists as a REAL directory/file, not a symlink — refusing to touch it (would risk data loss). Investigate manually."
  exit 1
else
  echo "⚠️  public/uploads symlink missing/incorrect — (re)creating -> \$SHARED_UPLOADS"
  ln -sfn "\$SHARED_UPLOADS" "\$RELEASE/public/uploads"
fi

cd "\$RELEASE"
$([ "$RUN_INSTALL" = 1 ] && echo 'npm ci --legacy-peer-deps' || echo 'echo "· skip npm ci (reusing copied-forward node_modules)"')
$([ "$RUN_MIGRATE" = 1 ] && echo 'npx prisma migrate deploy' || echo 'echo "· skip prisma migrate"')

# Always regenerate the Prisma Client, unconditionally — schema.prisma is
# rsynced above regardless of RUN_INSTALL, but node_modules is copied
# forward from the OLD release, so a schema change without npm ci leaves the
# OLD generated client in place otherwise. Cheap and idempotent; never skip.
npx prisma generate

# Build-time-only connection cap — same reasoning as before: next build's
# static-generation phase spawns one worker per CPU, each opening its own
# Prisma pool; capped here at the build step only, the real .env is never
# modified so pm2's serving processes keep their normal pool sizing.
DB_URL_LINE="\$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
DB_URL_LINE="\${DB_URL_LINE%\\"}"
DB_URL_LINE="\${DB_URL_LINE#\\"}"
BUILD_DB_URL="\${DB_URL_LINE}&connection_limit=5&pool_timeout=30"

# nice/ionice: this now runs entirely OUTSIDE the live path, so it's no
# longer safety-critical the way the in-place build was — but the 2 live
# instances still share these 2 CPUs with the build, so keep them favored.
echo "· building (nice -n 19, ionice idle class)"
nice -n 19 ionice -c3 env DATABASE_URL="\$BUILD_DB_URL" NODE_OPTIONS=--max_old_space_size=5120 npm run build

# Gate 1: BUILD_ID must exist. Simpler than the old in-place check (no
# prev-vs-new comparison needed — \$RELEASE is always freshly created, so
# there's no ambiguity: either a real build just wrote a fresh BUILD_ID, or
# it didn't).
if [ ! -s "\$RELEASE/.next/BUILD_ID" ]; then
  echo "BUILD FAILED: \$RELEASE/.next/BUILD_ID missing or empty after npm run build — aborting before swap"
  exit 1
fi
echo "✓ BUILD_ID present: \$(cat "\$RELEASE/.next/BUILD_ID")"

# Gate 2: every known runtime-only asset (files read via fs at request time,
# invisible to the build above) must exist in \$RELEASE BEFORE the swap makes
# it live. Script already takes an explicit target path — no changes needed.
bash "\$RELEASE/scripts/verify-runtime-assets.sh" "\$RELEASE"

# Gate 3: nginx (www-data) must actually be able to traverse the full
# directory chain and read a real static asset — added 2026-07-24 after
# exactly this failed silently: Gates 1+2 above both passed (root can read
# everything it owns), the swap happened, and only then did every
# /_next/static/* and /uploads/* request 403 for real visitors. Runs BEFORE
# the swap so a failure here never touches the live site — the old release
# keeps serving, this one just doesn't go live.
bash "\$RELEASE/scripts/verify-www-data-access.sh" "\$RELEASE"

# --- Only now, with a fully verified release, does the live site change. ---
echo "· swapping symlink -> \$RELEASE"
ln -sfn "\$RELEASE" "\$DIR.new"
mv -T "\$DIR.new" "\$DIR"

pm2 reload "$APP" --update-env

# pm2-cwd verification: pm2 reload spawns fresh worker processes, and each
# resolves the \$DIR symlink again at its own startup — but this is a "should
# work" mechanism, not a certainty, so verify it directly rather than assume
# it. If this ever fails, the symlink IS already pointing at the new release
# — only pm2 hasn't picked it up.
sleep 2
NEW_PID="\$(pm2 pid '$APP' 2>/dev/null | head -1 | tr -d '[:space:]')"
if [ -z "\$NEW_PID" ]; then
  echo "✗ pm2 reports no pid for $APP after reload — cannot verify cwd."
  exit 1
fi
ACTUAL_CWD="\$(readlink -f "/proc/\$NEW_PID/cwd" 2>/dev/null || echo "")"
if [ "\$ACTUAL_CWD" != "\$RELEASE" ]; then
  echo "✗ pm2 cwd verification FAILED — running process is not serving from \$RELEASE."
  echo "  Actual cwd: \${ACTUAL_CWD:-<unreadable>}"
  echo "  Symlink IST bereits umgehängt, pm2 hat es nur nicht übernommen."
  echo "  Reparatur (kurze ECHTE Downtime, Prozess wird neu registriert):"
  echo "    pm2 delete $APP && pm2 start ecosystem.config.js --only $APP && pm2 save"
  echo "  Danach manuell prüfen: curl -I $HEALTH_URL"
  exit 1
fi
echo "✓ pm2 cwd verified: \$NEW_PID -> \$ACTUAL_CWD"

# Release cleanup: keep the newest $KEEP_RELEASES + whatever is currently
# live (covers the case of a manual rollback to an older release sitting
# outside the newest-N window).
echo "· cleaning up old releases (keeping newest $KEEP_RELEASES + the live one)"
LIVE_REAL="\$(readlink -f "\$DIR")"
KEEP_LIST="\$(ls -1dt /var/www/releases/cve-* 2>/dev/null | head -n "$KEEP_RELEASES")"
for d in /var/www/releases/cve-*; do
  [ -d "\$d" ] || continue
  if [ "\$d" = "\$LIVE_REAL" ]; then continue; fi
  echo "\$KEEP_LIST" | grep -qxF "\$d" && continue
  echo "  removing old release: \$d"
  rm -rf "\$d"
done
REMOTE

scp -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 -r "$STAGE/.deploy" "$HOST:/tmp/.cvp-deploy-$RELEASE_TS" >/dev/null
ssh -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$HOST" \
  "mkdir -p /var/www/deploy-logs && rm -f /var/www/deploy-logs/.deploy-status /var/www/deploy-logs/.deploy-build.log && chmod +x '/tmp/.cvp-deploy-$RELEASE_TS/run.sh' && (nohup '/tmp/.cvp-deploy-$RELEASE_TS/run.sh' >/var/www/deploy-logs/.deploy-build.log 2>&1 &) && echo launched"

# Poll for the status file the script's trap writes on exit (success or
# failure alike) — this ssh call returning does NOT mean the build is done,
# only that launching it succeeded.
POLL_INTERVAL=10
MAX_WAIT=1200   # 20 minutes — generous headroom over the ~3-5 min observed build time
elapsed=0
status=""
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  status="$(ssh -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$HOST" "cat /var/www/deploy-logs/.deploy-status 2>/dev/null" || true)"
  [ -n "$status" ] && break
  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
  echo "   ...still building (${elapsed}s elapsed)"
done

if [ -z "$status" ]; then
  echo "✗ timed out after ${MAX_WAIT}s waiting for the remote build to finish. Log tail:"
  ssh -i "$KEY" "$HOST" "tail -n 60 /var/www/deploy-logs/.deploy-build.log 2>/dev/null" | sed 's/^/     /'
  exit 1
fi
if [ "$status" != "0" ]; then
  echo "✗ remote build/deploy FAILED (exit $status). Log tail:"
  ssh -i "$KEY" "$HOST" "tail -n 60 /var/www/deploy-logs/.deploy-build.log 2>/dev/null" | sed 's/^/     /'
  echo "  (the live symlink was only ever changed AFTER both build gates passed — if this"
  echo "   failure is from before the swap step in the log above, production was never touched.)"
  exit 1
fi
echo "   ✓ remote build + gates + swap + pm2 reload + cwd verification reported success (exit 0)"

echo "→ confirming pm2 replaced every instance"
AFTER_PIDS="$(ssh -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$HOST" "pm2 pid '$APP'" 2>/dev/null || true)"
if [ -z "$AFTER_PIDS" ]; then
  echo "✗ pm2 reports no pids for $APP after reload — check pm2 status/logs on the VPS."
  exit 1
fi
stale="$(comm -12 <(printf '%s\n' "$BEFORE_PIDS" | sort) <(printf '%s\n' "$AFTER_PIDS" | sort) 2>/dev/null || true)"
if [ -n "$stale" ]; then
  echo "✗ instance(s) with pid(s) [$stale] still have their PRE-deploy pid — not every instance was replaced."
  exit 1
fi
echo "   ✓ every instance replaced (before: $(printf '%s ' $BEFORE_PIDS) → after: $(printf '%s ' $AFTER_PIDS))"

# 4) Health check. Checks the HTML document AND one of its own referenced
#    /_next/static/ assets — the document alone isn't enough (it's server-
#    rendered by the Node app directly and will happily 200 even when nginx
#    is 403-ing every static asset).
if command -v curl >/dev/null 2>&1; then
  echo "→ health check $HEALTH_URL"
  html="$(curl -s -w '\n%{http_code}' "$HEALTH_URL" || echo $'\n000')"
  code="$(echo "$html" | tail -1)"
  echo "   HTTP $code"
  [ "$code" = 200 ] || { echo "⚠️  non-200 on the page itself — verify manually (pm2 logs $APP)."; exit 1; }

  asset="$(echo "$html" | grep -oE '/_next/static/[^"'"'"']+\.(js|css)' | head -1)"
  if [ -n "$asset" ]; then
    origin="$(echo "$HEALTH_URL" | grep -oE '^https?://[^/]+')"
    asset_code="$(curl -s -o /dev/null -w '%{http_code}' "$origin$asset" || echo 000)"
    echo "   static asset check ($asset): HTTP $asset_code"
    [ "$asset_code" = 200 ] || { echo "⚠️  static asset 403/404 — the page looks fine but its JS/CSS won't load for real visitors. Check ownership/permissions (pm2 logs $APP)."; exit 1; }
  else
    echo "   ⚠️  couldn't find a /_next/static/ asset reference in the page to check — skipping (not fatal)."
  fi
fi

ssh -i "$KEY" "$HOST" "rm -rf '/tmp/.cvp-deploy-$RELEASE_TS'" 2>/dev/null || true

echo "✓ Production updated → https://cyprusvipestates.com  (ref $REF @ $REF_SHA, release cve-$RELEASE_TS)"
