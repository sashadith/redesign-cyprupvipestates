#!/usr/bin/env bash
# Deploy a CLEAN, COMMITTED git ref (default: main) to PRODUCTION → https://cyprusvipestates.com
#
# In active use since 2026-07-15. Intentionally stricter than deploy-staging.sh:
#
#       • deploys ONLY committed code from a git ref (never the dirty working tree),
#         so uncommitted / untracked WIP can never reach production;
#       • requires a typed confirmation (or --yes);
#       • verifies $DIR is actually the app it claims to be before ever running
#         a destructive rsync against it, and previews every deletion a real
#         run would make before it's allowed to proceed (see step 1.5) — this
#         is the guard the original incident below didn't have;
#       • DB migrations and `npm ci` are OPT-IN (they can affect shared state);
#       • runs a post-deploy health check.
#
# Incident this script's safety checks exist because of: an earlier ad-hoc
# (non-scripted) `rsync --delete` production deploy assumed $DIR held the same
# git history as the local working repo. It didn't — $DIR was tracked by a
# separate, diverged git repo — and the mismatch wiped files unique to it,
# including the entire public/uploads directory (2.7GB, ~21,523 files, no
# recent backup). Recovered from a stale tarball; anything uploaded after that
# tarball and before the incident was permanently lost. Never run a raw rsync
# --delete against $DIR outside this script.
#
# Usage:
#   ./scripts/deploy-prod.sh --dry-run              # preview the file sync, no changes
#   ./scripts/deploy-prod.sh                        # deploy `main` (prompts to confirm)
#   CVP_PROD_REF=main CVP_RUN_MIGRATE=1 ./scripts/deploy-prod.sh
#
# Requires VPS SSH access (key at ~/.ssh/cvp_vps, or set CVP_SSH_KEY).
set -euo pipefail

# ---- CONFIG — verify every line against your VPS before running -------------
KEY="${CVP_SSH_KEY:-$HOME/.ssh/cvp_vps}"
HOST="${CVP_PROD_HOST:-root@72.60.89.239}"
DIR="${CVP_PROD_DIR:-/var/www/cyprusvipestates}"   # TODO: confirm the LIVE app dir
APP="${CVP_PROD_APP:-cyprusvipestates}"            # TODO: confirm the LIVE pm2 app name
REF="${CVP_PROD_REF:-main}"                         # committed ref to deploy
RUN_INSTALL="${CVP_RUN_INSTALL:-0}"                 # 1 = npm ci (only if deps changed)
RUN_MIGRATE="${CVP_RUN_MIGRATE:-0}"                 # 1 = npx prisma migrate deploy
HEALTH_URL="${CVP_HEALTH_URL:-https://cyprusvipestates.com/projects}"
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

echo "──────────────────────────────────────────────"
echo " PRODUCTION DEPLOY"
echo "   ref:      $REF ($REF_SHA)"
echo "   host:     $HOST"
echo "   dir:      $DIR"
echo "   pm2 app:  $APP"
echo "   npm ci:   $([ "$RUN_INSTALL" = 1 ] && echo yes || echo 'no (reuse node_modules)')"
echo "   migrate:  $([ "$RUN_MIGRATE" = 1 ] && echo 'yes (prisma migrate deploy)' || echo no)"
[ "$DRY" = 1 ] && echo "   MODE:     DRY RUN (no changes will be made)"
echo "──────────────────────────────────────────────"

if [ "$ASSUME_YES" != 1 ] && [ "$DRY" != 1 ]; then
  read -r -p "Type 'deploy-prod' to proceed: " ans
  [ "$ans" = "deploy-prod" ] || { echo "aborted."; exit 1; }
fi

# 1) Export a CLEAN tree of the ref (committed files only — no untracked WIP).
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
echo "→ exporting clean $REF → $STAGE"
git archive "$REF" | tar -x -C "$STAGE"

# 1.5) Identity + blast-radius check — the guard the original incident (see
#      header) didn't have. Two parts:
#        a) $DIR must actually be THIS app, not some other directory that
#           happens to be configured here by mistake.
#        b) preview every deletion a real (non-dry-run) rsync would make,
#           and require a SEPARATE typed confirmation if it would delete
#           anything — the initial "type deploy-prod" above happens before
#           we know what would be destroyed, so it can't cover this.
echo "→ verifying $HOST:$DIR is the expected app"
remote_name="$(ssh -i "$KEY" "$HOST" "node -pe \"require('$DIR/package.json').name\" 2>/dev/null" || echo "")"
if [ "$remote_name" != "cyprusvipestates" ]; then
  echo "✗ $HOST:$DIR/package.json name is '$remote_name', expected 'cyprusvipestates'."
  echo "  Refusing to run a destructive rsync against a directory that doesn't identify as this app."
  exit 1
fi
echo "   ✓ $DIR identifies as cyprusvipestates"

echo "→ previewing deletions (dry run) before any real sync"
preview_opts=(-rlptDz --delete --dry-run -v
  --exclude node_modules --exclude .next --exclude .git --exclude .local-db
  --exclude '.env' --exclude '.env.local' --exclude 'scripts/images' --exclude 'public/uploads')
