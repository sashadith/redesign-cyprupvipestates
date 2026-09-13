#!/usr/bin/env node
// RTL acceptance gate: counts remaining PHYSICAL (left/right-anchored) CSS
// declarations across the in-scope stylesheets for the Hebrew RTL layout
// pass (Phase 2 of the Hebrew localization plan — see
// docs/superpowers/plans/2026-09-13-hebrew-phase2-rtl.md, Global Constraints
// + File map). Used as: a --list source for the codemod's file arguments, a
// per-file/total report while manual fixes land, and a --strict CI-style
// gate (exit 1 while any unconverted/unexempted declaration remains).
//
// Scope (hard-coded — mirrors the plan's Global Constraints):
//   src/app/[lang], the seven src/app/preview-*/[lang] trees, preview-home
//   (its CSS only — the standalone layout/page are TSX and irrelevant here),
//   preview-insights, preview-projects, preview-project, components (minus
//   the dead component directories below), plus header-footer.css,
//   globals.css, rtl.css.
// Excluded roots (never scanned): admin, sandbox*, style, book, c — these
// simply aren't in SCOPE_DIRS below, so no separate filter is needed for
// them. Dead components ARE inside the "components" scope root, so they are
// filtered out explicitly.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(new URL(".", import.meta.url).pathname, "..", "..");

const SCOPE_DIRS = [
  "src/app/[lang]",
  "src/app/preview-about/[lang]",
  "src/app/preview-case-studies/[lang]",
  "src/app/preview-contacts/[lang]",
  "src/app/preview-faq/[lang]",
  "src/app/preview-landing/[lang]",
  "src/app/preview-legal/[lang]",
  "src/app/preview-partners/[lang]",
  "src/app/preview-home",
  "src/app/preview-insights",
  "src/app/preview-projects",
  "src/app/preview-project",
  "src/app/components",
];

const SCOPE_FILES = [
  "src/app/header-footer.css",
  "src/app/globals.css",
  "src/app/rtl.css",
];

// Dead components (never routed to; see Global Constraints) — excluded even
// though they live under the in-scope "components" root.
const DEAD_COMPONENTS = [
  "NewListnigs", "ProjectLinkAll", "BrochureBlock", "CitiesHomepage",
  "LocaleSwitcher", "DeveloperIntro", "BlogIntro", "AnimatedPreview", "HomepageHero",
];
const EXCLUDE_PATH_PARTS = DEAD_COMPONENTS.map((name) => `src/app/components/${name}/`);

const CSS_EXT = /\.(css|scss)$/;

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (CSS_EXT.test(entry)) {
      out.push(full);
    }
  }
}

function resolveScopeFiles() {
  const files = [];
  for (const dir of SCOPE_DIRS) {
    const abs = join(REPO_ROOT, dir);
    if (existsSync(abs)) walk(abs, files);
  }
  for (const f of SCOPE_FILES) {
    const abs = join(REPO_ROOT, f);
    if (existsSync(abs)) files.push(abs);
  }
  const rel = files.map((f) => relative(REPO_ROOT, f));
  const excluded = rel.filter((r) => !EXCLUDE_PATH_PARTS.some((part) => r.includes(part)));
  // stable, de-duplicated, sorted order
  return [...new Set(excluded)].sort();
}

