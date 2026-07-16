#!/usr/bin/env bash
# Run against a freshly-built tree BEFORE it goes live (before any atomic
# swap / directory rename touches the live directory). Exits non-zero
# (blocking the deploy) if any known runtime-only asset is missing — files
# read via fs.readFile/readFileSync at REQUEST time, which `next build`'s
# static import-graph check can never catch (a missing `import` target fails
# the build; a missing fs.readFile target only fails the first real request
# that reaches it). This is exactly how DejaVuSans.ttf slipped through a
# clean build and broke PDF generation after the first Phase 3 attempt —
# see MERGE_AUDIT.md / RETRY_READINESS.md.
#
# To extend: grep -rn "readFile(join(\|readFileSync(join(" src/ for new
# literal (non-variable) path call sites, decide if it's a real fixed
# dependency (add it to REQUIRED_FILES) or data-dependent/dynamic (skip it —
# e.g. public/uploads/* is covered by the directory check below instead of
# enumerating every possible file under it).
set -euo pipefail
TARGET="${1:?usage: verify-runtime-assets.sh <path-to-built-tree>}"

REQUIRED_FILES=(
  "public/fonts/DejaVuSans.ttf"
  "public/medousa-feed.xml"
  "public/poi/cyprus.json"
  "public/poi/cyprus-extra.json"
)

fail=0
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -e "$TARGET/$f" ]; then
    echo "✗ MISSING required runtime asset: $f"
    fail=1
  else
    echo "✓ $f"
  fi
done

# public/uploads must exist and resolve to a real, non-empty directory
# (whether as a symlink or a real dir) — covers every asset read under it
# (logo, distance icons, mirrored feed/Drive images, admin uploads) without
# needing to enumerate each one individually.
if [ ! -d "$TARGET/public/uploads" ]; then
  echo "✗ MISSING public/uploads (symlink or directory)"
  fail=1
elif [ -z "$(ls -A "$TARGET/public/uploads" 2>/dev/null)" ]; then
  echo "✗ public/uploads exists but is EMPTY — symlink likely broken or not yet created"
  fail=1
else
  echo "✓ public/uploads resolves and is non-empty ($(find "$TARGET/public/uploads" -maxdepth 1 | wc -l) top-level entries)"
fi

if [ "$fail" = 1 ]; then
  echo
  echo "Refusing to proceed — one or more runtime assets missing from $TARGET."
  exit 1
fi
echo
echo "All known runtime assets present in $TARGET. Safe to proceed."
