#!/usr/bin/env node
// Hebrew content-pack seeder — Hebrew localization Phase 5, Task 1 (skeleton)
// + Task 9 (completion). Upserts content/he/**/*.he.json into the shared DB.
//
// ****************  READ content/he/README.md BEFORE RUNNING  ****************
// The local DATABASE_URL is the PRODUCTION database (see the repo's
// "Local DB is production" note) — this script is meant to run on the
// STAGING SERVER, never on a laptop. Every safety gate below exists because
// of that fact:
//
//   * Dry run is the default. No flag needed.
//   * A REAL run additionally needs both the env var
//     CVP_CONFIRM_CONTENT_SEED=yes AND the --yes flag. Missing either one
//     refuses to write.
//   * Even a DRY RUN needs to read existing rows once the pack is non-empty
//     (to tell insert from update from skip) — that read is itself a
//     production DB read, so it is gated behind CVP_ALLOW_DB_READ=yes. For an
//     EMPTY pack, no PrismaClient is constructed at all; the empty plan is
//     printed and the process exits 0 without ever touching the network.
//   * Any existing row this would touch whose `language` is not "he" makes
//     the whole run refuse (a content pack must never overwrite another
//     locale's row).
//
// Usage:
//   node scripts/he-content/seed.mjs [--only <kind>] [--yes]
//
// Kinds: site-documents (implemented here) | faq | case-studies | singlepages
// | legal-check (Task 9 — calling any of these throws "not implemented").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTENT_HE_DIR = path.join(ROOT, "content", "he");

// Pack-only metadata that lives in every content/he/**/*.he.json file but has
// no counterpart in the DB row (or the EN source) — stripped before diffing
// or writing. Mirrors he-content-check.mjs's own stripping so "unchanged"
// comparisons never trip on review-status bookkeeping.
const PACK_METADATA_KEYS = ["review", "translationGroupSlugEn", "parentSlug"];

export const KINDS = ["site-documents", "faq", "case-studies", "singlepages", "legal-check"];

export function stripPackMetadata(obj) {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const clone = { ...obj };
  for (const k of PACK_METADATA_KEYS) delete clone[k];
  return clone;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Reads content/he/site-documents/*.he.json off disk into `{ type, data }`
 *  rows (pack metadata stripped). Pure I/O, no DB — safe to call from tests
 *  by pointing `dir` at a fixture directory. */
export function loadSiteDocumentsPack(dir = path.join(CONTENT_HE_DIR, "site-documents")) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".he.json"))
    .sort()
    .map((f) => {
      const type = f.replace(/\.he\.json$/, "");
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      return { type, data: stripPackMetadata(raw) };
    });
}

/**
 * Pure planner for the "site-documents" kind.
 *
 * `rows`: pack rows as `loadSiteDocumentsPack()` returns, `{ type, data }`.
 * `existingRows`: DB rows for the SAME `type`s, any language — e.g.
 *   `prisma.siteDocument.findMany({ where: { type: { in: rows.map(r=>r.type) } } })`
 *   shaped as `{ type, language, sanityId, data }`.
 *
 * Returns one Plan entry per pack row:
 *   - `refuse`  — an existing row for this `type` has `language !== "he"`.
 *   - `insert`  — no existing `he` row for this `type`.
 *   - `update`  — an existing `he` row's `data` differs from the pack's.
 *   - `skip`    — an existing `he` row's `data` already matches (unchanged).
 */
export function planSiteDocuments(rows, existingRows) {
  const plan = [];
  for (const row of rows) {
    const clashing = existingRows.find((r) => r.type === row.type && r.language !== "he");
    if (clashing) {
      plan.push({
        kind: "site-documents",
        key: row.type,
        action: "refuse",
        reason: `existing row for type "${row.type}" has language "${clashing.language}", not "he" — refusing to touch it`,
      });
      continue;
    }
    const existing = existingRows.find((r) => r.type === row.type && r.language === "he");
    if (!existing) {
      plan.push({
        kind: "site-documents",
        key: row.type,
        action: "insert",
        reason: "no existing he row",
        sanityId: `${row.type}-he`,
        data: row.data,
      });
    } else if (!deepEqual(existing.data, row.data)) {
      plan.push({
        kind: "site-documents",
        key: row.type,
        action: "update",
        reason: "data differs from the pack",
        sanityId: existing.sanityId ?? `${row.type}-he`,
        data: row.data,
      });
    } else {
      plan.push({ kind: "site-documents", key: row.type, action: "skip", reason: "unchanged" });
    }
  }
  return plan;
}

/**
 * Pure dispatcher: `pack` is `{ kind, rows }`; `existingRows` is whatever the
 * caller already fetched for that kind (or an empty array for a kind whose
 * rows are always brand new). Every kind but "site-documents" is Task 9.
 */
export function planSeed(pack, existingRows) {
  if (pack.kind === "site-documents") return planSiteDocuments(pack.rows, existingRows ?? []);
  throw new Error(`seed.mjs: kind "${pack.kind}" is not implemented (Task 9)`);
}

/**
 * Applies a plan (as produced by planSeed/planSiteDocuments) against a real
 * or fake PrismaClient. `skip` entries are no-ops; a `refuse` entry must
 * never reach here (callers check for refusals and abort first) — if one
 * does, this throws rather than silently upserting.
 */
