#!/usr/bin/env node
// LTR copy-table snapshot gate — Hebrew localization Phase 4, Task 1.
//
// Invocation (the copy modules this walks are TypeScript, so the script
// itself must run under tsx even though this file is plain JS):
//   node --import tsx scripts/qa/copy-snapshot.mjs --write   regenerate scripts/qa/copy-snapshot.json
//   node --import tsx scripts/qa/copy-snapshot.mjs --check   diff against it; exit 1 on any difference
//   node --import tsx scripts/qa/copy-snapshot.mjs --write --only <path> [--only <path> ...]
//                                                             regenerate ONLY the given module path(s)'
//                                                             entries, leaving every other module's
//                                                             existing baseline keys untouched — for
//                                                             registering newly-added copy modules
//                                                             without racing a concurrent editor's
//                                                             changes to other modules' tables.
//
// Walks every module listed in scripts/qa/copy-modules.json for the en/de/pl/ru
// leaf strings (Hebrew is deliberately excluded — `he` entries are expected to
// change constantly as WP1-WP7 translate them; he-meta-length.mjs is the
// he-specific gate) and snapshots them, sorted and deterministic, so a later
// refactor (type hardening, ternary-to-table lifting, …) that accidentally
// reflows or rewords an English/German/Polish/Russian string fails this gate
// instead of shipping a silent LTR regression.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, isPlainObject, isLocaleMap, forEachModuleExport } from "./copy-modules-loader.mjs";

const SNAPSHOT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "copy-snapshot.json");

export const SNAPSHOT_LOCALES = ["en", "de", "pl", "ru"];

/** Fixed sample args every copy-table function leaf is invoked with, per the
 *  Phase 4 plan: (name, url, count). Extra/unused args are harmless — plain
 *  JS ignores parameters a function doesn't declare. */
export const SAMPLE_ARGS = ["Sample", "https://x", 3];

/**
 * Collects every string leaf reachable from `obj` for one `locale`, as a flat
 * `{ "dotted.path": "leaf string" }` map.
 *
 * - A node whose own keys are exactly a subset of the site's locale codes
 *   (and includes "en") is a locale branch: only `node[locale]` is descended
 *   into (falling back to `node.en` when that locale isn't present yet — e.g.
 *   `he` before a WP adds it), and the path gains no segment for the locale
 *   itself. This covers a module exported directly as `{en,de,pl,ru,…}`
 *   (e.g. `DEVELOPMENT_STRINGS`) and one keyed by section first, locale
 *   second (e.g. `SectionLinks`'s `HEADINGS.section.{en,de,pl,ru}`).
 * - A function leaf is invoked with `SAMPLE_ARGS`; its return value is walked
 *   the same way a plain value would be — a string is recorded, an object
 *   (e.g. `PRESENTATION_EMAIL_TEMPLATE`'s `{subject, body}`) recurses.
 * - Arrays are walked by index.
 */
