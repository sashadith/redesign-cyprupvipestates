#!/usr/bin/env node
// Hebrew content-pack gate — Hebrew localization Phase 5, Task 1.
//
// Validates every content/he/**/*.he.json file plus
// scripts/faq-translations/he.json against scripts/he-content/lib.mjs's
// mirrorCheck (structure vs. the EN source, when one exists),
// styleCheck (forbidden Hebrew punctuation/wording), linkCheck (only he
// routes/allow-listed links), and metaCheck (SEO title/description length).
//
//   node scripts/qa/he-content-check.mjs                validate the whole pack
//   node scripts/qa/he-content-check.mjs --only <path>   validate only files whose
//                                                         repo-relative path starts
//                                                         with <path> (repeatable)
//
// A pack file without a matching EN source under content/he/source/** (a
// freshly authored landing page with no English counterpart) skips
// mirrorCheck and says so in the summary — style/link/meta checks still run.
//
// Prints `he-content: OK (N files, M strings)` and exits 0 on success, or the
// violations (one per line, with file + path) and exits 1.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mirrorCheck, styleCheck, linkCheck, metaCheck, walkStrings, isLinkKey, orphanMarkDefs } from "../he-content/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTENT_HE_DIR = path.join(ROOT, "content", "he");
const SOURCE_DIR = path.join(CONTENT_HE_DIR, "source");
const FAQ_HE_FILE = path.join(ROOT, "scripts", "faq-translations", "he.json");
const FAQ_EN_FILE = path.join(ROOT, "scripts", "faq-translations", "en.json");

// Pack-only metadata every content/he/**/*.he.json file carries (Global
// Constraints: "review": "pending" on every file) that has no EN-source
// counterpart — stripped before diffing so it never trips mirrorCheck's
// "extra key" check. Top-level only; these never appear nested.
const PACK_METADATA_KEYS = ["review", "translationGroupSlugEn", "parentSlug"];

function stripPackMetadata(json) {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return json;
  const clone = { ...json };
  for (const k of PACK_METADATA_KEYS) delete clone[k];
  return clone;
}

function relPath(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function walkDir(dir, pattern, { skipDirNames = [] } = {}, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirNames.includes(entry.name)) continue;
      walkDir(full, pattern, { skipDirNames }, out);
    } else if (pattern.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectPackFiles() {
  const files = walkDir(CONTENT_HE_DIR, /\.he\.json$/, { skipDirNames: ["source"] });
  if (fs.existsSync(FAQ_HE_FILE)) files.push(FAQ_HE_FILE);
  return files.sort();
}

/** Maps a pack file's absolute path to its EN source file's absolute path,
 *  or null when none is expected/exists yet. */
function sourceFor(file) {
  if (file === FAQ_HE_FILE) return fs.existsSync(FAQ_EN_FILE) ? FAQ_EN_FILE : null;
  const rel = path.relative(CONTENT_HE_DIR, file); // e.g. "singlepages/limassol.he.json"
  const dir = path.dirname(rel);
  const base = path.basename(rel, ".he.json");
  const srcFile = path.join(SOURCE_DIR, dir, `${base}.en.json`);
  return fs.existsSync(srcFile) ? srcFile : null;
}

/** Every string-valued link field in `json` (`href`/`url`/`link`/`*Destination`
 *  — whatever `isLinkKey` recognises), with its dotted/indexed path — walked
 *  separately from walkStrings, which deliberately skips these keys (they're
 *  links, not prose) so styleCheck never runs on a URL.
 *
 *  Every link-like key with a string value is collected, relative or
 *  ABSOLUTE. The earlier form of this condition read
 *  `isLinkKey(k) && … && v.startsWith("/") || (k === "href" || k === "url") && …`,
 *  and because `&&` binds tighter than `||` an absolute URL in a
 *  `*Destination`/`link` key was collected by neither branch — and mirrorCheck
 *  skips link keys too, so nothing validated it at all. */
export function collectLinks(json, path_ = "", out = []) {
  if (json == null || typeof json !== "object") return out;
  if (Array.isArray(json)) {
    json.forEach((v, i) => collectLinks(v, path_ ? `${path_}[${i}]` : `[${i}]`, out));
    return out;
  }
  for (const k of Object.keys(json)) {
    const childPath = path_ ? `${path_}.${k}` : k;
    const v = json[k];
    if (isLinkKey(k) && typeof v === "string") {
      out.push({ href: v, path: childPath });
    } else if (v != null && typeof v === "object") {
      collectLinks(v, childPath, out);
    }
  }
  return out;
}

/** Reads the value a `collectLinks` path points at out of another (EN) JSON
 *  tree, or undefined when the path doesn't resolve there. Used to grant the
 *  one linkCheck exception: an off-site absolute URL kept byte-identical to
 *  the EN source. */
export function valueAtPath(json, dottedPath) {
  let node = json;
  for (const raw of dottedPath.split(".")) {
    // one segment may carry trailing indices: `links[2]`, `[0]`, `a[1][2]`
    const [, name, indices] = /^([^[\]]*)((?:\[\d+\])*)$/.exec(raw) ?? [];
    if (name === undefined) return undefined;
    if (name !== "") {
      if (node == null || typeof node !== "object" || Array.isArray(node)) return undefined;
      node = node[name];
    }
    for (const m of indices.matchAll(/\[(\d+)\]/g)) {
      if (!Array.isArray(node)) return undefined;
      node = node[Number(m[1])];
    }
  }
  return node;
}

function collectPackSlugs(files) {
  const slugs = [];
  for (const f of files) {
    if (!/[\\/](singlepages|case-studies)[\\/]/.test(f)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(f, "utf8"));
      if (typeof json.slug === "string") slugs.push(json.slug);
    } catch {
      // invalid JSON is reported separately below
    }
  }
  return slugs;
}

