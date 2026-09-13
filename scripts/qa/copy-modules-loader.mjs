// Shared module-loading + tree helpers for the Phase 4 copy gates
// (copy-snapshot.mjs and he-meta-length.mjs both need this: read
// copy-modules.json, dynamic-import each listed module through tsx, and walk
// the exported locale tables the same way).
//
// This file is plain JS (no TypeScript syntax) so it never itself needs tsx
// to load — only the *.ts copy modules it dynamically imports do. Run the
// scripts that use it as:
//   node --import tsx scripts/qa/copy-snapshot.mjs --write|--check
//   node --import tsx scripts/qa/he-meta-length.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");
export const MODULES_PATH = path.join(__dirname, "copy-modules.json");

/** The locales a copy table may carry. `he` is included here only so a
 *  locale-map node keyed `{en,de,pl,ru,he}` is still recognised as one -
 *  callers decide which locale(s) they actually read out of it. */
const KNOWN_LOCALES = new Set(["en", "de", "pl", "ru", "he"]);

export function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** True when `obj`'s own keys are a subset of the site's locale codes and
 *  include "en" — i.e. `obj` IS a `{en:…, de:…, …}` copy branch, not a copy
 *  object that merely happens to have a same-named field. */
export function isLocaleMap(obj) {
  if (!isPlainObject(obj)) return false;
  const keys = Object.keys(obj);
  if (!keys.includes("en")) return false;
  return keys.every((k) => KNOWN_LOCALES.has(k));
}

export function loadModulesConfig() {
  return JSON.parse(readFileSync(MODULES_PATH, "utf8"));
}

/** Dynamic-imports one copy-modules.json entry. Throws on failure — callers
 *  decide whether that's a hard error or (for entries without a "skip"
 *  reason) something to report and continue past. */
export async function importModule(entry) {
  const abs = path.join(ROOT, entry.path);
  return import(pathToFileURL(abs).href);
}

/**
 * Runs `visit(exportName, value, entry)` for every export listed in each
 * copy-modules.json entry, skipping entries that carry a "skip" reason and
 * recording an import failure (for an entry without "skip") as a skip too —
 * the snapshot/meta-length gates cover what can actually be loaded, per the
 * Phase 4 plan, and report the rest.
 */
export async function forEachModuleExport(visit) {
  const modules = loadModulesConfig();
  const skipped = [];
  for (const entry of modules) {
    if (entry.skip) {
      skipped.push({ path: entry.path, reason: entry.skip });
      continue;
    }
    let mod;
    try {
      mod = await importModule(entry);
    } catch (e) {
      skipped.push({ path: entry.path, reason: `import failed: ${e.message}` });
      continue;
    }
    for (const exportName of entry.exports) {
      const value = mod[exportName];
      if (value === undefined) {
        throw new Error(`${entry.path}: export "${exportName}" not found (module has: ${Object.keys(mod).join(", ")})`);
      }
      visit(exportName, value, entry);
    }
  }
  return { skipped };
}
