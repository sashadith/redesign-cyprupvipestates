#!/usr/bin/env bash
# Deploy the CURRENT local checkout to staging → https://design.cyprusvipestates.com
#
# Usage (after getting the latest code on whatever feature branch you're testing):
#   git checkout <your-feature-branch> && git pull --ff-only
#   ./scripts/deploy-staging.sh
#
# Requires VPS SSH access (key at ~/.ssh/cvp_vps, or set CVP_SSH_KEY).
# Never touches the live `cyprusvipestates` app — only the `cve-staging` app on :3200.
set -euo pipefail

KEY="${CVP_SSH_KEY:-$HOME/.ssh/cvp_vps}"
HOST="root@72.60.89.239"
DIR="/var/www/cve-staging"

# Resolve the repo root from THIS script's location, never the caller's CWD —
# rsync --delete with a stray relative source once wiped staging. Absolute only.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Deliberately NO --delete. This syncs the LOCAL WORKING TREE (uncommitted WIP
# included, by design), and the deploy-staging.yml auto-CI syncs whatever's
# currently pushed — those two can run at different times from different
# source states. --delete here once let the CI's narrower (committed-only)
# checkout silently wipe uncommitted admin-panel work that only this script
# had ever synced. Additive-only sync means a deploy can never destroy work,
# only leave stale renamed/deleted files behind until manually cleaned up.
echo "→ rsync source ($REPO_ROOT) to $HOST:$DIR"
rsync -az \
  --exclude node_modules --exclude .next --exclude .git --exclude .local-db \
  --exclude '.env' --exclude '.env.local' --exclude 'scripts/images' --exclude 'public/uploads' \
  -e "ssh -i $KEY" "$REPO_ROOT/" "$HOST:$DIR/"

echo "→ starting build + reload on the VPS (backgrounded, polled — this can take a few minutes)"
# Backgrounded + polled rather than a single blocking ssh call trusted for its
# own exit code — deploy-prod.sh's identical blocking pattern was observed
# returning "success" while the remote build was still actively running
# (2026-07-18; root cause not conclusively isolated, suspected a silently
# dropped long-idle SSH connection with no keepalive set). Fixed the same way
# here: launch in the background, then independently poll a written exit-
# status file, THEN confirm pm2 actually replaced the process (new pid), THEN
# health-check — never trust one blocking call's own completion signal for a
# multi-minute build. See deploy-prod.sh for the fuller writeup.

# Baseline pid — cve-staging runs in fork mode (a single process, not a cluster).
BEFORE_PID="$(ssh -i "$KEY" "$HOST" "pm2 pid cve-staging" 2>/dev/null || true)"

REMOTE_SCRIPT="$(mktemp)"; trap 'rm -f "$REMOTE_SCRIPT"' EXIT
cat > "$REMOTE_SCRIPT" <<REMOTE
#!/usr/bin/env bash
set -euo pipefail
trap 'echo \$? > "$DIR/.deploy-status"' EXIT
cd "$DIR"
# Always build from a clean .next — an incremental `next build` on top of a stale
# .next has repeatedly produced a broken server-reference-manifest (server actions
# added/changed since the last clean build crash client-side with "undefined is not
# an object (evaluating 'e.ok')" — the action ID the client calls doesn't resolve).
# A full rm -rf .next before building has fixed it every time; do it unconditionally
# rather than waiting for the symptom to reappear.
rm -rf .next
npx prisma generate

# Build-time-only connection cap: next build's static-generation phase spawns
# one worker per available CPU, each opening its own Prisma pool at the
# default size (2*cpus+1) — on a machine with more cores than this VPS,
# that stacks on top of the already-running app instances' connections and
# can blow past Postgres's max_connections ("too many clients already"), hit
# and confirmed during the 2026-07 staging->production merge (see
# MERGE_AUDIT.md phase 1.3). The real .env on disk is never modified — only
# this one-off build invocation gets the capped DATABASE_URL.
DB_URL_LINE="\$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
DB_URL_LINE="\${DB_URL_LINE%\\"}"
DB_URL_LINE="\${DB_URL_LINE#\\"}"
BUILD_DB_URL="\${DB_URL_LINE}&connection_limit=5&pool_timeout=30"
DATABASE_URL="\$BUILD_DB_URL" NODE_OPTIONS=--max_old_space_size=2048 npm run build

# Hard gate: verify every known runtime-only asset (files read via fs at
# request time, invisible to the build itself) exists in \$DIR BEFORE the
# reload makes this build live — same reasoning as deploy-prod.sh; see
# MERGE_AUDIT.md / RETRY_READINESS.md.
bash "$DIR/scripts/verify-runtime-assets.sh" "$DIR"

pm2 reload cve-staging --update-env
REMOTE

scp -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$REMOTE_SCRIPT" "$HOST:$DIR/.deploy-run.sh" >/dev/null
ssh -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$HOST" \
  "cd '$DIR' && rm -f .deploy-status .deploy-build.log && chmod +x .deploy-run.sh && (nohup ./.deploy-run.sh >.deploy-build.log 2>&1 &) && echo launched"

POLL_INTERVAL=10
MAX_WAIT=900   # 15 minutes
elapsed=0
status=""
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  status="$(ssh -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$HOST" "cat '$DIR/.deploy-status' 2>/dev/null" || true)"
  [ -n "$status" ] && break
  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
  echo "   ...still building (${elapsed}s elapsed)"
done

if [ -z "$status" ]; then
  echo "✗ timed out after ${MAX_WAIT}s waiting for the remote build to finish. Log tail:"
  ssh -i "$KEY" "$HOST" "tail -n 60 '$DIR/.deploy-build.log' 2>/dev/null" | sed 's/^/     /'
  exit 1
fi
if [ "$status" != "0" ]; then
  echo "✗ remote build/deploy FAILED (exit $status). Log tail:"
  ssh -i "$KEY" "$HOST" "tail -n 60 '$DIR/.deploy-build.log' 2>/dev/null" | sed 's/^/     /'
  exit 1
fi
echo "   ✓ remote build + verify-runtime-assets + pm2 reload reported success (exit 0)"

echo "→ confirming pm2 replaced the process"
AFTER_PID="$(ssh -i "$KEY" "$HOST" "pm2 pid cve-staging" 2>/dev/null || true)"
if [ -z "$AFTER_PID" ] || [ "$AFTER_PID" = "$BEFORE_PID" ]; then
  echo "✗ pm2 pid for cve-staging didn't change (before: [$BEFORE_PID] after: [$AFTER_PID]) — reload may not have taken effect."
  exit 1
fi
echo "   ✓ process replaced (before: $BEFORE_PID → after: $AFTER_PID)"

echo "→ health check https://design.cyprusvipestates.com/"
code="$(curl -s -o /dev/null -w '%{http_code}' https://design.cyprusvipestates.com/ || echo 000)"
echo "   HTTP $code"
[ "$code" = 200 ] || { echo "⚠️  non-200 on staging — verify manually (pm2 logs cve-staging)."; exit 1; }

echo "✓ Staging updated → https://design.cyprusvipestates.com"
