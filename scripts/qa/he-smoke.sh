#!/usr/bin/env bash
# Hebrew locale smoke check. Usage: scripts/qa/he-smoke.sh [https://design.cyprusvipestates.com]
# On staging (he live) expects RTL html and 2xx/404-but-not-500; on production
# (he gated) expects /he to 404 and no hreflang="he" anywhere.
set -euo pipefail
HOST="${1:-https://design.cyprusvipestates.com}"
code() { curl -s -o /dev/null -w "%{http_code}" -L "$HOST$1"; }
fail=0
echo "host: $HOST"
for p in /he /he/projects /he/faq /he/blog /he/developers; do
  c=$(code "$p"); echo "$c  $p"
  [ "$c" = "500" ] && fail=1
done
html=$(curl -s -L "$HOST/he/projects" | grep -o '<html[^>]*>' | head -1)
echo "html tag: $html"
echo "$html" | grep -q 'dir="rtl"' && echo "rtl: yes" || echo "rtl: no"
he_alts=$(curl -s "$HOST/sitemaps/pages" | grep -c 'hreflang="he"' || true)
echo "hreflang=he entries in /sitemaps/pages: $he_alts"
for p in /de/faq /projects /blog; do c=$(code "$p"); echo "$c  $p (regression)"; [ "$c" != "200" ] && fail=1; done
exit $fail
