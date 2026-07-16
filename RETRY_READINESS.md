# Phase 3 Retry Readiness

**Read-only investigation. Nothing was changed on production except one authorized deletion** (the smoke-test lead `75a7831a-e12d-4c0c-9ecb-c26fc3af38cd`, test data created during the aborted Phase 3 attempt).

**Context:** the first Phase 3 attempt (2026-07-16, swap 03:54:46Z, rollback 04:01:08Z) was rolled back after discovering `/api/projects/[lang]/[slug]/pdf` returned 500 in production — `public/fonts/DejaVuSans.ttf` existed in production's old, separately-tracked tree but was never part of the git repo. This document finds every other gap of the same kind before a retry is attempted.

---

## 1. Full runtime-asset diff

Re-ran the tree comparison between the merge-candidate export and production's live tree, excluding **only** `node_modules`, `.next`, `.git`, `.env*`, `public/uploads` (the previous diff, done for `MERGE_AUDIT.md`, additionally excluded `scripts/images` — that exclusion is what let the scope of "production-only files" look smaller than it really is; this pass excludes nothing else).

**59 production-only files found** (up from the 22 in the original audit). Classified:

### (a) Load-bearing runtime asset — 1 confirmed, 1 additional found outside the diff

| File | Size | Referenced by | Build-time or runtime |
|---|---|---|---|
| `public/fonts/DejaVuSans.ttf` | 757 KB | `src/app/api/projects/[lang]/[slug]/pdf/route.tsx:39` — `Font.register({ family: "DejaVuSans", src: path.join(PUBLIC_DIR, "fonts", "DejaVuSans.ttf") })` | **Runtime**, at module load (first request to the PDF route). `Font.register` throws immediately if the file is missing — this is the confirmed root cause of the rollback. |
| `public/medousa-feed.xml` | — | `src/app/preview-project/feeds.ts:430,616` — `readFile(join(process.cwd(), "public", "medousa-feed.xml"), "utf8")`, used by the `medousa` feed adapter | **Runtime**, on every request that lists/loads a "medousa" project. **This file does not exist anywhere** — not in production's current tree, not in the old/broken tree, not in the merge-candidate. It only exists committed on `wip/content-imports` (`d12f06d`), where it was swept in alongside genuinely-unrelated content-migration work during Phase 1.1's cleanup. **This is not a merge regression** — the medousa feed has been silently returning 0 projects on every environment (confirmed against an earlier observation this session, made before any Phase 0–3 work, where a feed-sync run against staging returned `{"dev":"medousa","found":0}`). Fixing it now closes a real, pre-existing gap, but its absence will not block or break the retry the way the font did — it's a silent no-op, not a 500. |

**Why the font broke the build's guarantee and medousa didn't get caught either:** both are read via `fs.readFile`/`fs.readFileSync` at runtime, not `import`/`require`. Next.js's build only resolves static `import` graphs — a missing file reached only through a filesystem call is invisible to `next build` and only surfaces when a real request exercises that exact code path. The merge-candidate build passing with zero errors proved nothing about either of these two files.

**Full runtime-fs-read audit** (searched all of `src/` for `readFile`, `readFileSync`, `createReadStream`, `existsSync`, `process.cwd()`):

| Call site | Path | Status |
|---|---|---|
| `feeds.ts:430,616` | `public/medousa-feed.xml` | Missing everywhere (see above) |
| `pdf/route.tsx:22,39` | `public/fonts/DejaVuSans.ttf` | Missing from merge-candidate only (fixed by porting) |
| `api/admin/upload/route.ts:124` | `public/uploads/images/` | Fine — stable `public/uploads` symlink, verified resolving |
| `imageMirror.ts:30` | `public/uploads/developments/` | Fine — same stable symlink |
| `imageMirror.ts:105` | `mkdtemp(tmpdir())`-created temp dir | Not a repo asset — dynamically created and consumed within the same function call, no risk |

No other literal, hardcoded filesystem paths exist in `src/`. This audit is exhaustive for the current codebase as of the merge-candidate tag.

### (b) Leftover artifact — 57 files, none load-bearing