/* ---------------- physical-property families ---------------- */
// Each family is checked per-line (not globally) so a --exceptions entry can
// suppress specific lines (e.g. a decorative ::before/::after blob) without
// hiding every match in the file.
const FAMILIES = [
  // margin-left/right, padding-left/right, border-left/right (+ -width/
  // -style/-color suffixes) — the same physical declarations rtl-logical.mjs
  // converts to logical ones. Anchored so it can never match a shorthand
  // ("margin: 0 auto") or a border-radius corner ("border-top-left-radius").
  { name: "margin/padding/border-left|right", re: /\b(?:margin|padding|border)-(?:left|right)\b/g },
  { name: "text-align: left|right", re: /text-align\s*:\s*(?:left|right)\b/g },
  { name: "float: left|right", re: /float\s*:\s*(?:left|right)\b/g },
  // bare physical offsets — "left: 0" / "right: 10px" — NOT "margin-left:"
  // (the char before left/right must be line-start or whitespace, never "-").
  { name: "left:/right: (bare offset)", re: /(?:^|\s)(?:left|right)\s*:/g },
  { name: "translateX(", re: /translateX\(/g },
  { name: "row-reverse", re: /row-reverse/g },
  { name: "background-position: right", re: /background-position\s*:\s*right\b/g },
];

function countFamiliesInLine(line) {
  let n = 0;
  for (const { re } of FAMILIES) {
    re.lastIndex = 0;
    const matches = line.match(re);
    if (matches) n += matches.length;
  }
  return n;
}

/* ---------------- exceptions file ---------------- */
// Format: "path :: substring" — a line in `path` containing `substring` is
// exempted from the count. Blank lines and lines starting with # are
// comments. `path` is matched as a suffix of the scanned file's repo-relative
// path (so "tokens.css :: decorative" and "src/app/preview-home/tokens.css
// :: decorative" both work).
function loadExceptions(exceptionsPath) {
  if (!existsSync(exceptionsPath)) return [];
  const raw = readFileSync(exceptionsPath, "utf8");
  const out = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("::");
    if (idx === -1) continue;
    const path = trimmed.slice(0, idx).trim();
    const substring = trimmed.slice(idx + 2).trim();
    if (path && substring) out.push({ path, substring });
  }
  return out;
}

function isExempt(relPath, line, exceptions) {
  return exceptions.some(
    (ex) => (relPath === ex.path || relPath.endsWith(`/${ex.path}`)) && line.includes(ex.substring),
  );
}

function countFile(absPath, relPath, exceptions) {
  const src = readFileSync(absPath, "utf8");
  let total = 0;
  for (const line of src.split("\n")) {
    if (isExempt(relPath, line, exceptions)) continue;
    total += countFamiliesInLine(line);
  }
  return total;
}

/* ---------------- centring invariant ---------------- */
// C1 (phase-2 final-review): a box centred with `transform: translateX(-50%)`
// must be anchored on physical `left: 50%` — never `inset-inline-start: 50%`,
// which resolves to `right: 50%` under `dir="rtl"` and mis-centres the box
// (the RTL bug that C1 fixed). This is a mechanical trip-wire so a future
// "logicalize everything" pass can't reintroduce the same bug: it scans every
// in-scope file's CSS rule bodies (a simple regex over `{...}` blocks — good
// enough for the leaf declaration blocks this pattern lives in; it does not
// need to understand nesting) for a block containing BOTH
// `inset-inline-start: 50%` AND `translateX(-50%)`, which is exactly the
// broken combination.
const BLOCK_RE = /\{([^{}]*)\}/g;

function scanCentringInvariant(src) {
  const violations = [];
  BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = BLOCK_RE.exec(src))) {
    const body = m[1];
    if (body.includes("inset-inline-start: 50%") && body.includes("translateX(-50%)")) {
      const anchorOffset = m.index + 1 + body.indexOf("inset-inline-start: 50%");
      const line = src.slice(0, anchorOffset).split("\n").length;
      violations.push(line);
    }
  }
  return violations;
}

/* ---------------- CLI ---------------- */
function main() {
  const args = process.argv.slice(2);
  const list = args.includes("--list");
  const strict = args.includes("--strict");

  const files = resolveScopeFiles();

  if (list) {
    for (const f of files) console.log(f);
    return;
  }

  const exceptions = loadExceptions(join(REPO_ROOT, "scripts/qa/rtl-exceptions.txt"));

  let grandTotal = 0;
  const rows = [];
  let hasCentringViolation = false;
  for (const rel of files) {
    const abs = join(REPO_ROOT, rel);
    const src = readFileSync(abs, "utf8");
    const count = countFile(abs, rel, exceptions);
    if (count > 0) rows.push({ rel, count });
    grandTotal += count;

    for (const line of scanCentringInvariant(src)) {
      hasCentringViolation = true;
      console.log(`CENTRING-INVARIANT VIOLATION ${rel}:${line}`);
    }
  }

  rows.sort((a, b) => b.count - a.count);
  const width = Math.max(4, ...rows.map((r) => String(r.count).length));
  for (const { rel, count } of rows) {
    console.log(`${String(count).padStart(width)}  ${rel}`);
  }
  console.log(`${"-".repeat(width)}`);
  console.log(`${String(grandTotal).padStart(width)}  TOTAL (${files.length} files scanned, ${exceptions.length} exception rule(s))`);

  if (strict && (grandTotal > 0 || hasCentringViolation)) {
    process.exit(1);
  }
}

main();