export async function applyPlan(plan, prisma) {
  for (const entry of plan) {
    if (entry.action === "refuse") {
      throw new Error(`seed.mjs: refusing to apply a plan containing a "refuse" entry (${entry.kind} ${entry.key}): ${entry.reason}`);
    }
    if (entry.action === "skip") continue;
    if (entry.kind !== "site-documents") {
      throw new Error(`seed.mjs: kind "${entry.kind}" is not implemented (Task 9)`);
    }
    await prisma.siteDocument.upsert({
      where: { type_language: { type: entry.key, language: "he" } },
      update: { data: entry.data },
      create: { sanityId: entry.sanityId ?? `${entry.key}-he`, type: entry.key, language: "he", data: entry.data },
    });
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const only = [];
  let yes = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only" && argv[i + 1]) only.push(argv[++i]);
    else if (argv[i] === "--yes") yes = true;
    else if (argv[i] === "--dry-run") continue; // the default anyway; accepted for explicitness
  }
  return { only, yes };
}

const NOT_IMPLEMENTED_DIRS = {
  "case-studies": { dir: path.join(CONTENT_HE_DIR, "case-studies"), pattern: /\.he\.json$/ },
  singlepages: { dir: path.join(CONTENT_HE_DIR, "singlepages"), pattern: /\.he\.json$/ },
  faq: { dir: path.join(ROOT, "scripts", "faq-translations"), pattern: /^he\.json$/ },
};

function dirHasFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((f) => pattern.test(f));
}

/**
 * Loads the pack for one kind, or throws "not implemented (Task 9)" for
 * every kind but site-documents — either because it was explicitly asked for
 * via --only, or because content already exists on disk for it (so once a
 * later task lands real content, a plain `--dry-run` with no --only fails
 * loudly instead of silently skipping it).
 */
export function loadPack(kind, { explicit } = {}) {
  if (kind === "site-documents") return { kind, rows: loadSiteDocumentsPack() };

  if (kind === "legal-check") {
    if (explicit) throw new Error(`seed.mjs: kind "legal-check" is not implemented (Task 9)`);
    return { kind, rows: [] };
  }

  const spec = NOT_IMPLEMENTED_DIRS[kind];
  const hasContent = spec ? dirHasFiles(spec.dir, spec.pattern) : false;
  if (explicit || hasContent) {
    throw new Error(
      `seed.mjs: kind "${kind}" is not implemented (Task 9)` + (hasContent ? " — content already exists on disk; refusing to silently skip it" : ""),
    );
  }
  return { kind, rows: [] };
}

function printPlan(plan) {
  if (!plan.length) {
    console.log("he-content seed: empty plan (0 rows) — nothing to do.");
    return;
  }
  console.log("kind            key                              action   reason");
  for (const p of plan) {
    console.log(`${p.kind.padEnd(15)} ${String(p.key).padEnd(32)} ${p.action.padEnd(8)} ${p.reason}`);
  }
}

async function main() {
  const { only, yes } = parseArgs(process.argv.slice(2));

  for (const k of only) {
    if (!KINDS.includes(k)) {
      console.error(`seed.mjs: unknown kind "${k}". Known kinds: ${KINDS.join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  const kinds = only.length ? only : KINDS;
  const confirmed = process.env.CVP_CONFIRM_CONTENT_SEED === "yes";

  if (yes && !confirmed) {
    console.error(
      "seed.mjs: --yes was given but CVP_CONFIRM_CONTENT_SEED=yes is not set in the environment. Refusing to run for real (see content/he/README.md).",
    );
    process.exitCode = 1;
    return;
  }
  const isDryRun = !yes; // yes ⇒ confirmed, checked above

  let packs;
  try {
    packs = kinds.map((k) => loadPack(k, { explicit: only.includes(k) }));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const totalRows = packs.reduce((n, p) => n + p.rows.length, 0);
  console.log(`he-content seed: ${isDryRun ? "DRY RUN" : "REAL RUN"} — kinds: ${kinds.join(", ")}`);

  if (totalRows === 0) {
    console.log("he-content seed: empty plan (0 rows across all selected kinds) — nothing to do.");
    return; // no PrismaClient constructed — see the module banner
  }

  if (process.env.CVP_ALLOW_DB_READ !== "yes") {
    console.error(
      "seed.mjs: the pack is non-empty, and planning insert/update/skip needs to read existing rows from the database. " +
        "Refusing to connect without CVP_ALLOW_DB_READ=yes (see content/he/README.md — this applies to dry runs too).",
    );
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const allPlans = [];
    for (const pack of packs) {
      if (pack.kind !== "site-documents") continue; // every other kind's pack is empty here — see loadPack
      if (!pack.rows.length) continue;
      const existingRows = await prisma.siteDocument.findMany({
        where: { type: { in: pack.rows.map((r) => r.type) } },
      });
      allPlans.push(...planSiteDocuments(pack.rows, existingRows));
    }

    printPlan(allPlans);

    const refusals = allPlans.filter((p) => p.action === "refuse");
    if (refusals.length) {
      console.error(`\nseed.mjs: ${refusals.length} row(s) refused — see reasons above. Aborting without writing anything.`);
      process.exitCode = 1;
      return;
    }

    if (!isDryRun) {
      await applyPlan(allPlans, prisma);
      console.log("\nseed.mjs: plan applied.");
    } else {
      console.log("\nseed.mjs: dry run — nothing written. Re-run with --yes and CVP_CONFIRM_CONTENT_SEED=yes to apply.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