- `migration/01-assets.mjs`, `migration/02-content.mjs` — **already handled**: same content exists at `legacy-scripts/*.mjs` in the merge-candidate (ported during Phase 1.2). Flagged only because the diff compares by exact path; not a gap.
- `next-env.d.ts` — Next.js auto-generated TypeScript declaration file, listed in `.gitignore`, regenerated automatically on `next dev`/`next build`. Confirmed not load-bearing.
- `scripts/images/{salt,nest,matisse}/*` (37 files) — source images for a past manual admin content-import. Not referenced anywhere in `src/`; only appear in `deploy-prod.sh`/`deploy-staging.sh` as an `--exclude` pattern, i.e. the deploy tooling itself already treats this directory as local-only scratch material, never meant to be synced.
- `scripts/de-content/*.md` (7 files), `scripts/importLandingsPrisma.cjs`, `scripts/de-landings.csv`, `scripts/auditLandings.cjs`, `src/app/[lang]/blog/BlogInsights.tsx`, `src/app/[lang]/blog/page/[n]/page.tsx`, `src/app/preview-home/sections/NavLinks.tsx`, `src/app/preview-insights/{InsightsSeo,InsightsMotion}.tsx`, `src/app/preview-project/Gallery.tsx`, `src/app/preview-projects/ProjectsSeo.tsx` — all part of the deliberately-excluded, unrelated blog/insights-migration and landing-page-import work (`wip/content-imports`). Confirmed not load-bearing: the merge-candidate build succeeded with zero errors, which is only possible if nothing in the built tree imports these files (a missing `import`/`require` target fails the build; these are all `.ts`/`.tsx`/`.md`/`.cjs`/`.csv` files that would only ever be reached via `import`, never `fs.readFile`).

### (c) Unknown

None. Every production-only file was resolved to (a) or (b).

---

## 2. PDF generator — full dependency enumeration

Read `src/app/api/projects/[lang]/[slug]/pdf/route.tsx` in full.

- **Font**: exactly one `Font.register` call in the entire codebase (confirmed via grep), exactly one font file in `public/fonts/` on the live server (confirmed via `ls`) — `DejaVuSans.ttf`. No other fonts to account for.
- **Logo**: `/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png`, resolved through `toLocalFile()` into `public/uploads/...` — covered by the stable symlink, verified live (200).
- **8 hardcoded distance-icon images** (`/uploads/files/{hash}.png` — beach, restaurants, shops, airport, hospital, school, city center, golf court): individually curl-tested, **all 8 return 200** — covered by the same stable symlink.
- **Dynamic preview image**: `project.previewImage` from Sanity, resolved the same way — data-dependent per project, but resolves through the same verified-stable `public/uploads` path, not a fixed file to enumerate.

No other filesystem dependency exists in this route. The font was the only genuine gap.

---

## 3. Item 20 verdict — the `sitemap_index.xml` / Locale anomaly

**Not a regression. Pre-existing, unrelated to this merge, low severity.**

Searched `/var/log/pm2/cvp-err-1.log` for every occurrence of the `type: "homepage", language: "sitemap_index.xml"` error and extracted the nearest preceding timestamp for each: **2026-06-29, 07-01, 07-02, 07-03, 07-10, 07-11, 07-14, 07-15** — recurring for nearly three weeks, most recently the day *before* today's deploy attempt. It could not have been caused by a merge that hadn't happened yet.

Root cause: something (almost certainly a crawler or scanner probing common alternate sitemap filenames) periodically requests `/sitemap_index.xml` directly — a URL that was never linked or advertised (`robots.txt` correctly points at `/sitemap.xml` only). The `[lang]/[...slug]` singlepage catch-all treats the first path segment as a locale attempt, tries to query with `language: "sitemap_index.xml"`, and Prisma rejects it as an invalid `Locale` enum value.

Confirmed identical live behavior on both environments right now: `curl https://cyprusvipestates.com/sitemap_index.xml` → 500, `curl https://design.cyprusvipestates.com/sitemap_index.xml` → 500. Same bug, same code path, present before, during, and after today's deploy attempt, on the environment that was never touched today (staging) just as much as production.

**Not a blocker for the retry.** Worth a small independent fix later (e.g. matcher/middleware exclusion for `.xml` requests outside the known sitemap routes), but out of scope for this merge.

---

## 4. Item 8 diagnosis — admin bootstrap credential

**Root cause confirmed precisely, without ever exposing the password:** the `.env` `ADMIN_PASSWORD` value does **not** match the bcrypt hash currently stored for `office@cyprusvipestates.com`.

Checked in order:
1. **User row exists?** Yes — `office@cyprusvipestates.com`, role `ADMIN`.
2. **Is it active?** Yes — `isActive: true`.
3. **Is the stored hash well-formed?** Yes — valid bcrypt format (`$2b$10$...`, 60 chars), not corrupted or empty.
4. **Does `.env`'s current `ADMIN_PASSWORD` (12 characters, meets the seed script's minimum) match that hash via `bcrypt.compare`?** **No.**

This is unambiguously a **stale-credential mismatch**, not a broken account, missing seed, or code regression — and it's identical on both staging and production, since it's the same DB row. Two real admin users exist in total; the other, `info@bandziuk.com`, was last updated 2026-07-15 (yesterday) — plausibly the site owner's own real, working login, separate from this bootstrap account entirely.

