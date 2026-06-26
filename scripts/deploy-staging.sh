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

echo "→ rsync source to $HOST:$DIR"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .local-db \
  --exclude '.env.local' --exclude 'scripts/images' --exclude 'public/uploads' \
  -e "ssh -i $KEY" ./ "$HOST:$DIR/"

echo "→ build + reload on the VPS"
ssh -i "$KEY" "$HOST" "cd $DIR && NODE_OPTIONS=--max_old_space_size=2048 npm run build && pm2 reload cve-staging --update-env"

echo "✓ Staging updated → https://design.cyprusvipestates.com"
