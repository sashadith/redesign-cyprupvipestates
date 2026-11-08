#!/usr/bin/env bash
# The DATABASE_URL `next build` should use, with the build-time pool cap applied
# EXACTLY ONCE.
#
# Why this is not just string concatenation (2026-11-08): the build's
# static-generation phase spawns one worker per CPU, each opening its own Prisma
# pool, so deploy-prod.sh caps the pool for the build step only — the real .env
# is never modified, and pm2's serving processes keep their normal sizing.
#
# That cap used to be appended blindly. Then the serving pool was raised by
# putting connection_limit=15&pool_timeout=20 into /var/www/shared/.env (the app
# had been on Prisma's default of 5 per worker while Postgres allowed 100), and
# a blind append would have produced a URL carrying each parameter TWICE, with
# the winner decided by whichever parser read it. Neither outcome was dangerous
# here — worst case the build would have used 15 per worker, 30 against a
# max_connections of 100 — but "it depends on the parser" is not something to
# leave in a deploy path. So: strip whatever is there, then set it once.
set -euo pipefail

URL="${1:?usage: build-db-url.sh <database-url> [connection_limit] [pool_timeout]}"
LIMIT="${2:-5}"
TIMEOUT="${3:-30}"

# Drop any existing copy of these two parameters wherever they sit, then tidy
# the separators the removal leaves behind (`?&`, `&&`, a trailing `?` or `&`).
CLEAN="$(printf '%s' "$URL" | sed -E '
  s/([?&])(connection_limit|pool_timeout)=[^&]*/\1/g
  s/\?&+/?/g
  s/&&+/\&/g
  s/[?&]+$//
')"

# A URL that had no query string at all (or lost it entirely) needs `?`, not `&`.
case "$CLEAN" in
  *\?*) SEP="&" ;;
  *)    SEP="?" ;;
esac

printf '%s%sconnection_limit=%s&pool_timeout=%s\n' "$CLEAN" "$SEP" "$LIMIT" "$TIMEOUT"
