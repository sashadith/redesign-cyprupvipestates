#!/usr/bin/env bash
# Verifies nginx's worker user (www-data) can actually traverse the full
# directory chain down to a REAL static asset and read it — not just that
# the permission bits on the top-level release dir look right. Run this
# AFTER the build, BEFORE the symlink swap goes live: a failure here means
# the live site was never touched (the old release keeps serving).
#
# Root cause this exists for (2026-07-24): a release directory created via
# `mkdir -p` over a non-interactive SSH session inherited umask 077 instead
# of 022, landing at drwx------ instead of drwxr-xr-x. Every file below it
# was correctly 644/755, so a build succeeded and every root-run check
# passed — but nginx (running as www-data) couldn't traverse into the
# release dir at all, and every /_next/static/* and /uploads/* request 403'd
# for real visitors while the page itself still returned 200 (server-
# rendered directly by the Node process, which runs as root and was
# unaffected). This is the automated check that would have caught it before
# it ever reached production — see deploy-prod.sh's umask/chmod fixes for
# the actual fix; this script only verifies the result.
set -euo pipefail
TARGET="${1:?usage: verify-www-data-access.sh <path-to-built-tree>}"

WWW_USER="www-data"
fail=0

SAMPLE="$(find "$TARGET/.next/static/css" -maxdepth 1 -type f -name '*.css' 2>/dev/null | head -1)"
if [ -z "$SAMPLE" ]; then
  echo "✗ no .css file found under $TARGET/.next/static/css to test against"
  exit 1
fi
echo "· sample file: $SAMPLE"

# Walk every directory component from $TARGET down to the sample file's
# parent, testing each one individually — pinpoints exactly which directory
# blocks $WWW_USER, rather than just "can't read the file".
REL_PATH="${SAMPLE#"$TARGET"/}"
REL_DIR="$(dirname "$REL_PATH")"
CHECK_PATH="$TARGET"

check_traverse() {
  if sudo -u "$WWW_USER" test -x "$1" 2>/dev/null; then
    echo "✓ $WWW_USER can traverse $1"
  else
    echo "✗ $WWW_USER CANNOT traverse $1"
    fail=1
  fi
}

check_traverse "$CHECK_PATH"
IFS='/' read -ra PARTS <<< "$REL_DIR"
for part in "${PARTS[@]}"; do
  [ -z "$part" ] && continue
  CHECK_PATH="$CHECK_PATH/$part"
  check_traverse "$CHECK_PATH"
done

if sudo -u "$WWW_USER" test -r "$SAMPLE" 2>/dev/null; then
  echo "✓ $WWW_USER can read $SAMPLE"
else
  echo "✗ $WWW_USER CANNOT read $SAMPLE"
  fail=1
fi

if [ "$fail" = 1 ]; then
  echo
  echo "Refusing to proceed — $WWW_USER (nginx's worker user) cannot serve static assets from $TARGET."
  exit 1
fi
echo
echo "www-data traversal + read check passed for $TARGET."