function main() {
  const args = process.argv.slice(2);
  const onlyPrefixes = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--only" && args[i + 1]) onlyPrefixes.push(args[++i]);
  }

  const allFiles = collectPackFiles();
  const packSlugs = collectPackSlugs(allFiles);

  const files = onlyPrefixes.length ? allFiles.filter((f) => onlyPrefixes.some((p) => relPath(f).startsWith(p))) : allFiles;

  const violations = [];
  const notes = [];
  let totalStrings = 0;

  for (const file of files) {
    const rel = relPath(file);
    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      violations.push(`${rel}: invalid JSON — ${e.message}`);
      continue;
    }

    const srcFile = sourceFor(file);
    let enJson;
    if (srcFile) {
      try {
        enJson = JSON.parse(fs.readFileSync(srcFile, "utf8"));
      } catch (e) {
        violations.push(`${rel}: source ${relPath(srcFile)} is invalid JSON — ${e.message}`);
        enJson = undefined;
      }
      if (enJson !== undefined) {
        const stats = { keptIdentical: [] };
        for (const v of mirrorCheck(stripPackMetadata(enJson), stripPackMetadata(json), "", stats)) {
          violations.push(`${rel}: ${v}`);
        }
        if (stats.keptIdentical.length) {
          notes.push(`${rel}: ${stats.keptIdentical.length} string(s) kept identical to EN (enum values, names, tokens) — e.g. ${stats.keptIdentical.slice(0, 3).join(", ")}`);
        }
      }
    } else {
      notes.push(`${rel}: no EN source — skipping mirrorCheck`);
    }

    walkStrings(json, (str, p) => {
      totalStrings++;
      for (const v of styleCheck(str, p)) violations.push(`${rel}: ${v}`);
    });

    for (const { href, path: p } of collectLinks(json)) {
      // The EN value at the same path (when there is an EN source) is the only
      // thing that can excuse an off-site absolute URL — see linkCheck.
      const enHref = enJson === undefined ? null : valueAtPath(enJson, p);
      const v = linkCheck(href, packSlugs, typeof enHref === "string" ? enHref : null);
      if (v) violations.push(`${rel}: ${p}: ${v}`);
    }
    for (const v of orphanMarkDefs(json)) violations.push(`${rel}: ${v}`);

    if (json && typeof json === "object" && !Array.isArray(json) && json.seo) {
      for (const v of metaCheck(json.seo)) violations.push(`${rel}: ${v}`);
    }
  }

  if (notes.length) {
    console.log(notes.join("\n"));
  }

  if (violations.length) {
    console.error(`he-content: ${violations.length} violation(s) across ${files.length} file(s):`);
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }

  console.log(`he-content: OK (${files.length} files, ${totalStrings} strings)`);
}

// Only run the gate when invoked as a script — the tests import collectLinks/
// valueAtPath from here and must not trigger a full pack scan on import.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
