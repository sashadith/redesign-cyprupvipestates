#!/usr/bin/env node
// Hebrew content-pack seeder — Hebrew localization Phase 5, Task 1 (skeleton:
// site-documents) + Task 9 (completion: faq, case-studies, singlepages,
// legal-check). Upserts content/he/**/*.he.json (+ scripts/faq-translations/
// he.json, + a legal registry.ts check) into the shared DB.
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
//   * site-documents/faq: existing-row matching is (type, language: "he")
//     only. `SiteDocument` is @@unique([type, language]) — one row PER
//     LANGUAGE per type — so the `en/de/pl/ru` siblings of every `type` this
//     pack seeds are EXPECTED and are ignored, never a reason to refuse
//     (same principle as the case-studies/singlepages guard below). The
//     loaders only fetch `language: "he"` rows for that reason, and the row
//     actually written is asserted to be "he" — see assertUpdateTargetIsHe.
//   * case-studies/singlepages: existing-row matching is (language: "he",
//     slug) only — a same-slug row of another language is EXPECTED (decision
//     A: a "he" page deliberately shares its Latin slug with its EN sibling)
//     and is ignored, never a reason to refuse. An insert/update can still
//     never target a non-"he" row — see assertNoExistingHeRow/
//     assertUpdateTargetIsHe.
//
// Usage:
//   node scripts/he-content/seed.mjs [--only <kind>] [--yes]
//
// Kinds: site-documents | faq | case-studies | singlepages | legal-check.
//
// Two-pass linking (case-studies, singlepages): each kind's planner returns
// a "main" pass (insert/update/skip/refuse the row's own columns) followed by
// a "link" pass (insert/update/skip/refuse a relation that can only be wired
// up once every row in the pack has a stable id/sanityId to point at — a
// case study's related developments, a landing page's relatedLandingPages).
// applyPlan executes a plan array in the order it's given, so the caller
// (planSeed / the CLI) is responsible for putting every kind's main-pass
// entries before its own link-pass entries; within one kind's two passes
// that's already true here (planCaseStudies/planSinglepages return
// `[...mainPlan, ...linkPlan]`).
//
// Slug convention (singlepages): a pack file's path and its `"slug"` field are
// both the FULL served path (`limassol/new-projects.he.json` ⇄ `"slug":
// "limassol/new-projects"`) — that's what the keyword map, `parentSlug`,
// `relatedLandingPages` and he-content-check's linkCheck all reference. The DB
// gets the LEAF segment in `Singlepage.slug` plus `parentSanityId` pointing at
// the hub row, because that is what the public route reads back.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTENT_HE_DIR = path.join(ROOT, "content", "he");
const FAQ_DIR = path.join(ROOT, "scripts", "faq-translations");
const LEGAL_REGISTRY_PATH = path.join(ROOT, "src", "app", "preview-legal", "[lang]", "[doc]", "registry.ts");

// Pack-only metadata that lives in every content/he/**/*.he.json file but has
// no counterpart in the DB row (or the EN source) — stripped before diffing
// or writing. Mirrors he-content-check.mjs's own stripping so "unchanged"
// comparisons never trip on review-status bookkeeping. `relatedProjects` (case
// studies) and `relatedLandingPages` (singlepages) are ALSO pack-only in the
// sense that they never land in the row's own columns — they drive the
// separate link pass — so they're stripped from `data` too, just not via this
// generic list (each kind's own field-picker only copies its real columns).
const PACK_METADATA_KEYS = ["review", "translationGroupSlugEn", "parentSlug"];

export const KINDS = ["site-documents", "faq", "case-studies", "singlepages", "legal-check"];

/**
 * Reads `<dir>/**\/*.he.json` RECURSIVELY into `{ slug, raw, file }` rows.
 *
 * The pack slug is the file's path relative to `dir` with `.he.json`
 * stripped, so `content/he/singlepages/limassol/new-projects.he.json` is the
 * pack slug `"limassol/new-projects"` — the FULL served path, exactly as
 * `docs/i18n/he-keyword-map.md` lists it and as `parentSlug`/
 * `relatedLandingPages`/`linkCheck` reference it. (What lands in the DB
 * `slug` column is the LEAF only — see planSinglepages.)
 *
 * The file's own `"slug"` field (part of Task 6a's file interface) MUST equal
 * that path — a mismatch is a hard error naming both, because the two are
 * read by different tools (this loader by path, `he-content-check.mjs` by
 * field) and a divergence would silently make them disagree.
 */
