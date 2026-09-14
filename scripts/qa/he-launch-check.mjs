#!/usr/bin/env node
// Hebrew localization Phase 8/9 — launch guard (plan
// docs/superpowers/plans/2026-09-14-hebrew-phase7-8-pipeline-seo.md, Task 5;
// spec docs/superpowers/specs/2026-09-13-hebrew-localization-design.md §5
// Phase 8/9). Read-only, no database, no build: it only spawns other QA
// scripts and reads files already in the repo.
//
// Local mode (default) runs six checks that need nothing but this checkout:
//   (a) TODO(he) placeholders  — scripts/qa/he-placeholders.mjs --todo-only
//   (b) Hebrew content gate    — scripts/qa/he-content-check.mjs
//   (c) RTL physical count     — scripts/qa/rtl-physical-count.mjs --strict
//   (d) review metadata        — every content/he/**/*.he.json carries "review"
//       + content protocols    — every pack in PACKS has a docs/i18n/reviews/c-<pack>.md
//   (e) nginx locale rule      — ops/nginx/cyprusvipestates.conf routes "he"
//   (f) locale-plumbing tests  — src/lib/__tests__/seoLocalePlumbing.test.ts exists
//       (`npm test` itself is NOT run here — too slow for a guard script;
//       this only checks the Task 2 test file is present, i.e. was not
//       deleted/renamed since)
//
// `--host <url>` additionally runs two NETWORK checks against that host:
//   scripts/qa/hreflang-check.mjs <host>
//   scripts/qa/he-smoke.sh <host> live
// Never pass --host against production, and never run this repo's own
// process against a host unless told to — the default (no --host) touches
// nothing but the local filesystem.
//
// Known scope approximations against spec §5 Phase 8 (accepted, Task 5 review):
//   - "no he URL without an hreflang backlink from en" is verified ONLY in
//     --host mode (hreflang-check.mjs samples live pages); local mode cannot
//     see rendered alternates and does not claim to.
//   - "every he PUBLISHED row has a review protocol" is approximated at pack
//     level: each content/he/**/*.he.json carries "review" metadata and each
//     pack has its docs/i18n/reviews/c-<pack>.md — no database read here.
//
// Usage:
//   node scripts/qa/he-launch-check.mjs
//   node scripts/qa/he-launch-check.mjs --host https://design.cyprusvipestates.com
//
// Prints a `check | status | detail` table and exits 1 if any check fails.
//
// Pure helpers (no I/O — safe to unit-test with fixtures) are exported for
// scripts/qa/__tests__/he-launch.test.mjs: checkReviewMetadata, checkProtocols,
// checkNginx, summarize. Everything below the "I/O below this line" marker
// touches the filesystem, spawns processes, or calls process.exit.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// The six Phase 5 content packs (docs/i18n/reviews/README.md, "Content-Pakete"
// table) — every one must have a `c-<pack>.md` Pass-C review protocol.
export const PACKS = ["site-documents", "faq", "case-studies", "landing-a", "landing-b", "legal"];

/**
 * `files`: an array of `{ path, json }` for already-read/parsed
 * content/he/**\/*.he.json files. Returns the paths that do NOT carry a
 * non-empty string `"review"` field.
 *
 * scripts/faq-translations/he.json is deliberately NOT part of this check —
 * per docs/i18n/reviews/README.md it is rebuilt strictly from en.json (an
 * extra top-level field would be silently discarded), so its review status
 * lives only in the c-faq.md protocol, not in the file itself.
 */