deletions="$(rsync "${preview_opts[@]}" -e "ssh -i $KEY" "$STAGE/" "$HOST:$DIR/" 2>&1 | grep '^deleting ' || true)"
if [ -n "$deletions" ]; then
  echo "⚠️  This deploy would DELETE the following on $HOST:$DIR (not in $REF):"
  echo "$deletions" | sed 's/^/     /'
  if [ "$DRY" != 1 ] && [ "$ASSUME_YES" != 1 ]; then
    read -r -p "Type 'delete these files' to proceed anyway, or Ctrl-C to abort: " del_ans
    [ "$del_ans" = "delete these files" ] || { echo "aborted — nothing was changed."; exit 1; }
  fi
else
  echo "   ✓ no deletions — this sync is purely additive/updating"
fi

# 2) Sync to the live app dir. Same excludes as staging so we never clobber the
#    server's node_modules, build cache, env, or the symlinked media dir.
#
#    Deliberately NOT `-a` (archive = -rlptgoD): the `-o`/`-g` (owner/group)
#    bits make rsync preserve the SOURCE files' numeric UID/GID — and since
#    $STAGE is a local mktemp dir, that's whatever local-machine user exported
#    it (e.g. macOS's default first-user uid 501:staff), not a real user on
#    the VPS. Running as root, rsync happily applies that foreign uid/gid to
#    the remote tree, which once locked $DIR itself to 700 owned by 501:staff
#    — invisible to `curl` (the app still serves HTML fine) but it makes every
#    /_next/static/* and /uploads/* asset 403 for nginx's www-data worker,
#    since traversal into $DIR is denied before nginx ever reaches the file.
#    Omitting -o/-g leaves synced files owned by whoever rsync runs as on the
#    remote (root here) — always correct. Belt-and-suspenders: step 3 also
#    force-fixes $DIR's own ownership/permissions before every build.
RSYNC_OPTS=(-rlptDz --delete
  --exclude node_modules --exclude .next --exclude .git --exclude .local-db
  --exclude '.env' --exclude '.env.local' --exclude 'scripts/images' --exclude 'public/uploads')
[ "$DRY" = 1 ] && RSYNC_OPTS+=(--dry-run -v)

echo "→ rsync clean $REF tree to $HOST:$DIR"
rsync "${RSYNC_OPTS[@]}" -e "ssh -i $KEY" "$STAGE/" "$HOST:$DIR/"

if [ "$DRY" = 1 ]; then
  echo "✓ dry run complete — no build, migrate, or reload performed."
  exit 0
fi

# 3) Build + (optional) install/migrate + reload on the VPS.
echo "→ build + reload on the VPS"
ssh -i "$KEY" "$HOST" bash -s <<REMOTE
set -euo pipefail
# Force-correct $DIR's own ownership/permissions before every build, regardless
# of what rsync just did — see the RSYNC_OPTS comment above for the incident
# this guards against. Cheap (one dir, not recursive) and idempotent.
chown root:root "$DIR"
chmod 755 "$DIR"
cd "$DIR"
$([ "$RUN_INSTALL" = 1 ] && echo 'npm ci' || echo 'echo "· skip npm ci (reusing existing node_modules)"')
$([ "$RUN_MIGRATE" = 1 ] && echo 'npx prisma migrate deploy' || echo 'echo "· skip prisma migrate"')
NODE_OPTIONS=--max_old_space_size=2048 npm run build
pm2 reload "$APP" --update-env
REMOTE

# 4) Health check. Checks the HTML document AND one of its own referenced
#    /_next/static/ assets — the document alone isn't enough (it's server-
#    rendered by the Node app directly and will happily 200 even when nginx
#    is 403-ing every static asset, exactly what happened in the incident
#    this comment documents — see the RSYNC_OPTS comment above).
if command -v curl >/dev/null 2>&1; then
  echo "→ health check $HEALTH_URL"
  html="$(curl -s -w '\n%{http_code}' "$HEALTH_URL" || echo $'\n000')"
  code="$(echo "$html" | tail -1)"
  echo "   HTTP $code"
  [ "$code" = 200 ] || { echo "⚠️  non-200 on the page itself — verify manually, consider rollback (pm2 logs $APP)."; exit 1; }

  asset="$(echo "$html" | grep -oE '/_next/static/[^"'"'"']+\.(js|css)' | head -1)"
  if [ -n "$asset" ]; then
    origin="$(echo "$HEALTH_URL" | grep -oE '^https?://[^/]+')"
    asset_code="$(curl -s -o /dev/null -w '%{http_code}' "$origin$asset" || echo 000)"
    echo "   static asset check ($asset): HTTP $asset_code"
    [ "$asset_code" = 200 ] || { echo "⚠️  static asset 403/404 — the page looks fine but its JS/CSS won't load for real visitors. Check $DIR ownership/permissions (pm2 logs $APP)."; exit 1; }
  else
    echo "   ⚠️  couldn't find a /_next/static/ asset reference in the page to check — skipping (not fatal)."
  fi
fi

echo "✓ Production updated → https://cyprusvipestates.com  (ref $REF @ $REF_SHA)"
