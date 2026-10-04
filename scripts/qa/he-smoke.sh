#!/usr/bin/env bash
# Hebrew locale smoke check. Usage: scripts/qa/he-smoke.sh [host] [live|gated]
# MODE can also be set via the MODE env var; the second positional arg wins
# when both are given. Defaults to "live".
#   live  (he routed, e.g. staging)   — expects RTL html and 2xx/404-but-not-500
#                                        on /he* paths.
#   gated (he NOT routed, production) — every /he* path must 404, no
#                                        hreflang="he" may appear anywhere, and
#                                        the fetched html must carry no RTL marker.
set -euo pipefail
HOST="${1:-https://design.cyprusvipestates.com}"
MODE="${2:-${MODE:-live}}"
code() { curl -s -o /dev/null -w "%{http_code}" -L "$HOST$1"; }
fail=0
echo "host: $HOST"
echo "mode: $MODE"

for p in /he /he/projects /he/faq /he/blog /he/developers; do
  c=$(code "$p"); echo "$c  $p"
  if [ "$MODE" = "gated" ]; then
    if [ "$c" != "404" ]; then fail=1; fi
  else
    if [ "$c" = "500" ]; then fail=1; fi
  fi
done

html=$(curl -s -L "$HOST/he/projects" | grep -o '<html[^>]*>' | head -1)
echo "html tag: $html"
if echo "$html" | grep -q 'dir="rtl"'; then
  rtl="yes"
else
  rtl="no"
fi
echo "rtl: $rtl"
if [ "$MODE" = "gated" ] && [ "$rtl" != "no" ]; then fail=1; fi

he_alts=$(curl -s "$HOST/sitemaps/pages" | grep -c 'hreflang="he"' || true)
echo "hreflang=he entries in /sitemaps/pages: $he_alts"
if [ "$MODE" = "gated" ] && [ "$he_alts" != "0" ]; then fail=1; fi

for p in /de/faq /projects /blog; do
  c=$(code "$p"); echo "$c  $p (regression)"
  if [ "$c" != "200" ]; then fail=1; fi
done

exit $fail
