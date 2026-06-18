#!/bin/bash
# Validate every URL in the inventory against a base host, following redirects to
# the FINAL status. Prints a tally and lists any non-200. Read-only / safe to rerun.
#
# Run it ON the VPS so http://localhost hits Nginx (port 80) and exercises the
# 301 redirect rules (old prefix-less German -> /de/..., / -> /en/, etc.):
#
#   bash scripts/qa/url-sweep.sh
#   bash scripts/qa/url-sweep.sh https://cyprusvipestates.com   # post-cutover
#   bash scripts/qa/url-sweep.sh http://localhost ./my-urls.txt
set -u
BASE="${1:-http://localhost}"
IN="${2:-$(dirname "$0")/url-inventory-production.txt}"

[ -f "$IN" ] || { echo "inventory not found: $IN" >&2; exit 1; }

total=0; ok=0; fail=0
while IFS= read -r path; do
  [ -z "$path" ] && continue
  total=$((total + 1))
  code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 20 "${BASE}${path}")
  if [ "$code" = "200" ]; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
    printf '%s  %s\n' "$code" "$path"
  fi
done < "$IN"

echo "SWEEP DONE: base=$BASE total=$total ok=$ok fail=$fail"
[ "$fail" -eq 0 ]
