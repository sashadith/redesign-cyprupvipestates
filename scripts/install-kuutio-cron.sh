#!/usr/bin/env bash
# Installs the kuutio-sync crontab entry on the production VPS (2026-08-26).
#
# Run it from this repo:
#   ssh -i ~/.ssh/cvp_vps root@72.60.89.239 'bash -s' < scripts/install-kuutio-cron.sh
#
# Idempotent — refuses to add a second copy — and backs the current crontab up
# before touching anything. Nothing else in the crontab is read or rewritten
# beyond the append.
#
# Why `scheduled=1`: it is the ONLY flag that lets the developer's own
# driveSyncInterval skip a run (writeKuutioDraft's respectInterval guard). A
# manual curl without it always syncs, which is what a human trigger should do.
# Why 03:00: psi-sync (02:00) is done by ~02:21 and feed-sync starts at 04:00,
# so a ~12-min run overlaps nothing, and it still lands inside action-digest's
# 4h lookback window so the 05:00 digest reports it. See DEPLOYMENT.md.
set -euo pipefail

BACKUP="/root/crontab-backup-before-kuutio-sync-20260826.txt"
crontab -l > "$BACKUP"
echo "backup written: $BACKUP ($(wc -l < "$BACKUP") lines)"

if crontab -l | grep -q 'kuutio-sync'; then
  echo "ALREADY PRESENT — nothing changed."
  crontab -l | grep 'kuutio-sync'
  exit 0
fi

{ crontab -l; echo '0 3 * * * SECRET=$(grep "^CRON_SECRET=" /var/www/cyprusvipestates/.env | cut -d= -f2); curl -s "http://127.0.0.1:3000/api/cron/kuutio-sync?key=$SECRET&scheduled=1" >> /var/log/kuutio-sync-prod.log 2>&1'; } | crontab -

echo "--- installed; crontab now has $(crontab -l | wc -l) lines, new entry:"
crontab -l | grep 'kuutio-sync'