function readPackDir(dir, label) {
  if (!fs.existsSync(dir)) return [];
  const rows = [];
  const walk = (d) => {
    const entries = fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".he.json")) continue;
      const file = path.relative(dir, full).split(path.sep).join("/");
      const slug = file.replace(/\.he\.json$/, "");
      const raw = JSON.parse(fs.readFileSync(full, "utf8"));
      if (typeof raw.slug === "string" && raw.slug !== slug) {
        throw new Error(
          `seed.mjs: ${label} — file "${file}" declares "slug": "${raw.slug}", but its path (without .he.json) is "${slug}". ` +
            `The file path and the "slug" field must be identical.`,
        );
      }
      rows.push({ slug, raw, file });
    }
  };
  walk(dir);
  return rows.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function stripPackMetadata(obj) {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const clone = { ...obj };
  for (const k of PACK_METADATA_KEYS) delete clone[k];
  return clone;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickFields(obj, fields) {
  const out = {};
  for (const f of fields) if (obj && obj[f] !== undefined) out[f] = obj[f];
  return out;
}

// ─── Language guard (case-studies / singlepages) ───────────────────────────
//
// Singlepage and CaseStudy are unique per (language, slug), and under
// decision A a "he" page deliberately shares its Latin slug with its EN
// (and sometimes de/pl/ru) sibling — so a same-slug row of another language
// is the NORM, not a hazard, and must never block a plan. Existing-row
// matching for both kinds is therefore (language === "he", slug === <the DB
// slug: leaf for singlepages>) ONLY; a same-slug non-"he" row is looked up
// solely (via resolveTranslationGroupId's own `(language === "en", slug)`
// match) when a pack row's translationGroupSlugEn names it.
//
// What still must never happen is this planner accidentally treating a
// non-"he" row as the target of an update, or planning an insert while a
// "he" row already exists at that key (which should have been an update).
// Given the (language === "he", slug) match above, `existing` can only ever
// be a "he" row or undefined — so these two assertions can never actually
// fire through the public planners today. They stay as explicit,
// independently-tested guards so a future change to the match (or a
// genuinely corrupted `existingRows` array) fails loudly instead of quietly
// upserting the wrong locale's row.

/** Throws unless `existingRow` (about to be UPDATED) is a "he" row. Pass the
 *  row `existing` matched by `(language === "he", slug)` — under correct
 *  matching this is always true; the check exists for defense-in-depth. */
export function assertUpdateTargetIsHe(existingRow, label) {
  if (existingRow && existingRow.language !== "he") {
    throw new Error(`${label}: refusing to update a row whose language is "${existingRow.language}", not "he" — existingRows is corrupted`);
  }
}

/** Throws if a "he" row for `slug` is already present in `existingRows` —
 *  an insert must never coincide with an existing "he" row (that case
 *  belongs to the update branch instead). Same defense-in-depth purpose as
 *  assertUpdateTargetIsHe. Rows of other languages sharing `slug` are
 *  expected (decision A) and are not checked here. */
export function assertNoExistingHeRow(existingRows, slug, label) {
  const heRow = existingRows.find((r) => r.language === "he" && r.slug === slug);
  if (heRow) {
    throw new Error(
      `${label}: refusing to insert — a "he" row for slug "${slug}" already exists (id ${heRow.id ?? heRow.sanityId ?? "?"}) — this should have been an update`,
    );
  }
}

/**
 * Resolves the `translationGroupId` a new "he" row should join, from the pack
 * file's `translationGroupSlugEn` metadata field (Task 9 interfaces: "from
 * the EN row named by translationGroupSlugEn").
 *
 * - `translationGroupSlugEn` absent/null → mint a brand-new group id (this he
 *   row is the first — and so far only — member of its translation group).
 * - present → find the EN row (same kind, `language: "en"`) whose `slug`
 *   equals it in `candidateRows`; throw naming the slug if none exists.
 *   Reuse that EN row's `translationGroupId` if it already has one; if it
 *   doesn't (pre-Phase-5 rows migrated from Sanity commonly don't), mint one
 *   here too and flag `needsEnUpdate` so applyPlan persists it onto the EN
 *   row — the same "generate + persist if missing" convention
 *   `createTranslation` uses in src/app/admin/actions.ts.
 */
// `existingHeRow` is this SAME pack row's already-seeded "he" row from a
// PREVIOUS run, if any — checked first so a re-run without
// `translationGroupSlugEn` reuses the group id it already minted last time
// instead of minting a fresh one every plan (which would never be
// idempotent, and would fork the translation group on every real apply).
function resolveTranslationGroupId(translationGroupSlugEn, candidateRows, existingHeRow, label) {
  if (translationGroupSlugEn == null) {
    if (existingHeRow?.translationGroupId) {
      return { translationGroupId: existingHeRow.translationGroupId, sourceEnRow: null, needsEnUpdate: false };
    }
    return { translationGroupId: crypto.randomUUID(), sourceEnRow: null, needsEnUpdate: false };
  }
  const enRow = candidateRows.find((r) => r.language === "en" && r.slug === translationGroupSlugEn);
  if (!enRow) {
    throw new Error(`${label}: unknown translationGroupSlugEn "${translationGroupSlugEn}" — no EN row with that slug`);
  }
  const translationGroupId = enRow.translationGroupId || crypto.randomUUID();
  return { translationGroupId, sourceEnRow: enRow, needsEnUpdate: !enRow.translationGroupId };
}

// ─── Kind: site-documents (Task 1) ──────────────────────────────────────────

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
 * `existingRows`: the "he" DB rows for the SAME `type`s — e.g.
 *   `prisma.siteDocument.findMany({ where: { type: { in: rows.map(r=>r.type) }, language: "he" } })`
 *   shaped as `{ type, language, sanityId, data }`. Accepts either a bare
 *   array or the `{ siteDocuments }` envelope the real loader returns.
 *   `en/de/pl/ru` siblings of the same `type` are EXPECTED (SiteDocument is
 *   unique per `(type, language)`) and are ignored if present.
 *
 * Returns one Plan entry per pack row:
 *   - `insert`  — no existing `he` row for this `type`.
 *   - `update`  — an existing `he` row's `data` differs from the pack's.
 *   - `skip`    — an existing `he` row's `data` already matches (unchanged).
 */
export function planSiteDocuments(rows, existingRows) {
  const existingSiteDocuments = Array.isArray(existingRows) ? existingRows : (existingRows?.siteDocuments ?? []);
  const plan = [];
  for (const row of rows) {
    const existing = existingSiteDocuments.find((r) => r.type === row.type && r.language === "he");
    assertUpdateTargetIsHe(existing, `site-documents "${row.type}"`);
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

// ─── Kind: faq (Task 9) ─────────────────────────────────────────────────────
//
// The `faq` kind seeds the SAME `SiteDocument` row (`type: "faqPage"`) that
// scripts/seed-faq-translations.mjs seeds for en/de/pl/ru, so an operator can
// run either tool and get an identical "he" row. `rebuildFaqHe` is a
// deliberate parallel implementation of that script's `buildForLang("he")` —
// not an import of it — because that script (a) constructs a `PrismaClient`
// at module scope (importing it would do that as a side effect, which this
// self-contained script must never do outside `main()`'s own gates) and (b)
// is being edited concurrently by another task. Keeping the same rebuild
// contract (strictly walk EN_CATEGORIES' slugs/ids/answer-lengths, pull
// translated text by id) means a reordered or truncated he.json still
// produces EN-ordered, EN-shaped output, exactly like that script does.

export function rebuildFaqHe(enCategories, heCategoriesRaw) {
  const byId = new Map(heCategoriesRaw.flatMap((c) => (c.items || []).map((it) => [it.id, it])));
  const catBySlug = new Map(heCategoriesRaw.map((c) => [c.slug, c]));
  return enCategories.map((enCat) => {
    const heCat = catBySlug.get(enCat.slug);
    if (!heCat) throw new Error(`seed.mjs: faq — missing he category translation for slug "${enCat.slug}"`);
    return {
      slug: enCat.slug,
      label: heCat.label,
      description: heCat.description,
      items: enCat.items.map((enItem) => {
        const heItem = byId.get(enItem.id);
        if (!heItem) throw new Error(`seed.mjs: faq — missing he item translation for id "${enItem.id}"`);
        if (!Array.isArray(heItem.answer) || heItem.answer.length !== enItem.answer.length) {
          throw new Error(
            `seed.mjs: faq — answer paragraph count mismatch for id "${enItem.id}": en has ${enItem.answer.length}, he has ${heItem.answer?.length}`,
          );
        }
        return { id: enItem.id, question: heItem.question, answer: heItem.answer };
      }),
    };
  });
}

/** Loads + rebuilds the "he" FAQ pack row from scripts/faq-translations/
 *  {en,he}.json. Returns `[]` when he.json doesn't exist yet (nothing to
 *  seed). Pure I/O, no DB. */
export function loadFaqPack({ enPath = path.join(FAQ_DIR, "en.json"), hePath = path.join(FAQ_DIR, "he.json") } = {}) {
  if (!fs.existsSync(hePath)) return [];
  const enCategories = JSON.parse(fs.readFileSync(enPath, "utf8"));
  const heCategoriesRaw = JSON.parse(fs.readFileSync(hePath, "utf8"));
  const categories = rebuildFaqHe(enCategories, heCategoriesRaw);
  return [{ key: "faqPage", data: { categories } }];
}

/**
 * Pure planner for the "faq" kind — same shape/semantics as
 * planSiteDocuments, scoped to `type: "faqPage"`. `existingRows.siteDocuments`
 * is the same DB rows the "site-documents" kind reads (shared table, "he"
 * only), so a combined run only queries it once. The `en/de/pl/ru` `faqPage`
 * rows scripts/seed-faq-translations.mjs owns are expected siblings and are
 * neither read nor written here.
 */
export function planFaq(rows, existingRows) {
  const existingSiteDocuments = Array.isArray(existingRows) ? existingRows : (existingRows?.siteDocuments ?? []);
  const plan = [];
  for (const row of rows) {
    const existing = existingSiteDocuments.find((r) => r.type === "faqPage" && r.language === "he");
    assertUpdateTargetIsHe(existing, 'faq "faqPage"');
    if (!existing) {
      plan.push({ kind: "faq", key: row.key, action: "insert", reason: "no existing he row", sanityId: "faqPage-he", data: row.data });
    } else if (!deepEqual(existing.data, row.data)) {
      plan.push({ kind: "faq", key: row.key, action: "update", reason: "data differs from the pack", sanityId: existing.sanityId ?? "faqPage-he", data: row.data });
    } else {
      plan.push({ kind: "faq", key: row.key, action: "skip", reason: "unchanged" });
    }
  }
  return plan;
}

// ─── Kind: case-studies (Task 9) ────────────────────────────────────────────
//
// CaseStudy.relatedProjects is a many-to-many through CaseStudyProject, which
// joins to the LEGACY `Project` model (per-language, pre-Development), not to
// `Development` directly — confirmed against prisma/schema.prisma (~435-476)
// and src/sanity/sanity.utils.ts's `_getCaseStudyByLang`/`mapProjectRowsToLang`,
// which is what the public /case-studies/<slug> page actually reads. Content
// files name a `relatedProjects` array of EN **Development** slugs (Task 5),
// so this seeder resolves each Development slug → its `Development.id`
// (checked against `existingRows.developments` at PLAN time — an unknown
// slug is a hard error) and, at APPLY time (real DB access, not testable
// purely), looks up the legacy `Project` row(s) whose `supersededByDevelopmentId`
// matches (the field the Phase-5 legacy/Development-overlap admin flow sets)
// and links the CaseStudyProject join to THOSE rows' ids. A Development with
// no corresponding legacy Project (the common case for anything created
// after the Development model existed) has nothing to link to — applyPlan
// logs and skips it rather than failing the whole run.

const CASE_STUDY_FIELDS = ["title", "fullTitle", "excerpt", "category", "seo", "clientOverview", "caseDetails", "mainContent", "previewImage"];

/** Reads content/he/case-studies/<slug>.he.json off disk into
 *  `{ slug, raw }` rows (raw = full parsed JSON, pack metadata NOT stripped
 *  yet — planCaseStudies needs `translationGroupSlugEn`/`relatedProjects`/
 *  `review` to resolve refs before picking the DB-column subset). */
export function loadCaseStudiesPack(dir = path.join(CONTENT_HE_DIR, "case-studies")) {
  return readPackDir(dir, "case-studies");
}

/**
 * Pure planner for the "case-studies" kind.
 *
 * `rows`: `{ slug, raw }` as `loadCaseStudiesPack()` returns.
 * `existingRows.caseStudies`: "he" CaseStudy rows for the SAME slugs, plus
 *   any EN row named by a pack row's `translationGroupSlugEn` — never a
 *   same-slug row of another language otherwise (decision A makes that the
 *   norm, not something to refuse over; see the language-guard note above
 *   pickFields) — each carrying `{ id, sanityId, slug, language, translationGroupId,
 *   ...CASE_STUDY_FIELDS, relatedDevelopmentSlugs }` — `relatedDevelopmentSlugs`
 *   (only meaningful for existing "he" rows) is the loader's already-resolved
 *   view of who this case study currently links to (CaseStudyProject →
 *   Project.supersededByDevelopmentId → Development.slug), so the link pass
 *   can diff without the pure planner touching the DB itself.
 * `existingRows.developments`: `{ id, slug }` rows for every Development slug
 *   any pack row's `relatedProjects` names.
 *
 * Returns `[...mainPlan, ...linkPlan]`, one pair of entries per row (a
 * refused row contributes only its main-pass refusal, no link entry).
 */
export function planCaseStudies(rows, existingRows) {
  const existingCaseStudies = existingRows?.caseStudies ?? [];
  const developments = existingRows?.developments ?? [];
  const mainPlan = [];
  const linkPlan = [];

  for (const { slug, raw } of rows) {
    // (language === "he", slug) only — a same-slug EN/de/pl/ru row is
    // expected under decision A and is intentionally ignored here.
    const existing = existingCaseStudies.find((r) => r.slug === slug && r.language === "he");

    let tg;
    try {
      tg = resolveTranslationGroupId(raw.translationGroupSlugEn, existingCaseStudies, existing, `case-studies "${slug}"`);
    } catch (err) {
      mainPlan.push({ kind: "case-studies", key: slug, action: "refuse", reason: err.message });
      continue;
    }

    const relatedProjects = Array.isArray(raw.relatedProjects) ? raw.relatedProjects : [];
    const relatedDevelopmentIds = [];
    const missingDevSlug = relatedProjects.find((devSlug) => !developments.some((d) => d.slug === devSlug));
    if (missingDevSlug) {
      mainPlan.push({ kind: "case-studies", key: slug, action: "refuse", reason: `unknown development slug in relatedProjects: "${missingDevSlug}"` });
      continue;
    }
    for (const devSlug of relatedProjects) relatedDevelopmentIds.push(developments.find((d) => d.slug === devSlug).id);

    const data = pickFields(raw, CASE_STUDY_FIELDS);
    const sanityId = existing?.sanityId ?? `he-${slug}`;
    const resolved = { translationGroupId: tg.translationGroupId, sourceEnRowId: tg.sourceEnRow?.id ?? null, needsEnUpdate: tg.needsEnUpdate };

    if (!existing) {
      assertNoExistingHeRow(existingCaseStudies, slug, `case-studies "${slug}"`);
      mainPlan.push({ kind: "case-studies", key: slug, action: "insert", reason: "no existing he row", sanityId, data, resolved });
    } else {
      assertUpdateTargetIsHe(existing, `case-studies "${slug}"`);
      if (!deepEqual(pickFields(existing, CASE_STUDY_FIELDS), data) || existing.translationGroupId !== tg.translationGroupId) {
        mainPlan.push({ kind: "case-studies", key: slug, action: "update", reason: "data differs from the pack", sanityId, data, resolved, id: existing.id });
      } else {
        mainPlan.push({ kind: "case-studies", key: slug, action: "skip", reason: "unchanged", id: existing.id, sanityId });
      }
    }

    const existingDevSlugs = (existing?.relatedDevelopmentSlugs ?? []).slice().sort();
    const wantDevSlugs = relatedProjects.slice().sort();
    if (deepEqual(existingDevSlugs, wantDevSlugs)) {
      linkPlan.push({ kind: "case-studies", key: slug, action: "skip", reason: "related projects unchanged" });
    } else {
      linkPlan.push({
        kind: "case-studies",
        key: slug,
        action: "link",
        reason: "related projects differ",
        resolved: { relatedDevelopmentIds, relatedDevelopmentSlugs: relatedProjects },
      });
    }
  }

  return [...mainPlan, ...linkPlan];
}

// ─── Kind: singlepages (Task 9) ─────────────────────────────────────────────

const SINGLEPAGE_FIELDS = ["title", "excerpt", "seo", "allowIntroBlock", "previewImage", "contentBlocks"];

/** Reads content/he/singlepages/<slug>.he.json off disk into `{ slug, raw }`
 *  rows (raw not stripped — see loadCaseStudiesPack's note, same reasoning).
 *  Recursive: a nested landing page lives at its own path
 *  (`singlepages/limassol/new-projects.he.json` → pack slug
 *  `"limassol/new-projects"`). */
export function loadSinglepagesPack(dir = path.join(CONTENT_HE_DIR, "singlepages")) {
  return readPackDir(dir, "singlepages");
}

/** The DB `Singlepage.slug` column for a pack slug: the LEAF segment only.
 *  `_getSinglePageByLang(lang, slug)` (src/sanity/sanity.utils.ts) looks up
 *  `slug[slug.length - 1]` of the URL, and getAllPathsForLang/pagePower
 *  `inventory.ts` reconstruct the served path by walking `parentSanityId` —
 *  so a nested row storing the full path would never be found (404). */
export function leafSlug(packSlug) {
  return packSlug.split("/").pop();
}

/** The pack slug of a nested page's parent (its dirname), or null for a
 *  top-level page. */
export function parentPackSlug(packSlug) {
  const i = packSlug.lastIndexOf("/");
  return i === -1 ? null : packSlug.slice(0, i);
}

/** Deterministic `sanityId` for a pack slug — slashes become dashes so the
 *  id stays a flat, path-free identifier (`limassol/new-projects` →
 *  `he-limassol-new-projects`). */
export function singlepageSanityId(packSlug) {
  return `he-${packSlug.replace(/\//g, "-")}`;
}

/**
 * Pure planner for the "singlepages" kind.
 *
 * `rows`: `{ slug, raw }` as `loadSinglepagesPack()` returns.
 * `existingRows.singlepages`: "he" Singlepage rows for the SAME leaf slugs,
 *   plus any EN row named by a pack row's `translationGroupSlugEn` — never a
 *   same-slug row of another language otherwise (decision A makes that the
 *   norm, not something to refuse over; see the language-guard note above
 *   pickFields) — each carrying `{ id, sanityId, slug, language, translationGroupId,
 *   parentSanityId, ...SINGLEPAGE_FIELDS, relatedLandingPageSlugs }` —
 *   `relatedLandingPageSlugs` (only meaningful for existing "he" rows) is the
 *   loader's resolved view of `relatedLandingPages` (`[{_ref}]` → pack
 *   slugs), so the link pass can diff without the pure planner touching the
 *   DB. Rows for slugs THIS pack also defines (a hub already seeded in an
 *   earlier run, now being re-seeded alongside a new spoke) are what makes
 *   cross-run parentSlug/relatedLandingPages resolution possible.
 *
 * `parentSlug`/`relatedLandingPages` resolve against the UNION of this pack's
 * own slugs (deterministic `sanityId: "he-<slug-with-dashes>"`, so no DB round
 * trip is needed to know a sibling's id even before it's inserted) and any
 * existing "he" rows in `existingRows.singlepages` (whose full path is
 * reconstructed by walking `parentSanityId`, the same way the public route
 * does) — an unresolvable slug in either throws/refuses naming that slug.
 *
 * SLUGS: a pack row's `slug`/`key` is the FULL served path
 * (`limassol/new-projects`). What goes into the DB `slug` column is the LEAF
 * (`new-projects`) plus `parentSanityId` pointing at the hub — that's the
 * shape the route reads (see leafSlug's note). Because `Singlepage.slug` is
 * unique per `(language, slug)`, two pack pages that would share a leaf under
 * different parents are a hard error at plan time: the route could not tell
 * them apart.
 */
export function planSinglepages(rows, existingRows) {
  const existingSinglepages = existingRows?.singlepages ?? [];
  const mainPlan = [];
  const linkPlan = [];

  // Existing "he" rows store the LEAF slug; rebuild each one's full path by
  // walking parentSanityId so pack slugs (full paths) can be matched against
  // them for parentSlug/relatedLandingPages resolution across runs.
  const heExisting = existingSinglepages.filter((r) => r.language === "he");
  const heBySanityId = new Map(heExisting.map((r) => [r.sanityId, r]));
  const fullPathOfExisting = (row, seen = new Set()) => {
    if (!row.parentSanityId || seen.has(row.sanityId)) return row.slug;
    const parent = heBySanityId.get(row.parentSanityId);
    if (!parent) return row.slug; // parent not among the fetched rows — best effort
    seen.add(row.sanityId);
    return `${fullPathOfExisting(parent, seen)}/${row.slug}`;
  };

  const sanityIdBySlug = new Map();
  for (const { slug } of rows) sanityIdBySlug.set(slug, singlepageSanityId(slug));
  for (const r of heExisting) sanityIdBySlug.set(fullPathOfExisting(r), r.sanityId);

  // (language:"he", leafSlug) uniqueness — checked over the whole pack before
  // planning any row, so both halves of a collision are named.
  const packSlugsByLeaf = new Map();
  for (const { slug } of rows) {
    const leaf = leafSlug(slug);
    packSlugsByLeaf.set(leaf, [...(packSlugsByLeaf.get(leaf) ?? []), slug]);
  }

  for (const { slug, raw } of rows) {
    const leaf = leafSlug(slug);

    const collisions = packSlugsByLeaf.get(leaf);
    if (collisions.length > 1) {
      mainPlan.push({
        kind: "singlepages",
        key: slug,
        action: "refuse",
        reason:
          `duplicate leaf slug "${leaf}" across pack pages ${collisions.map((s) => `"${s}"`).join(" and ")} — ` +
          `Singlepage.slug is unique per (language, slug) and the route resolves a page by its leaf segment, so these two cannot coexist`,
      });
      continue;
    }

    // (language === "he", slug === leaf) only — a same-slug EN/de/pl/ru row
    // is expected under decision A and is intentionally ignored here.
    const existing = existingSinglepages.find((r) => r.slug === leaf && r.language === "he");

    let tg;
    try {
      tg = resolveTranslationGroupId(raw.translationGroupSlugEn, existingSinglepages, existing, `singlepages "${slug}"`);
    } catch (err) {
      mainPlan.push({ kind: "singlepages", key: slug, action: "refuse", reason: err.message });
      continue;
    }

    // The parent comes from the pack slug's own path (`limassol/new-projects`
    // → `limassol`). `parentSlug`, when the file carries it, must say the same
    // thing — it's a declaration, not a second source of truth.
    const parentFromPath = parentPackSlug(slug);
    let parentSanityId = null;
    if (raw.parentSlug != null && raw.parentSlug !== parentFromPath) {
      mainPlan.push({
        kind: "singlepages",
        key: slug,
        action: "refuse",
        reason:
          `parentSlug "${raw.parentSlug}" does not match the parent segment of slug "${slug}" ` +
          `(expected ${parentFromPath === null ? "no parentSlug (top-level page)" : `"${parentFromPath}"`})`,
      });
      continue;
    }
    if (parentFromPath) {
      parentSanityId = sanityIdBySlug.get(parentFromPath) ?? null;
      if (!parentSanityId) {
        mainPlan.push({ kind: "singlepages", key: slug, action: "refuse", reason: `missing parent page for parentSlug "${parentFromPath}"` });
        continue;
      }
    }

    const sanityId = existing?.sanityId ?? singlepageSanityId(slug);
    const data = { ...pickFields(raw, SINGLEPAGE_FIELDS), parentSanityId, translationGroupId: tg.translationGroupId };
    const existingComparable = existing
      ? { ...pickFields(existing, SINGLEPAGE_FIELDS), parentSanityId: existing.parentSanityId ?? null, translationGroupId: existing.translationGroupId ?? null }
      : null;
    // `key` is the pack identity (the full path); `slug` is what the DB column
    // gets (the leaf) — applyPlan writes `slug`, never `key`.
    const resolved = { leafSlug: leaf, parentSanityId, translationGroupId: tg.translationGroupId, sourceEnRowId: tg.sourceEnRow?.id ?? null, needsEnUpdate: tg.needsEnUpdate };

    if (!existing) {
      assertNoExistingHeRow(existingSinglepages, leaf, `singlepages "${slug}"`);
      mainPlan.push({ kind: "singlepages", key: slug, slug: leaf, action: "insert", reason: "no existing he row", sanityId, data, resolved });
    } else {
      assertUpdateTargetIsHe(existing, `singlepages "${slug}"`);
      if (!deepEqual(existingComparable, data)) {
        mainPlan.push({ kind: "singlepages", key: slug, slug: leaf, action: "update", reason: "data differs from the pack", sanityId, data, resolved, id: existing.id });
      } else {
        mainPlan.push({ kind: "singlepages", key: slug, slug: leaf, action: "skip", reason: "unchanged", id: existing.id, sanityId });
      }
    }

    const wantSlugs = Array.isArray(raw.relatedLandingPages) ? raw.relatedLandingPages : [];
    const missingSlug = wantSlugs.find((relSlug) => !sanityIdBySlug.has(relSlug));
    if (missingSlug) {
      linkPlan.push({ kind: "singlepages", key: slug, slug: leaf, action: "refuse", reason: `unknown pack slug in relatedLandingPages: "${missingSlug}"` });
      continue;
    }
    const relatedRefs = wantSlugs.map((relSlug) => ({ _ref: sanityIdBySlug.get(relSlug) }));
    const existingRelSlugs = (existing?.relatedLandingPageSlugs ?? []).slice().sort();
    const wantSlugsSorted = wantSlugs.slice().sort();
    if (deepEqual(existingRelSlugs, wantSlugsSorted)) {
      linkPlan.push({ kind: "singlepages", key: slug, slug: leaf, action: "skip", reason: "related landing pages unchanged" });
    } else {
      linkPlan.push({ kind: "singlepages", key: slug, slug: leaf, action: "link", reason: "related landing pages differ", resolved: { relatedRefs, relatedSlugs: wantSlugs } });
    }
  }

  return [...mainPlan, ...linkPlan];
}

// ─── Kind: legal-check (Task 9) ─────────────────────────────────────────────
//
// No DB access at all — just asserts src/app/preview-legal/[lang]/[doc]/
// registry.ts has no leftover `TODO(he)` marker (Task 2 replaces the two EN
// aliases with real privacy.he.ts/terms.he.ts entries). Routed through the
// same plan/apply shape as every other kind for a uniform CLI, but its only
// possible actions are "skip" (clean) and "refuse" (still has a TODO).

export function loadLegalCheckPack(registryPath = LEGAL_REGISTRY_PATH) {
  if (!fs.existsSync(registryPath)) return [];
  return [{ source: fs.readFileSync(registryPath, "utf8") }];
}

export function planLegalCheck(rows) {
  if (!rows.length) return [];
  const { source } = rows[0];
  if (/TODO\(he\)/.test(source)) {
    return [{ kind: "legal-check", key: "registry.ts", action: "refuse", reason: "registry.ts still contains a TODO(he) marker" }];
  }
  return [{ kind: "legal-check", key: "registry.ts", action: "skip", reason: "no TODO(he) found" }];
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/**
 * Pure dispatcher: `pack` is `{ kind, rows }`; `existingRows` is whatever the
 * caller already fetched for that kind (an empty object/array is fine for a
 * kind with an empty pack, or for "legal-check" which never reads the DB).
 */
export function planSeed(pack, existingRows) {
  if (pack.kind === "site-documents") return planSiteDocuments(pack.rows, existingRows ?? []);
  if (pack.kind === "faq") return planFaq(pack.rows, existingRows ?? {});
  if (pack.kind === "case-studies") return planCaseStudies(pack.rows, existingRows ?? {});
  if (pack.kind === "singlepages") return planSinglepages(pack.rows, existingRows ?? {});
  if (pack.kind === "legal-check") return planLegalCheck(pack.rows);
  throw new Error(`seed.mjs: kind "${pack.kind}" is unknown`);
}

/**
 * Applies a plan (as produced by planSeed) against a real or fake
 * PrismaClient. `skip` entries are (mostly) no-ops — case-studies/singlepages
 * skips still record the row's id/sanityId so a later "link" entry for the
 * SAME row in the SAME plan can find it without re-querying. A `refuse` entry
 * must never reach here (callers check for refusals and abort first) — if
 * one does, this throws rather than silently upserting.
 */
export async function applyPlan(plan, prisma) {
  const idBySlug = { "case-studies": new Map(), singlepages: new Map() };

  for (const entry of plan) {
    if (entry.action === "refuse") {
      throw new Error(`seed.mjs: refusing to apply a plan containing a "refuse" entry (${entry.kind} ${entry.key}): ${entry.reason}`);
    }

    if (entry.kind === "site-documents") {
      if (entry.action === "skip") continue;
      await prisma.siteDocument.upsert({
        where: { type_language: { type: entry.key, language: "he" } },
        update: { data: entry.data },
        create: { sanityId: entry.sanityId ?? `${entry.key}-he`, type: entry.key, language: "he", data: entry.data },
      });
      continue;
    }

    if (entry.kind === "faq") {
      if (entry.action === "skip") continue;
      await prisma.siteDocument.upsert({
        where: { type_language: { type: "faqPage", language: "he" } },
        update: { data: entry.data },
        create: { sanityId: entry.sanityId ?? "faqPage-he", type: "faqPage", language: "he", data: entry.data },
      });
      continue;
    }

    if (entry.kind === "legal-check") {
      continue; // validation only — "skip" (clean) is the only non-refuse action
    }

    if (entry.kind === "case-studies") {
      if (entry.action === "skip") {
        idBySlug["case-studies"].set(entry.key, entry.id);
        continue;
      }
      if (entry.action === "insert" || entry.action === "update") {
        if (entry.resolved?.needsEnUpdate && entry.resolved.sourceEnRowId) {
          await prisma.caseStudy.update({ where: { id: entry.resolved.sourceEnRowId }, data: { translationGroupId: entry.resolved.translationGroupId } });
        }
        const row = await prisma.caseStudy.upsert({
          where: { language_slug: { language: "he", slug: entry.key } },
          update: { ...entry.data, translationGroupId: entry.resolved.translationGroupId },
          create: {
            sanityId: entry.sanityId,
            language: "he",
            slug: entry.key,
            translationGroupId: entry.resolved.translationGroupId,
            status: "PUBLISHED",
            publishedAt: new Date(),
            ...entry.data,
          },
        });
        idBySlug["case-studies"].set(entry.key, row.id);
        continue;
      }
      if (entry.action === "link") {
        const caseStudyId = idBySlug["case-studies"].get(entry.key);
        if (!caseStudyId) throw new Error(`seed.mjs: cannot link related projects for case study "${entry.key}" — no id resolved from the main pass`);
        const devIds = entry.resolved.relatedDevelopmentIds;
        const projects = devIds.length ? await prisma.project.findMany({ where: { supersededByDevelopmentId: { in: devIds } } }) : [];
        const linkedDevIds = new Set(projects.map((p) => p.supersededByDevelopmentId));
        const unmatched = devIds.filter((id) => !linkedDevIds.has(id));
        if (unmatched.length) {
          console.warn(
            `seed.mjs: case study "${entry.key}" — ${unmatched.length} related development(s) have no legacy Project row to link ` +
              `(no Project.supersededByDevelopmentId points at them); skipping those links: ${unmatched.join(", ")}`,
          );
        }
        await prisma.caseStudyProject.deleteMany({ where: { caseStudyId } });
        if (projects.length) {
          await prisma.caseStudyProject.createMany({ data: projects.map((p) => ({ caseStudyId, projectId: p.id })) });
        }
        continue;
      }
    }

    if (entry.kind === "singlepages") {
      // The DB `slug` column is the LEAF segment (entry.slug); entry.key is
      // the full pack path and is only an identifier for reports/links.
      const dbSlug = entry.slug ?? entry.key;
      if (entry.action === "skip") {
        idBySlug.singlepages.set(entry.key, entry.sanityId);
        continue;
      }
      if (entry.action === "insert" || entry.action === "update") {
        if (entry.resolved?.needsEnUpdate && entry.resolved.sourceEnRowId) {
          await prisma.singlepage.update({ where: { id: entry.resolved.sourceEnRowId }, data: { translationGroupId: entry.resolved.translationGroupId } });
        }
        const { parentSanityId, translationGroupId, ...rest } = entry.data;
        await prisma.singlepage.upsert({
          where: { language_slug: { language: "he", slug: dbSlug } },
          update: { ...rest, parentSanityId, translationGroupId },
          create: { sanityId: entry.sanityId, language: "he", slug: dbSlug, parentSanityId, translationGroupId, status: "PUBLISHED", publishedAt: new Date(), ...rest },
        });
        idBySlug.singlepages.set(entry.key, entry.sanityId);
        continue;
      }
      if (entry.action === "link") {
        await prisma.singlepage.update({
          where: { language_slug: { language: "he", slug: dbSlug } },
          data: { relatedLandingPages: entry.resolved.relatedRefs },
        });
        continue;
      }
    }

    throw new Error(`seed.mjs: applyPlan — unhandled plan entry (kind "${entry.kind}", action "${entry.action}")`);
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

/** Loads the on-disk pack for one kind (no DB access). */
export function loadPack(kind) {
  if (kind === "site-documents") return { kind, rows: loadSiteDocumentsPack() };
  if (kind === "faq") return { kind, rows: loadFaqPack() };
  if (kind === "case-studies") return { kind, rows: loadCaseStudiesPack() };
  if (kind === "singlepages") return { kind, rows: loadSinglepagesPack() };
  if (kind === "legal-check") return { kind, rows: loadLegalCheckPack() };
  throw new Error(`seed.mjs: unknown kind "${kind}"`);
}

/**
 * Renders a plan as the lines printPlan writes, so what the operator reads is
 * testable without capturing stdout. Exported for the tests.
 *
 * Every entry whose `resolved.needsEnUpdate` is set gets an extra
 * **`link-group`** line: that is the one case where applying this plan writes
 * to a row that is NOT "he" — the EN `CaseStudy`/`Singlepage` named by
 * `translationGroupSlugEn` gains the `translationGroupId` it never had (the
 * same "generate + persist if missing" convention `createTranslation` uses).
 * It must be visible in the dry run, not just in the code.
 */
export function formatPlanLines(plan) {
  if (!plan.length) return ["he-content seed: empty plan (0 rows) — nothing to do."];
  const lines = ["kind            key                              action   reason"];
  const pad = `                ${" ".repeat(32)} `;
  for (const p of plan) {
    lines.push(`${p.kind.padEnd(15)} ${String(p.key).padEnd(32)} ${p.action.padEnd(8)} ${p.reason}`);
    if (p.resolved) {
      const bits = [];
      if (p.resolved.leafSlug && p.resolved.leafSlug !== p.key) bits.push(`slug=${p.resolved.leafSlug}`);
      if (p.resolved.parentSanityId) bits.push(`parent=${p.resolved.parentSanityId}`);
      if (p.resolved.translationGroupId) bits.push(`translationGroupId=${p.resolved.translationGroupId}`);
      if (p.resolved.relatedRefs) bits.push(`relatedRefs=[${p.resolved.relatedRefs.map((r) => r._ref).join(", ")}]`);
      if (p.resolved.relatedDevelopmentSlugs) bits.push(`relatedDevelopmentSlugs=[${p.resolved.relatedDevelopmentSlugs.join(", ")}]`);
      if (bits.length) lines.push(`${pad}${" ".repeat(8)} → ${bits.join(", ")}`);
      if (p.resolved.needsEnUpdate && p.resolved.sourceEnRowId) {
        lines.push(
          `${p.kind.padEnd(15)} ${String(p.key).padEnd(32)} ${"link-group".padEnd(8)} ` +
            `will set translationGroupId ${p.resolved.translationGroupId} on the EN row ${p.resolved.sourceEnRowId} ` +
            `(the only non-"he" row this plan writes)`,
        );
      }
    }
  }
  return lines;
}

function printPlan(plan) {
  for (const line of formatPlanLines(plan)) console.log(line);
}

// Real (non-test) existingRows loaders — one per kind, each a thin
// `prisma.*.findMany` wrapper shaping rows into what the pure planners above
// expect (including the loader-side joins: caseStudies'
// relatedDevelopmentSlugs, singlepages' relatedLandingPageSlugs). Only
// exercised by a real `node scripts/he-content/seed.mjs` run (gated behind
// CVP_ALLOW_DB_READ=yes) — tests call the pure planners directly with fakes.
async function loadExistingRowsForPack(prisma, pack) {
  // SiteDocument is @@unique([type, language]): the en/de/pl/ru rows for
  // these same types are expected siblings the pack never touches, so both
  // loaders fetch "he" only.
  if (pack.kind === "site-documents") {
    if (!pack.rows.length) return {};
    const siteDocuments = await prisma.siteDocument.findMany({ where: { type: { in: pack.rows.map((r) => r.type) }, language: "he" } });
    return { siteDocuments };
  }

  if (pack.kind === "faq") {
    if (!pack.rows.length) return {};
    const siteDocuments = await prisma.siteDocument.findMany({ where: { type: "faqPage", language: "he" } });
    return { siteDocuments };
  }

  if (pack.kind === "case-studies") {
    if (!pack.rows.length) return {};
    const slugs = pack.rows.map((r) => r.slug);
    const tgSlugs = [...new Set(pack.rows.map((r) => r.raw.translationGroupSlugEn).filter(Boolean))];
    // Only "he" rows for the pack's own slugs, plus (separately) any EN
    // sibling needed for translationGroupSlugEn resolution — never a same-slug
    // row of another language, which decision A makes the norm, not a hazard.
    const byId = new Map();
    for (const r of await prisma.caseStudy.findMany({ where: { slug: { in: slugs }, language: "he" } })) byId.set(r.id, r);
    if (tgSlugs.length) for (const r of await prisma.caseStudy.findMany({ where: { language: "en", slug: { in: tgSlugs } } })) byId.set(r.id, r);
    const caseStudies = await Promise.all(
      [...byId.values()].map(async (r) => {
        if (r.language !== "he") return { ...r, relatedDevelopmentSlugs: [] };
        const links = await prisma.caseStudyProject.findMany({
          where: { caseStudyId: r.id },
          include: { project: { include: { supersededByDevelopment: true } } },
        });
        return { ...r, relatedDevelopmentSlugs: links.map((l) => l.project?.supersededByDevelopment?.slug).filter(Boolean) };
      }),
    );
    const devSlugs = [...new Set(pack.rows.flatMap((r) => (Array.isArray(r.raw.relatedProjects) ? r.raw.relatedProjects : [])))];
    const developments = devSlugs.length ? await prisma.development.findMany({ where: { slug: { in: devSlugs } }, select: { id: true, slug: true } }) : [];
    return { caseStudies, developments };
  }

  if (pack.kind === "singlepages") {
    if (!pack.rows.length) return {};
    // Every DB-side slug here is a LEAF segment — that's what the column
    // holds (see leafSlug) — while the pack's own slugs are full paths.
    const slugs = pack.rows.map((r) => leafSlug(r.slug));
    const parentSlugs = pack.rows.map((r) => parentPackSlug(r.slug)).filter(Boolean).map(leafSlug);
    const relSlugs = pack.rows.flatMap((r) => (Array.isArray(r.raw.relatedLandingPages) ? r.raw.relatedLandingPages : [])).map(leafSlug);
    const tgSlugs = [...new Set(pack.rows.map((r) => r.raw.translationGroupSlugEn).filter(Boolean))];
    const allSlugs = [...new Set([...slugs, ...parentSlugs, ...relSlugs])];
    // Only "he" rows for the pack's own/parent/related slugs, plus
    // (separately) any EN sibling needed for translationGroupSlugEn
    // resolution — never a same-slug row of another language, which
    // decision A makes the norm, not a hazard.
    const byId = new Map();
    for (const r of await prisma.singlepage.findMany({ where: { slug: { in: allSlugs }, language: "he" } })) byId.set(r.id, r);
    if (tgSlugs.length) for (const r of await prisma.singlepage.findMany({ where: { language: "en", slug: { in: tgSlugs } } })) byId.set(r.id, r);
    const bySanityId = new Map([...byId.values()].map((r) => [r.sanityId, r]));
    const singlepages = [...byId.values()].map((r) => {
      if (r.language !== "he") return { ...r, relatedLandingPageSlugs: [] };
      const refs = Array.isArray(r.relatedLandingPages) ? r.relatedLandingPages : [];
      const relatedLandingPageSlugs = refs.map((ref) => bySanityId.get(ref?._ref)?.slug).filter(Boolean);
      return { ...r, relatedLandingPageSlugs };
    });
    return { singlepages };
  }

  if (pack.kind === "legal-check") return {};

  return {};
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

  const packs = kinds.map((k) => loadPack(k));

  const totalRows = packs.reduce((n, p) => n + p.rows.length, 0);
  console.log(`he-content seed: ${isDryRun ? "DRY RUN" : "REAL RUN"} — kinds: ${kinds.join(", ")}`);

  // legal-check never needs the DB — run it unconditionally so `--only
  // legal-check` (and a combined run) always reports it even with
  // CVP_ALLOW_DB_READ unset.
  const legalCheckPack = packs.find((p) => p.kind === "legal-check" && p.rows.length);
  const nonLegalTotalRows = totalRows - (legalCheckPack ? legalCheckPack.rows.length : 0);

  if (nonLegalTotalRows === 0) {
    const legalPlan = legalCheckPack ? planLegalCheck(legalCheckPack.rows) : [];
    if (legalPlan.length) printPlan(legalPlan);
    const legalRefusals = legalPlan.filter((p) => p.action === "refuse");
    if (legalRefusals.length) {
      console.error(`\nseed.mjs: ${legalRefusals.length} row(s) refused — see reasons above.`);
      process.exitCode = 1;
      return;
    }
    console.log("he-content seed: empty plan (0 DB-backed rows across all selected kinds) — nothing to do.");
    return; // no PrismaClient constructed — see the module banner
  }

  if (process.env.CVP_ALLOW_DB_READ !== "yes") {
    // Not being ALLOWED to read is an expected, safe stopping point for an
    // operator running this from the wrong place (a laptop) — not a failure
    // of the pack itself, so this exits 0 rather than 1 (contrast with the
    // "row(s) refused" and "--yes without confirm" branches below, which
    // report a real problem and DO exit 1).
    console.log(
      "seed.mjs: the pack is non-empty, and planning insert/update/skip needs to read existing rows from the database. " +
        "set CVP_ALLOW_DB_READ=yes to read existing rows (see content/he/README.md — this applies to dry runs too).",
    );
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const allPlans = [];
    for (const pack of packs) {
      if (!pack.rows.length) continue;
      if (pack.kind === "legal-check") {
        allPlans.push(...planLegalCheck(pack.rows));
        continue;
      }
      const existingRows = await loadExistingRowsForPack(prisma, pack);
      allPlans.push(...planSeed(pack, existingRows));
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
