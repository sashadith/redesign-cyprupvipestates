#!/usr/bin/env node
// Hebrew meta-length gate — Hebrew localization Phase 4, Task 1.
//
// Invocation (loads the same TypeScript copy modules copy-snapshot.mjs does):
//   node --import tsx scripts/qa/he-meta-length.mjs
//
// For every module listed in scripts/qa/copy-modules.json, walks its `he`
// branch ONLY where a locale-map node already has its own `he` key (no
// falling back to `en` — an English string checked under the "he" label
// would be a meaningless length check, and would make this gate flap as
// soon as an unrelated EN copy edit crossed 60/155 chars). Wherever that `he`
// branch has a field named `metaTitle`/`title` (the two used for `<title>`)
// or `metaDescription`, its length is grapheme-counted (Intl.Segmenter, not
// UTF-16 code units — Hebrew niqqud/ligatures would otherwise overcount) and
// checked against the SEO limits from docs/superpowers/plans/2026-09-13-hebrew-phase4-copy.md
// (title <= 60, description <= 155).
//
// Today no module's `he` branch carries a metaTitle/title/metaDescription
// field (the handful of modules with a `he` key at all — developmentCopy.ts,
// crm/presentationMessages.ts, crm/bookingMessages.ts, c/[token]/copy.ts,
// book/[token]/copy.ts — are transactional/UI copy, not SEO meta; the SEO
// tables — FAQ_COPY, CASE_STUDIES_COPY, PARTNERS_COPY — don't have a `he` key
// yet). So this reports 0 checks and exits 0 until a later WP task adds
// translated Hebrew SEO strings.
import { isPlainObject, isLocaleMap, forEachModuleExport } from "./copy-modules-loader.mjs";
import { SAMPLE_ARGS } from "./copy-snapshot.mjs";

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;
const TITLE_KEY = /^(metaTitle|title)$/;
const DESCRIPTION_KEY = /^metaDescription$/;

const segmenter = new Intl.Segmenter("he", { granularity: "grapheme" });
function graphemeLength(s) {
  let n = 0;
  // eslint-disable-next-line no-unused-vars
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

/** Finds every metaTitle/title/metaDescription STRING field inside the `he`
 *  branch(es) of `obj` — recursing into nested objects/arrays, taking only a
 *  locale-map node's own `he` key (never a fallback), and invoking function
 *  leaves with the fixed sample args first. */
function collectHeMetaFields(obj, prefix = "", out = []) {
  if (obj == null) return out;
  if (isLocaleMap(obj)) {
    if (!Object.prototype.hasOwnProperty.call(obj, "he")) return out; // no Hebrew entry yet — nothing to check
    return collectHeMetaFields(obj.he, prefix, out);
  }
  if (typeof obj === "function") {
    let result;
    try {
      result = obj(...SAMPLE_ARGS);
    } catch {
      return out;
    }
    return collectHeMetaFields(result, prefix, out);
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectHeMetaFields(v, prefix ? `${prefix}.${i}` : String(i), out));
    return out;
  }
  if (isPlainObject(obj)) {
    for (const k of Object.keys(obj)) {
      const childPath = prefix ? `${prefix}.${k}` : k;
      const v = obj[k];
      if (typeof v === "string") {
        if (TITLE_KEY.test(k)) out.push({ path: childPath, kind: "title", limit: TITLE_MAX, value: v });
        else if (DESCRIPTION_KEY.test(k)) out.push({ path: childPath, kind: "metaDescription", limit: DESCRIPTION_MAX, value: v });
      }
      collectHeMetaFields(v, childPath, out);
    }
    return out;
  }
  return out;
}

async function main() {
  const violations = [];
  let checked = 0;
  const { skipped } = await forEachModuleExport((exportName, value, entry) => {
    const fields = collectHeMetaFields(value);
    for (const f of fields) {
      checked++;
      const len = graphemeLength(f.value);
      if (len > f.limit) {
        violations.push({ module: entry.path, export: exportName, ...f, length: len });
      }
    }
  });

  console.log(`he-meta-length: ${checked} check(s) across ${skipped.length ? "modules (some skipped, see below)" : "modules"}.`);
  if (skipped.length) {
    console.log(`Skipped modules (${skipped.length}):`);
    for (const s of skipped) console.log(`  ${s.path} — ${s.reason}`);
  }

  if (violations.length) {
    console.error(`\n${violations.length} violation(s):`);
    for (const v of violations) {
      console.error(`  ${v.module}::${v.export}::${v.path} (${v.kind}, limit ${v.limit}) — ${v.length} graphemes`);
      console.error(`    "${v.value}"`);
    }
    process.exit(1);
  }

  console.log("he-meta-length: clean.");
}

main();
