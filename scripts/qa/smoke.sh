#!/bin/bash
# Read-only staging smoke checks: language rendering, SEO/infra endpoints, app
# endpoints, and image serving. Safe to rerun (makes no writes, sends no leads).
# The lead-pipeline test is intentionally NOT here — it fires real notifications;
# see README.md for the manual procedure.
#
#   bash scripts/qa/smoke.sh                 # on the VPS (http://localhost via Nginx)
#   bash scripts/qa/smoke.sh https://cyprusvipestates.com
set -u
BASE="${1:-http://localhost}"
code() { curl -s -o /dev/null -w "%{http_code}" -L --max-time 15 "$1"; }

echo "== base: $BASE =="

echo "-- languages (homepage: status + <html lang>) --"
for l in en de pl ru; do
  body=$(curl -s -L --max-time 15 "$BASE/$l")
  lang=$(printf '%s' "$body" | grep -oE '<html[^>]*lang="[a-z]+"' | head -1)
  echo "  /$l -> $(code "$BASE/$l")  ($lang)"
done

echo "-- localized listings --"
for l in en de pl ru; do
  echo "  /$l/projects -> $(code "$BASE/$l/projects")   /$l/blog -> $(code "$BASE/$l/blog")"
done

echo "-- SEO / infra --"
echo "  /sitemap.xml          -> $(code "$BASE/sitemap.xml")"
echo "  /robots.txt           -> $(code "$BASE/robots.txt")"
echo "  /sitemaps/projects.xml -> $(code "$BASE/sitemaps/projects.xml")"

echo "-- app endpoints --"
echo "  /admin/login                       -> $(code "$BASE/admin/login")"
echo "  /api/cron/publish-scheduled (noauth) -> $(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/cron/publish-scheduled")  (expect 401)"
# Bot UA -> 204 and NO row inserted, so this check stays read-only.
echo "  /api/analytics/track (POST, bot UA) -> $(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'User-Agent: qa-smoke-bot' --data '{"path":"/__smoke__","locale":"en"}' "$BASE/api/analytics/track")  (expect 204, no row)"

echo "-- images --"
echo "  /uploads logo -> $(code "$BASE/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png")"