export function checkReviewMetadata(files) {
  const missing = [];
  for (const { path: p, json } of files) {
    const isPlainObject = json !== null && typeof json === "object" && !Array.isArray(json);
    const review = isPlainObject ? json.review : undefined;
    if (typeof review !== "string" || review.length === 0) missing.push(p);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Every name in `packs` must have a `c-<name>.md` file directly inside
 * `dir` (docs/i18n/reviews/). A non-existent `dir` counts every pack as
 * missing rather than throwing.
 */
export function checkProtocols(packs, dir) {
  let existing;
  try {
    existing = new Set(readdirSync(dir));
  } catch {
    existing = new Set();
  }
  const missing = packs.filter((p) => !existing.has(`c-${p}.md`));
  return { ok: missing.length === 0, missing };
}

/**
 * The nginx non-default-locale rule (ops/nginx/cyprusvipestates.conf) must
 * route `he` alongside de/pl/ru, e.g. `location ~ ^/(de|pl|ru|he)(/|$)` —
 * even though the app itself still 404s on /he while
 * NEXT_PUBLIC_LIVE_LOCALES gates it out (harmless, per the comment above
 * that line in the conf file). Looks for ANY `(a|b|c)(/|$)`-shaped
 * two-letter-code alternation group and checks "he" is a member, rather than
 * matching the literal string "de|pl|ru|he", so a harmless reordering of the
 * codes doesn't false-fail this check.
 */
export function checkNginx(confText) {
  const re = /\(([a-z]{2}(?:\|[a-z]{2})*)\)\(\/\|\$\)/g;
  let m;
  while ((m = re.exec(confText))) {
    const codes = m[1].split("|");
    if (codes.includes("he")) return { ok: true, detail: `locale rule includes "he": (${m[1]})(/|$)` };
  }
  return { ok: false, detail: 'no locale-alternation rule ~ ^/(xx|yy)(/|$) containing "he" found' };
}

/**
 * Renders `results` (`{ check, status: "PASS"|"FAIL", detail }[]`) as a
 * fixed-width `check | status | detail` table and reports whether every row
 * passed. Pure — no I/O, no process.exit.
 */
export function summarize(results) {
  const checkW = Math.max(5, ...results.map((r) => r.check.length));
  const statusW = 6;
  const lines = [
    `${"check".padEnd(checkW)} | ${"status".padEnd(statusW)} | detail`,
    `${"-".repeat(checkW)}-+-${"-".repeat(statusW)}-+-${"-".repeat(6)}`,
  ];
  for (const r of results) {
    lines.push(`${r.check.padEnd(checkW)} | ${r.status.padEnd(statusW)} | ${r.detail}`);
  }
  return { text: lines.join("\n"), ok: results.every((r) => r.status === "PASS") };
}

// ---------------------------------------------------------------------------
// I/O below this line — filesystem, child processes, process.argv/exit.

function runNode(scriptRelPath, args = []) {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, scriptRelPath), ...args], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (e) {
    return { code: typeof e.status === "number" ? e.status : 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function runBash(scriptRelPath, args = []) {
  try {
    const out = execFileSync("bash", [path.join(ROOT, scriptRelPath), ...args], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (e) {
    return { code: typeof e.status === "number" ? e.status : 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function lastNonEmptyLine(s) {
  const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "(no output)";
}

/** Every content/he/**\/*.he.json file, excluding content/he/source/** (EN
 *  snapshots, not pack files — see content/he/README.md). */
function collectHeJsonFiles() {
  const contentDir = path.join(ROOT, "content", "he");
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "source") continue;
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith(".he.json")) {
        out.push(path.join(dir, entry.name));
      }
    }
  }
  walk(contentDir);
  return out.sort();
}

function parseArgs(argv) {
  const hostIdx = argv.indexOf("--host");
  if (hostIdx === -1) return { host: null };
  const host = argv[hostIdx + 1];
  if (!host || host.startsWith("--")) {
    throw new Error("--host requires a URL argument, e.g. --host https://design.cyprusvipestates.com");
  }
  return { host: host.replace(/\/+$/, "") };
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error("Usage: node scripts/qa/he-launch-check.mjs [--host <url>]");
    process.exit(1);
  }

  const results = [];

  // (a) TODO(he) placeholders must be 0. REVIEW(he) markers are expected to
  // remain until Pass C (native review) — see docs/i18n/launch-checklist.md
  // "REVIEW(he) removal policy" — so this uses --todo-only, not --strict.
  {
    const r = runNode("scripts/qa/he-placeholders.mjs", ["--todo-only"]);
    const totals = r.out.split("\n").find((l) => l.startsWith("TODO(he):"));
    results.push({ check: "placeholders (TODO=0)", status: r.code === 0 ? "PASS" : "FAIL", detail: totals ?? lastNonEmptyLine(r.out) });
  }

  // (b) Hebrew content-pack gate (structure/style/links/meta).
  {
    const r = runNode("scripts/qa/he-content-check.mjs");
    results.push({ check: "content gate", status: r.code === 0 ? "PASS" : "FAIL", detail: lastNonEmptyLine(r.out) });
  }

  // (c) RTL physical-declaration count must be zero (Phase 2b).
  {
    const r = runNode("scripts/qa/rtl-physical-count.mjs", ["--strict"]);
    results.push({ check: "rtl-physical --strict", status: r.code === 0 ? "PASS" : "FAIL", detail: lastNonEmptyLine(r.out) });
  }

  // (d) every content/he/**/*.he.json carries "review" metadata + every
  // pack has its c-*.md protocol.
  {
    const files = collectHeJsonFiles().map((abs) => {
      let json = null;
      try {
        json = JSON.parse(readFileSync(abs, "utf8"));
      } catch {
        json = null;
      }
      return { path: path.relative(ROOT, abs), json };
    });
    const review = checkReviewMetadata(files);
    results.push({
      check: "review metadata",
      status: review.ok ? "PASS" : "FAIL",
      detail: review.ok
        ? `${files.length}/${files.length} content/he/**/*.he.json files carry "review"`
        : `missing on: ${review.missing.join(", ")}`,
    });

    const reviewsDir = path.join(ROOT, "docs", "i18n", "reviews");
    const protocols = checkProtocols(PACKS, reviewsDir);
    results.push({
      check: "content protocols",
      status: protocols.ok ? "PASS" : "FAIL",
      detail: protocols.ok
        ? `${PACKS.length}/${PACKS.length} packs have a c-*.md protocol`
        : `missing: ${protocols.missing.map((p) => `c-${p}.md`).join(", ")}`,
    });
  }

  // (e) nginx locale rule includes "he".
  {
    let confText = "";
    try {
      confText = readFileSync(path.join(ROOT, "ops", "nginx", "cyprusvipestates.conf"), "utf8");
    } catch {
      confText = "";
    }
    const nginx = checkNginx(confText);
    results.push({ check: "nginx he rule", status: nginx.ok ? "PASS" : "FAIL", detail: nginx.detail });
  }

  // (f) Task 2's locale-plumbing test file still exists (npm test itself is
  // NOT run here — too slow for a guard script).
  {
    const testPath = path.join(ROOT, "src", "lib", "__tests__", "seoLocalePlumbing.test.ts");
    const ok = existsSync(testPath);
    results.push({
      check: "seoLocalePlumbing test",
      status: ok ? "PASS" : "FAIL",
      detail: ok ? "src/lib/__tests__/seoLocalePlumbing.test.ts exists" : "MISSING — run `npm test` to check locale plumbing manually",
    });
  }

  // --host mode: network-touching checks against a live/staging host only.
  if (opts.host) {
    const hf = runNode("scripts/qa/hreflang-check.mjs", [opts.host]);
    const hfSummary = hf.out.split("\n").find((l) => /pairs checked/.test(l));
    results.push({ check: "hreflang-check --host", status: hf.code === 0 ? "PASS" : "FAIL", detail: hfSummary ?? lastNonEmptyLine(hf.out) });

    const smoke = runBash("scripts/qa/he-smoke.sh", [opts.host, "live"]);
    results.push({ check: "he-smoke.sh live", status: smoke.code === 0 ? "PASS" : "FAIL", detail: lastNonEmptyLine(smoke.out) });
  }

  const { text, ok } = summarize(results);
  console.log(text);
  console.log(ok ? "\nhe-launch-check: PASS — all checks green" : "\nhe-launch-check: FAIL — see above");
  process.exit(ok ? 0 : 1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
