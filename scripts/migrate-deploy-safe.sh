#!/usr/bin/env bash
# Hard safety wrapper for every Prisma command that can change schema or
# migration history. Built 2026-08-11 after `prisma migrate deploy` ran
# directly against the real (shared staging+prod) DB from a branch
# (fix/crm-status-plausibility) that was never merged to main — the DB
# ended up with a column (leads.viewingScheduledAt, migration
# 20260810090000_add_lead_viewing_scheduled_at) that no migration in main's
# history ever created. See DEPLOYMENT.md's "Shared-database migration
# discipline" section — that section already documented this exact failure
# mode from two 2026-07-25 incidents and the manual diff check that catches
# it; this script is that rule enforced automatically instead of relying on
# remembering to run the check by hand.
#
# `scripts/assert-not-prod-db.mjs` already existed as a guard for this, but
# only one one-off script actually called it — nothing stopped a bare
# `npx prisma migrate deploy` from running straight past it. This wrapper is
# the only sanctioned way to run a schema/history-mutating Prisma command:
#
#   scripts/migrate-deploy-safe.sh migrate deploy
#   scripts/migrate-deploy-safe.sh migrate resolve --applied <name>
#   scripts/migrate-deploy-safe.sh migrate resolve --rolled-back <name>
#   scripts/migrate-deploy-safe.sh migrate reset
#   scripts/migrate-deploy-safe.sh db push
#
# Never call `npx prisma migrate ...` / `npx prisma db push` directly —
# always through this wrapper (see DEPLOYMENT.md).
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <migrate deploy|migrate resolve|migrate reset|db push> [...args]" >&2
  exit 1
fi

# Only the specific subcommands that mutate schema or migration history are
# gated — deliberately a fixed allow-list, not "everything except a
# denylist", so an unrecognized command fails closed instead of silently
# passing through unchecked.
GATED_COMMANDS=("migrate deploy" "migrate resolve" "migrate reset" "db push")
ARGS="$*"
GATED=false
for cmd in "${GATED_COMMANDS[@]}"; do
  if [[ "$ARGS" == "$cmd"* ]]; then
    GATED=true
    break
  fi
done
if [ "$GATED" != true ]; then
  echo "ERROR: migrate-deploy-safe.sh only wraps: ${GATED_COMMANDS[*]}" >&2
  echo "Got: npx prisma $ARGS" >&2
  echo "(Read-only commands like 'migrate status' or 'generate' don't need this wrapper.)" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Refusing to run." >&2
  exit 1
fi

DB_NAME=$(node -e "console.log(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ''))" 2>/dev/null || echo "")
if [ -z "$DB_NAME" ]; then
  echo "ERROR: could not parse a database name out of DATABASE_URL. Refusing to run." >&2
  exit 1
fi
echo "→ target database (from DATABASE_URL): \"$DB_NAME\""

PROD_DB_NAME="cyprusvipestates"
if [ "$DB_NAME" = "$PROD_DB_NAME" ]; then
  echo "→ this IS the production database (staging shares it too — see DEPLOYMENT.md)."
  if [ "${CVP_CONFIRM_PROD_MIGRATE:-}" != "yes" ]; then
    echo "ERROR: refusing to run \"npx prisma $ARGS\" against \"$PROD_DB_NAME\" without an explicit, separate confirmation." >&2
    echo "Set CVP_CONFIRM_PROD_MIGRATE=yes for this exact command if this is genuinely the deliberate, approved production migration." >&2
    echo "This is not the absence of a guard — it's a required, separate opt-in for the one run that's actually meant to touch prod." >&2
    exit 1
  fi
  echo "→ CVP_CONFIRM_PROD_MIGRATE=yes — proceeding against production."
else
  echo "→ OK — not the production database."
fi

exec npx prisma "$@"