One data point worth surfacing, without overclaiming a cause: `office@cyprusvipestates.com`'s row shows `updatedAt: 2026-07-16T02:20:07Z` — earlier this morning, before any of today's Phase 0–3 work began (~03:xx onward). I did not touch any `User` row before this diagnostic. Something updated that row this morning; `updatedAt` bumps on any field change (role/isActive/name/phone/photoPng — not necessarily the password), so this alone doesn't prove *when* the password specifically diverged from `.env`. I'm not able to pin down more than that from the DB state alone.

**Not fixed** (diagnose-only, per instructions). Whenever convenient: either re-run `prisma/seed-admin.mjs` with the `.env` value (which will overwrite the DB hash to match `.env` — destructive to whatever the DB currently has), or update `.env`'s `ADMIN_PASSWORD` to match whatever the account's real current password is (non-destructive) — the owner should decide which, since it's not knowable from here which value is the "correct" one to keep.

---

## 5. Cleanup

Deleted the smoke-test lead `75a7831a-e12d-4c0c-9ecb-c26fc3af38cd` (`SMOKE TEST - ignore` / `Phase3 Merge Verification`) and its associated `LeadActivity` rows. Confirmed gone.

---

## Amended Phase 3 retry procedure

Same as the original plan (3.1 isolated build → pre-flight → 3.3 atomic swap → 3.4 smoke test), with one new mandatory step inserted **before the swap is allowed to proceed**:

### New step 3.2.5 — pre-swap runtime-asset verification (hard gate)

Port the two confirmed-needed files into the repo first:
- `public/fonts/DejaVuSans.ttf` — copy from `/var/www/cyprusvipestates-broken-20260716/public/fonts/DejaVuSans.ttf` (or the pre-merge production tree) into the repo at the same path, commit.
- `public/medousa-feed.xml` — copy from `wip/content-imports` (`d12f06d`) into `redesign/home`/the merge-candidate tree specifically (cherry-pick just this one file, not the rest of that branch), commit.

Then, as a hard gate the swap script refuses to proceed past, run a verification script against the **newly-built tree** (`/var/www/cyprusvipestates-next`) before the `mv` swap executes:

```bash
#!/usr/bin/env bash
# scripts/verify-runtime-assets.sh — run against the freshly-built -next tree
# before the atomic swap. Exits non-zero (blocking the swap) if any known
# runtime-only asset (files read via fs.readFile/readFileSync at request time,
# invisible to `next build`'s static import-graph check) is missing.
#
# To extend: search `src/` for readFile/readFileSync/createReadStream calls
# using a literal (non-variable) path argument — grep -rn "readFile(join(" src/
# — and add any new literal path here. This list is not auto-derived on
# purpose: a human should look at each new call site once and decide if it's
# a real fixed dependency (add it) or data-dependent/dynamic (skip it, like
# public/uploads/* which is covered by the stable symlink check below).
set -euo pipefail
TARGET="${1:?usage: verify-runtime-assets.sh <path-to-built-tree>}"

REQUIRED_FILES=(
  "public/fonts/DejaVuSans.ttf"
  "public/medousa-feed.xml"
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
  echo "Refusing to proceed with the swap — one or more runtime assets missing."
  exit 1
fi
echo
echo "All known runtime assets present. Safe to swap."
```

Wire this into the retry as: after 3.1's build completes and pre-flight's uploads-symlink step runs, call `verify-runtime-assets.sh /var/www/cyprusvipestates-next` and require exit 0 before the `mv` commands in 3.3 are allowed to run at all — not just before *reload*, before the swap touches the live directory.

### Everything else unchanged from the original Phase 3 plan
- 3.1 isolated build (capped connection pool, already fixed in Phase 2.4) — unchanged.
- Pre-flight uploads symlink verification — unchanged, already proven correct last attempt (uploads were never the problem).
- 3.3 atomic swap + pm2 reload — unchanged mechanically, just gated by the new step above.
- 3.4 smoke test — unchanged, run the same full checklist. Recommend explicitly adding "PDF brochure download" as a named checklist item this time (it wasn't on the original list — that's exactly how it slipped through), plus a note that admin-login and the `sitemap_index.xml` anomaly are known, pre-existing, non-blocking conditions unrelated to the merge, so they don't need to trigger another rollback if seen again — but should still be reported, not silently skipped.

### Recommended additional step: broaden the retry's own diff check
Before building, re-run the *same unrestricted* rsync dry-run diff (excluding only `node_modules`/`.next`/`.git`/`.env*`/`public/uploads`) used in this investigation as a final pre-build sanity check — cheap, catches anything new that might have landed on production between now and the retry.
