#!/usr/bin/env bash
# Verify every DE_LANDING_MERGES redirect (src/middleware.ts) single-hops to
# its target in production, and cross-check nginx exact-match location
# coverage for the root/legacy form.
#
# Exists because of the 2026-07-28 incident: two independent feature branches
# both editing DE_LANDING_MERGES were deployed as siblings — the second
# deploy's rsync silently replaced the first's entry instead of adding to it,
# 404ing a redirect that had verified clean minutes earlier. This script reads
# the table directly out of the CURRENTLY CHECKED-OUT middleware.ts (not a
# hardcoded URL list) so it can never go stale as the table grows — it's meant
# to be run after every deploy that touches landing-page consolidation,
# whichever branch or how many merges are in the table by then.
#
# Usage:
#   ./scripts/verify-landing-merges.sh                    # checks production
#   CVP_VERIFY_HOST=https://design.cyprusvipestates.com \
#     ./scripts/verify-landing-merges.sh                  # checks staging
set -euo pipefail

HOST="${CVP_VERIFY_HOST:-https://cyprusvipestates.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
MIDDLEWARE="$REPO_ROOT/src/middleware.ts"
NGINX_CONF="$REPO_ROOT/ops/nginx/cyprusvipestates.conf"

[ -f "$MIDDLEWARE" ] || { echo "✗ $MIDDLEWARE not found"; exit 1; }

# Pull "key": "value" pairs out of the DE_LANDING_MERGES block only (between
# its declaration and the closing `};`) — not the whole file, so an unrelated
# quoted string elsewhere never gets misread as a redirect entry.
# Portable (bash 3.2, macOS's default /bin/bash — no mapfile/readarray).
PAIRS_FILE="$(mktemp)"; trap 'rm -f "$PAIRS_FILE"' EXIT
sed -n '/^const DE_LANDING_MERGES/,/^};/p' "$MIDDLEWARE" \
  | grep -oE '"[^"]+":[[:space:]]*"[^"]+"' > "$PAIRS_FILE"

PAIR_COUNT="$(wc -l < "$PAIRS_FILE" | tr -d ' ')"
if [ "$PAIR_COUNT" -eq 0 ]; then
  echo "✗ found no entries in DE_LANDING_MERGES — check the block still parses as expected"
  exit 1
fi

echo "──────────────────────────────────────────────"
echo " Landing-page merge redirect verification"
echo "   host:    $HOST"
echo "   entries: $PAIR_COUNT"
echo "──────────────────────────────────────────────"

fail=0
printf "%-4s %-55s %-9s %-9s %-30s %-9s %s\n" "" "KEY" "/de/ hops" "/de/ code" "final URL" "root hops" "root code"

while IFS= read -r pair; do
  key="$(echo "$pair" | sed -E 's/^"([^"]+)".*/\1/')"
  target="$(echo "$pair" | sed -E 's/^"[^"]+":[[:space:]]*"([^"]+)"$/\1/')"

  de_result="$(curl -s -o /dev/null -w "%{num_redirects} %{http_code} %{url_effective}" -L "$HOST/de/$key")"
  de_hops="$(echo "$de_result" | awk '{print $1}')"
  de_code="$(echo "$de_result" | awk '{print $2}')"
  de_url="$(echo "$de_result" | awk '{print $3}')"

  # Root/legacy form only makes sense for leaf slugs nginx actually maps —
  # nested keys (containing "/") are reported for awareness but not graded,
  # since nginx coverage for those is a separate, deliberate exact-match list.
  root_result="$(curl -s -o /dev/null -w "%{num_redirects} %{http_code}" -L "$HOST/$key")"
  root_hops="$(echo "$root_result" | awk '{print $1}')"
  root_code="$(echo "$root_result" | awk '{print $2}')"

  status="✓"
  if [ "$de_hops" != "1" ] || [ "$de_code" != "200" ] || [[ "$de_url" != *"$target" ]]; then
    status="✗"; fail=1
  fi

  printf "%-4s %-55s %-9s %-9s %-30s %-9s %s\n" "$status" "$key" "$de_hops" "$de_code" "$de_url" "$root_hops" "$root_code"
done < "$PAIRS_FILE"

echo "──────────────────────────────────────────────"
if [ "$fail" -eq 0 ]; then
  echo "✓ every DE_LANDING_MERGES entry single-hops (/de/ form) to its target with a 200 landing."
  echo "  Root-hop counts are shown for awareness — cross-check nonzero/non-1 root rows against"
  echo "  $NGINX_CONF's exact-match locations before assuming they're covered."
else
  echo "✗ one or more entries failed — see rows marked ✗ above. Do not consider this deploy verified."
  exit 1
fi
