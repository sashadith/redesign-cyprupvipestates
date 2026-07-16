#!/usr/bin/env bash
# Deploy the CURRENT local checkout to staging → https://design.cyprusvipestates.com
#
# Usage (after getting the latest code):
#   git checkout redesign/home && git pull --ff-only
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

echo "→ build + reload on the VPS"
# Always build from a clean .next — an incremental `next build` on top of a stale
# .next has repeatedly produced a broken server-reference-manifest (server actions
# added/changed since the last clean build crash client-side with "undefined is not
# an object (evaluating 'e.ok')" — the action ID the client calls doesn't resolve).
# A full rm -rf .next before building has fixed it every time; do it unconditionally
# rather than waiting for the symptom to reappear.
#
# Build-time-only connection cap: next build's static-generation phase spawns
# one worker per available CPU, each opening its own Prisma pool at the
# default size (2*cpus+1) — on a machine with more cores than this VPS,
# that stacks on top of the already-running app instances' connections and
# can blow past Postgres's max_connections ("too many clients already"), hit
# and confirmed during the 2026-07 staging->production merge (see
# MERGE_AUDIT.md phase 1.3). The real .env on disk is never modified — only
# this one-off build invocation gets the capped DATABASE_URL.
ssh -i "$KEY" "$HOST" "cd $DIR && rm -rf .next && \
  DB_URL_LINE=\$(grep '^DATABASE_URL=' .env | cut -d= -f2-); \
  DB_URL_LINE=\${DB_URL_LINE%\\\"}; DB_URL_LINE=\${DB_URL_LINE#\\\"}; \
  DATABASE_URL=\"\${DB_URL_LINE}&connection_limit=5&pool_timeout=30\" \
  NODE_OPTIONS=--max_old_space_size=2048 npm run build && pm2 reload cve-staging --update-env"

echo "✓ Staging updated → https://design.cyprusvipestates.com"