export function collectLeaves(obj, locale, prefix = "", out = {}) {
  if (obj == null) return out;
  if (isLocaleMap(obj)) {
    const branch = Object.prototype.hasOwnProperty.call(obj, locale) ? obj[locale] : obj.en;
    return collectLeaves(branch, locale, prefix, out);
  }
  if (typeof obj === "function") {
    let result;
    try {
      result = obj(...SAMPLE_ARGS);
    } catch (e) {
      out[prefix || "(root)"] = `<function threw: ${e.message}>`;
      return out;
    }
    return collectLeaves(result, locale, prefix, out);
  }
  if (typeof obj === "string") {
    out[prefix || "(root)"] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectLeaves(v, locale, prefix ? `${prefix}.${i}` : String(i), out));
    return out;
  }
  if (isPlainObject(obj)) {
    for (const k of Object.keys(obj)) {
      collectLeaves(obj[k], locale, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  // numbers, booleans, etc. — not copy
  return out;
}

async function buildSnapshot() {
  const snapshot = {};
  const { skipped } = await forEachModuleExport((exportName, value, entry) => {
    for (const locale of SNAPSHOT_LOCALES) {
      const leaves = collectLeaves(value, locale);
      for (const [leafPath, str] of Object.entries(leaves)) {
        snapshot[`${entry.path}::${exportName}::${locale}::${leafPath}`] = str;
      }
    }
  });
  return { snapshot, skipped };
}

/** Every `--only <path>` value passed on the command line. Repeatable. */
function collectOnlyPaths(args) {
  const only = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only" && args[i + 1]) only.push(args[i + 1]);
  }
  return only;
}

/** A snapshot key's module path is everything before the first "::". */
function keyPath(key) {
  return key.split("::")[0];
}

function sortedJson(obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return JSON.stringify(sorted, null, 2) + "\n";
}

function countsByLocale(snapshot) {
  const counts = {};
  for (const key of Object.keys(snapshot)) {
    const locale = key.split("::")[2];
    counts[locale] = (counts[locale] ?? 0) + 1;
  }
  return counts;
}

function reportSkipped(skipped) {
  if (!skipped.length) return;
  console.log(`\nSkipped modules (${skipped.length}):`);
  for (const s of skipped) console.log(`  ${s.path} — ${s.reason}`);
}

async function main() {
  const args = process.argv.slice(2);
  const onlyPaths = collectOnlyPaths(args);
  const { snapshot, skipped } = await buildSnapshot();

  if (args.includes("--write")) {
    let toWrite = snapshot;
    if (onlyPaths.length) {
      // Merge into the existing baseline: drop only the keys belonging to
      // the given module path(s), then add back the freshly computed keys
      // for those same paths. Every other module's entries are left exactly
      // as they were on disk — this is what makes --write --only safe to run
      // while another task's edits to different modules are in flight.
      const existing = existsSync(SNAPSHOT_PATH)
        ? JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"))
        : {};
      const merged = {};
      for (const [k, v] of Object.entries(existing)) {
        if (!onlyPaths.includes(keyPath(k))) merged[k] = v;
      }
      for (const [k, v] of Object.entries(snapshot)) {
        if (onlyPaths.includes(keyPath(k))) merged[k] = v;
      }
      toWrite = merged;
    }
    writeFileSync(SNAPSHOT_PATH, sortedJson(toWrite));
    console.log(`Wrote ${Object.keys(toWrite).length} leaves to ${path.relative(ROOT, SNAPSHOT_PATH)}`);
    if (onlyPaths.length) console.log(`  (--only: ${onlyPaths.join(", ")})`);
    for (const [locale, n] of Object.entries(countsByLocale(toWrite)).sort()) {
      console.log(`  ${locale}: ${n}`);
    }
    reportSkipped(skipped);
    return;
  }

  if (args.includes("--check")) {
    if (!existsSync(SNAPSHOT_PATH)) {
      console.error(`No snapshot at ${path.relative(ROOT, SNAPSHOT_PATH)}; run --write first.`);
      process.exit(1);
    }
    const existing = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    const keys = new Set([...Object.keys(existing), ...Object.keys(snapshot)]);
    const diffs = [];
    for (const k of keys) {
      if (existing[k] !== snapshot[k]) diffs.push({ key: k, before: existing[k], after: snapshot[k] });
    }
    if (diffs.length) {
      console.error(`copy-snapshot: ${diffs.length} difference(s) from ${path.relative(ROOT, SNAPSHOT_PATH)}:`);
      for (const d of diffs.slice(0, 20)) {
        console.error(`  ${d.key}`);
        console.error(`    before: ${JSON.stringify(d.before)}`);
        console.error(`    after:  ${JSON.stringify(d.after)}`);
      }
      if (diffs.length > 20) console.error(`  … and ${diffs.length - 20} more`);
      process.exit(1);
    }
    console.log(`copy-snapshot: clean (${Object.keys(snapshot).length} leaves match).`);
    reportSkipped(skipped);
    return;
  }

  console.error(
    "Usage: node --import tsx scripts/qa/copy-snapshot.mjs --write|--check [--only <path> ...]",
  );
  process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
