// Tests for the Hebrew content-pack seeder's Task 9 kinds (faq, case-studies,
// singlepages, legal-check) — Hebrew localization Phase 5, Task 9.
//
// Everything here calls the PURE planners (planFaq/planCaseStudies/
// planSinglepages/planLegalCheck/planSeed) and applyPlan against in-memory
// fakes. No file I/O, no Prisma, no database — see
// docs/superpowers/plans/2026-09-13-hebrew-phase5-content.md Task 9 and the
// repo's "Local DB is production" note for why.
//
// Run: node --test scripts/qa/__tests__/he-seed.test.mjs
// The pack LOADER tests at the bottom are the one exception: they write
// throwaway fixture files into an OS temp directory (never the repo, never
// the DB) because recursive directory walking cannot be exercised in memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  planSeed,
  planFaq,
  rebuildFaqHe,
  planCaseStudies,
  planSinglepages,
  planLegalCheck,
  applyPlan,
  loadSinglepagesPack,
  loadCaseStudiesPack,
  assertUpdateTargetIsHe,
  assertNoExistingHeRow,
} from "../../he-content/seed.mjs";

// ─── faq ────────────────────────────────────────────────────────────────────

test("rebuildFaqHe: rebuilds strictly from EN order/ids — a reordered/shuffled he.json still yields EN order", () => {
  const en = [
    {
      slug: "foreigner",
      label: "Buying as a Foreigner",
      description: "d1",
      items: [
        { id: "q1", question: "Q1?", answer: ["a1"] },
        { id: "q2", question: "Q2?", answer: ["a2"] },
      ],
    },
    { slug: "tax", label: "Tax", description: "d2", items: [{ id: "q3", question: "Q3?", answer: ["a3"] }] },
  ];
  // he.json: categories reordered (tax first) AND items within a category
  // reordered (q2 before q1) — the rebuild must still come out in EN order.
  const heShuffled = [
    { slug: "tax", label: "מס", description: "ת2", items: [{ id: "q3", question: "ש3?", answer: ["ת3"] }] },
    {
      slug: "foreigner",
      label: "רכישה על ידי זרים",
      description: "ת1",
      items: [
        { id: "q2", question: "ש2?", answer: ["ת2-2"] },
        { id: "q1", question: "ש1?", answer: ["ת1-1"] },
      ],
    },
  ];
  const rebuilt = rebuildFaqHe(en, heShuffled);
  assert.deepEqual(
    rebuilt.map((c) => c.slug),
    ["foreigner", "tax"],
  );
  assert.deepEqual(
    rebuilt[0].items.map((i) => i.id),
    ["q1", "q2"],
  );
  assert.equal(rebuilt[0].items[0].question, "ש1?");
  assert.equal(rebuilt[0].items[1].question, "ש2?");
});

test("rebuildFaqHe: missing category translation throws naming the slug", () => {
  const en = [{ slug: "foreigner", label: "x", description: "d", items: [] }];
  assert.throws(() => rebuildFaqHe(en, []), /missing he category translation for slug "foreigner"/);
});

test("rebuildFaqHe: answer paragraph count mismatch throws", () => {
  const en = [{ slug: "foreigner", label: "x", description: "d", items: [{ id: "q1", question: "Q?", answer: ["a1", "a2"] }] }];
  const he = [{ slug: "foreigner", label: "y", description: "d2", items: [{ id: "q1", question: "ש?", answer: ["a1"] }] }];
  assert.throws(() => rebuildFaqHe(en, he), /answer paragraph count mismatch/);
});

test("planFaq: insert when no existing he row", () => {
  const plan = planFaq([{ key: "faqPage", data: { categories: [] } }], { siteDocuments: [] });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].action, "insert");
  assert.equal(plan[0].sanityId, "faqPage-he");
});

test("planFaq: update when existing he data differs, skip when unchanged", () => {
  const row = { key: "faqPage", data: { categories: [{ slug: "tax" }] } };
  const differing = { siteDocuments: [{ type: "faqPage", language: "he", sanityId: "faqPage-he", data: { categories: [] } }] };
  assert.equal(planFaq([row], differing)[0].action, "update");

  const same = { siteDocuments: [{ type: "faqPage", language: "he", sanityId: "faqPage-he", data: row.data }] };
  const skipPlan = planFaq([row], same);
  assert.equal(skipPlan[0].action, "skip");
  assert.match(skipPlan[0].reason, /unchanged/);
});

test("planFaq: refuses when the existing faqPage row is not he", () => {
  const plan = planFaq([{ key: "faqPage", data: { categories: [] } }], {
    siteDocuments: [{ type: "faqPage", language: "de", sanityId: "faqPage-de", data: {} }],
  });
  assert.equal(plan[0].action, "refuse");
  assert.match(plan[0].reason, /language "de"/);
});

// ─── case-studies ───────────────────────────────────────────────────────────

function caseStudyRow(slug, overrides = {}) {
  return { slug, raw: { title: "כותרת", excerpt: "תקציר", relatedProjects: [], ...overrides } };
}

test("planCaseStudies: insert when no existing he row (no translation group, no related projects)", () => {
  const plan = planCaseStudies([caseStudyRow("story-1")], { caseStudies: [], developments: [] });
  const insertEntry = plan.find((p) => p.action === "insert");
  assert.ok(insertEntry);
  assert.equal(insertEntry.sanityId, "he-story-1");
  assert.ok(insertEntry.resolved.translationGroupId); // minted since translationGroupSlugEn is absent
});

test("planCaseStudies: update when existing he row's fields differ, skip when unchanged", () => {
  const existingHe = {
    id: "cs-he-1",
    sanityId: "he-story-1",
    slug: "story-1",
    language: "he",
    translationGroupId: "tg-1",
    title: "כותרת ישנה",
    relatedDevelopmentSlugs: [],
  };
  const updatePlan = planCaseStudies([caseStudyRow("story-1")], { caseStudies: [existingHe], developments: [] });
  assert.equal(updatePlan.find((p) => p.key === "story-1" && ["insert", "update", "skip"].includes(p.action)).action, "update");

  const existingSame = { ...existingHe, title: "כותרת" };
  const skipPlan = planCaseStudies([caseStudyRow("story-1")], { caseStudies: [existingSame], developments: [] });
  const skipEntry = skipPlan.find((p) => p.key === "story-1" && p.action === "skip");
  assert.ok(skipEntry, "expected a skip entry for the main pass");
});

test("planCaseStudies: a same-slug EN row is expected (decision A) and never blocks the plan — insert when no he row, update when one exists", () => {
  const enSibling = { id: "en-1", sanityId: "story-1-en", slug: "story-1", language: "en", title: "Title" };

  // No he row yet — the pack plans an insert, not a refusal.
  const insertPlan = planCaseStudies([caseStudyRow("story-1")], { caseStudies: [enSibling], developments: [] });
  const insertEntry = insertPlan.find((p) => p.key === "story-1" && ["insert", "update", "skip", "refuse"].includes(p.action));
  assert.equal(insertEntry.action, "insert", insertEntry.reason);

  // A he row also exists alongside the EN sibling — the pack plans an update
  // (targeting the he row), still not a refusal.
  const heRow = { id: "he-1", sanityId: "he-story-1", slug: "story-1", language: "he", translationGroupId: "tg-1", title: "old title", relatedDevelopmentSlugs: [] };
  const updatePlan = planCaseStudies([caseStudyRow("story-1")], { caseStudies: [enSibling, heRow], developments: [] });
  const updateEntry = updatePlan.find((p) => p.key === "story-1" && ["insert", "update", "skip", "refuse"].includes(p.action));
  assert.equal(updateEntry.action, "update", updateEntry.reason);
});

test("assertUpdateTargetIsHe / assertNoExistingHeRow: throw against corrupted existingRows", () => {
  assert.throws(
    () => assertUpdateTargetIsHe({ id: "x", slug: "story-1", language: "en" }, 'case-studies "story-1"'),
    /language is "en", not "he"/,
  );
  // A genuine "he" row must never trip the guard.
  assert.doesNotThrow(() => assertUpdateTargetIsHe({ id: "x", slug: "story-1", language: "he" }, 'case-studies "story-1"'));
  assert.doesNotThrow(() => assertUpdateTargetIsHe(null, 'case-studies "story-1"'));

  assert.throws(
    () => assertNoExistingHeRow([{ id: "he-1", slug: "story-1", language: "he" }], "story-1", 'case-studies "story-1"'),
    /a "he" row for slug "story-1" already exists/,
  );
  // A same-slug EN row must never trip this guard either.
  assert.doesNotThrow(() => assertNoExistingHeRow([{ id: "en-1", slug: "story-1", language: "en" }], "story-1", 'case-studies "story-1"'));
});

test("planCaseStudies: translationGroupSlugEn absent mints a fresh group id; present reuses/errors", () => {
  const noGroup = planCaseStudies([caseStudyRow("story-1")], { caseStudies: [], developments: [] });
  const insertNoGroup = noGroup.find((p) => p.action === "insert");
  assert.ok(insertNoGroup.resolved.translationGroupId);

  const enRow = { id: "en-1", sanityId: "story-en", slug: "story-original", language: "en", translationGroupId: "tg-existing" };
  const withGroup = planCaseStudies([caseStudyRow("story-1", { translationGroupSlugEn: "story-original" })], {
    caseStudies: [enRow],
    developments: [],
  });
  const insertWithGroup = withGroup.find((p) => p.action === "insert");
  assert.equal(insertWithGroup.resolved.translationGroupId, "tg-existing");
  assert.equal(insertWithGroup.resolved.sourceEnRowId, "en-1");

  const unknownGroup = planCaseStudies([caseStudyRow("story-1", { translationGroupSlugEn: "does-not-exist" })], {
    caseStudies: [],
    developments: [],
  });
  const refusal = unknownGroup.find((p) => p.action === "refuse");
  assert.ok(refusal);
  assert.match(refusal.reason, /unknown translationGroupSlugEn "does-not-exist"/);
});

test("planCaseStudies: related projects resolved by development slug; unknown slug errors", () => {
  const plan = planCaseStudies([caseStudyRow("story-1", { relatedProjects: ["limassol-marina"] })], {
    caseStudies: [],
    developments: [{ id: "dev-1", slug: "limassol-marina" }],
  });
  const linkEntry = plan.find((p) => p.action === "link");
  assert.ok(linkEntry);
  assert.deepEqual(linkEntry.resolved.relatedDevelopmentIds, ["dev-1"]);

  const unknown = planCaseStudies([caseStudyRow("story-1", { relatedProjects: ["not-a-real-development"] })], {
    caseStudies: [],
    developments: [],
  });
  const refusal = unknown.find((p) => p.action === "refuse");
  assert.ok(refusal);
  assert.match(refusal.reason, /unknown development slug.*"not-a-real-development"/);
});

test("planCaseStudies: idempotency — a second plan over the applied result has zero writes", () => {
  const firstPlan = planCaseStudies([caseStudyRow("story-1", { relatedProjects: ["limassol-marina"] })], {
    caseStudies: [],
    developments: [{ id: "dev-1", slug: "limassol-marina" }],
  });
  const insertEntry = firstPlan.find((p) => p.action === "insert");
  const linkEntry = firstPlan.find((p) => p.action === "link");

  // Simulate the DB state after applying firstPlan.
  const existingAfterApply = {
    id: "cs-he-1",
    sanityId: insertEntry.sanityId,
    slug: "story-1",
    language: "he",
    translationGroupId: insertEntry.resolved.translationGroupId,
    ...insertEntry.data,
    relatedDevelopmentSlugs: linkEntry.resolved.relatedDevelopmentSlugs,
  };
  const secondPlan = planCaseStudies([caseStudyRow("story-1", { relatedProjects: ["limassol-marina"] })], {
    caseStudies: [existingAfterApply],
    developments: [{ id: "dev-1", slug: "limassol-marina" }],
  });
  for (const entry of secondPlan) assert.equal(entry.action, "skip", `expected "skip" for ${entry.kind}/${entry.key}, got "${entry.action}": ${entry.reason}`);
});

// ─── singlepages ────────────────────────────────────────────────────────────

function singlepageRow(slug, overrides = {}) {
  return { slug, raw: { title: "כותרת", excerpt: "תקציר", allowIntroBlock: true, ...overrides } };
}

test("planSinglepages: insert / update / skip for the main pass", () => {
  const insertPlan = planSinglepages([singlepageRow("limassol")], { singlepages: [] });
  const insertEntry = insertPlan.find((p) => p.action === "insert");
  assert.ok(insertEntry);
  assert.equal(insertEntry.sanityId, "he-limassol");

  const existing = {
    id: "sp-1",
    sanityId: "he-limassol",
    slug: "limassol",
    language: "he",
    title: "כותרת ישנה",
    excerpt: "תקציר",
    allowIntroBlock: true,
    translationGroupId: "tg-existing",
  };
  const updatePlan = planSinglepages([singlepageRow("limassol")], { singlepages: [existing] });
  assert.equal(updatePlan.find((p) => ["insert", "update", "skip"].includes(p.action)).action, "update");

  const existingSame = { ...existing, title: "כותרת" };
  const skipPlan = planSinglepages([singlepageRow("limassol")], { singlepages: [existingSame] });
  assert.equal(skipPlan.find((p) => ["insert", "update", "skip"].includes(p.action)).action, "skip");
});

test("planSinglepages: nested parentSlug resolves to the hub's deterministic sanityId; missing parent errors naming the slug", () => {
  const rows = [singlepageRow("limassol"), singlepageRow("limassol/new-projects", { parentSlug: "limassol" })];
  const plan = planSinglepages(rows, { singlepages: [] });
  const spokeEntry = plan.find((p) => p.key === "limassol/new-projects" && p.action === "insert");
  assert.ok(spokeEntry);
  assert.equal(spokeEntry.resolved.parentSanityId, "he-limassol");

  const orphan = planSinglepages([singlepageRow("paphos/villas", { parentSlug: "paphos" })], { singlepages: [] });
  const refusal = orphan.find((p) => p.action === "refuse");
  assert.ok(refusal);
  assert.match(refusal.reason, /missing parent page for parentSlug "paphos"/);
});

test("planSinglepages: a nested page stores the LEAF slug in the DB column, keeps the full path as its key, and gets a dash-joined sanityId", () => {
  const rows = [singlepageRow("limassol"), singlepageRow("limassol/new-projects", { parentSlug: "limassol" })];
  const plan = planSinglepages(rows, { singlepages: [] });
  const spoke = plan.find((p) => p.key === "limassol/new-projects" && p.action === "insert");
  assert.ok(spoke);
  // The public route looks a page up by the LAST URL segment only
  // (_getSinglePageByLang), reconstructing the path via parentSanityId.
  assert.equal(spoke.slug, "new-projects");
  assert.equal(spoke.resolved.leafSlug, "new-projects");
  assert.equal(spoke.resolved.parentSanityId, "he-limassol");
  assert.equal(spoke.sanityId, "he-limassol-new-projects");

  const hub = plan.find((p) => p.key === "limassol" && p.action === "insert");
  assert.equal(hub.slug, "limassol");
  assert.equal(hub.resolved.parentSanityId, null);
});

test("planSinglepages: parentSlug must match the pack slug's own parent segment", () => {
  const mismatch = planSinglepages([singlepageRow("limassol"), singlepageRow("limassol/new-projects", { parentSlug: "paphos" })], { singlepages: [] });
  const refusal = mismatch.find((p) => p.action === "refuse");
  assert.ok(refusal);
  assert.match(refusal.reason, /parentSlug "paphos" does not match the parent segment of slug "limassol\/new-projects"/);

  // A top-level page must not declare a parent at all.
  const topLevel = planSinglepages([singlepageRow("limassol", { parentSlug: "cyprus" })], { singlepages: [] });
  assert.match(topLevel.find((p) => p.action === "refuse").reason, /no parentSlug \(top-level page\)/);

  // parentSlug omitted entirely is fine — the path already says it.
  const implied = planSinglepages([singlepageRow("limassol"), singlepageRow("limassol/new-projects")], { singlepages: [] });
  assert.equal(implied.find((p) => p.key === "limassol/new-projects" && p.action === "insert").resolved.parentSanityId, "he-limassol");
});

test("planSinglepages: two pack pages sharing a leaf under different parents are refused (the route cannot tell them apart)", () => {
  const rows = [
    singlepageRow("limassol"),
    singlepageRow("paphos"),
    singlepageRow("limassol/apartments", { parentSlug: "limassol" }),
    singlepageRow("paphos/apartments", { parentSlug: "paphos" }),
  ];
  const plan = planSinglepages(rows, { singlepages: [] });
  const refusals = plan.filter((p) => p.action === "refuse");
  assert.equal(refusals.length, 2);
  for (const r of refusals) {
    assert.match(r.reason, /duplicate leaf slug "apartments" across pack pages "limassol\/apartments" and "paphos\/apartments"/);
  }
  // The hubs themselves still plan normally.
  assert.ok(plan.find((p) => p.key === "limassol" && p.action === "insert"));
});

test("planSinglepages: an already-seeded nested he row is matched by its leaf slug and re-resolved to its full path", () => {
  const existingHub = { id: "sp-hub", sanityId: "he-limassol", slug: "limassol", language: "he", title: "כותרת" };
  const existingSpoke = {
    id: "sp-spoke",
    sanityId: "he-limassol-new-projects",
    slug: "new-projects",
    language: "he",
    parentSanityId: "he-limassol",
    title: "כותרת",
    excerpt: "תקציר",
    allowIntroBlock: true,
    translationGroupId: "tg-1",
    relatedLandingPageSlugs: [],
  };
  // Another page links the nested one by its FULL pack path.
  const plan = planSinglepages([singlepageRow("paphos", { relatedLandingPages: ["limassol/new-projects"] })], {
    singlepages: [existingHub, existingSpoke],
  });
  const link = plan.find((p) => p.key === "paphos" && p.action === "link");
  assert.deepEqual(link.resolved.relatedRefs, [{ _ref: "he-limassol-new-projects" }]);

  // And re-planning the spoke itself finds the existing row (update/skip, not a second insert).
  const rePlan = planSinglepages([singlepageRow("limassol/new-projects", { parentSlug: "limassol" })], { singlepages: [existingHub, existingSpoke] });
  const entry = rePlan.find((p) => ["insert", "update", "skip"].includes(p.action));
  assert.equal(entry.action, "skip", entry.reason);
  assert.equal(entry.sanityId, "he-limassol-new-projects");
});

test("applyPlan: a nested singlepage is upserted under its LEAF slug with parentSanityId set", async () => {
  const rows = [singlepageRow("limassol"), singlepageRow("limassol/new-projects", { parentSlug: "limassol", relatedLandingPages: ["limassol"] })];
  const plan = planSinglepages(rows, { singlepages: [] });
  const prisma = fakePrisma();
  await applyPlan(plan, prisma);

  const spokeUpsert = prisma.calls.singlepageUpsert.find((c) => c.create.sanityId === "he-limassol-new-projects");
  assert.ok(spokeUpsert);
  assert.deepEqual(spokeUpsert.where, { language_slug: { language: "he", slug: "new-projects" } });
  assert.equal(spokeUpsert.create.slug, "new-projects");
  assert.equal(spokeUpsert.create.parentSanityId, "he-limassol");
  assert.deepEqual(prisma.calls.singlepageUpdate[0].where, { language_slug: { language: "he", slug: "new-projects" } });
});

test("planSinglepages: parentSlug also resolves against an already-seeded he row from a previous run", () => {
  const existingHub = { id: "sp-hub", sanityId: "he-limassol", slug: "limassol", language: "he", title: "כותרת" };
  const plan = planSinglepages([singlepageRow("limassol/new-projects", { parentSlug: "limassol" })], { singlepages: [existingHub] });
  const entry = plan.find((p) => p.action === "insert");
  assert.equal(entry.resolved.parentSanityId, "he-limassol");
});

test("planSinglepages: translationGroupSlugEn present/absent — absent mints a new group id, present reuses the EN row's", () => {
  const noGroup = planSinglepages([singlepageRow("limassol")], { singlepages: [] });
  assert.ok(noGroup.find((p) => p.action === "insert").resolved.translationGroupId);

  const enRow = { id: "en-1", sanityId: "en-limassol", slug: "limassol-en-slug", language: "en", translationGroupId: "tg-9" };
  const withGroup = planSinglepages([singlepageRow("limassol", { translationGroupSlugEn: "limassol-en-slug" })], { singlepages: [enRow] });
  const entry = withGroup.find((p) => p.action === "insert");
  assert.equal(entry.resolved.translationGroupId, "tg-9");
});

test("planSinglepages: relatedLandingPages resolved only against rows in this pack/pass; unknown pack slug errors", () => {
  const rows = [singlepageRow("limassol", { relatedLandingPages: ["paphos"] }), singlepageRow("paphos")];
  const plan = planSinglepages(rows, { singlepages: [] });
  const linkEntry = plan.find((p) => p.key === "limassol" && p.action === "link");
  assert.ok(linkEntry);
  assert.deepEqual(linkEntry.resolved.relatedRefs, [{ _ref: "he-paphos" }]);

  const unknown = planSinglepages([singlepageRow("limassol", { relatedLandingPages: ["not-a-real-page"] })], { singlepages: [] });
  const refusal = unknown.find((p) => p.action === "refuse" && p.reason.includes("relatedLandingPages"));
  assert.ok(refusal);
  assert.match(refusal.reason, /unknown pack slug in relatedLandingPages: "not-a-real-page"/);
});

test("planSinglepages: a same-slug EN row is expected (decision A) and never blocks the plan — insert when no he row, update when one exists", () => {
  const enSibling = { id: "x", sanityId: "limassol-en", slug: "limassol", language: "en", title: "Homepage" };

  // No he row yet — the pack plans an insert, not a refusal.
  const insertPlan = planSinglepages([singlepageRow("limassol")], { singlepages: [enSibling] });
  const insertEntry = insertPlan.find((p) => ["insert", "update", "skip", "refuse"].includes(p.action));
  assert.equal(insertEntry.action, "insert", insertEntry.reason);

  // A he row also exists alongside the EN sibling — the pack plans an update
  // (targeting the he row), still not a refusal.
  const heRow = {
    id: "sp-1",
    sanityId: "he-limassol",
    slug: "limassol",
    language: "he",
    title: "כותרת ישנה",
    excerpt: "תקציר",
    allowIntroBlock: true,
    translationGroupId: "tg-existing",
  };
  const updatePlan = planSinglepages([singlepageRow("limassol")], { singlepages: [enSibling, heRow] });
  const updateEntry = updatePlan.find((p) => ["insert", "update", "skip", "refuse"].includes(p.action));
  assert.equal(updateEntry.action, "update", updateEntry.reason);
});

test("planSinglepages: idempotency — a second plan over the applied result has zero writes", () => {
  const rows = [singlepageRow("limassol", { relatedLandingPages: ["paphos"] }), singlepageRow("paphos")];
  const firstPlan = planSinglepages(rows, { singlepages: [] });

  const existingAfterApply = rows.map(({ slug, raw }) => {
    const insertEntry = firstPlan.find((p) => p.key === slug && p.action === "insert");
    const linkEntry = firstPlan.find((p) => p.key === slug && (p.action === "link" || p.action === "skip") && p.resolved?.relatedRefs !== undefined);
    return {
      id: `sp-${slug}`,
      sanityId: insertEntry.sanityId,
      slug,
      language: "he",
      title: raw.title,
      excerpt: raw.excerpt,
      allowIntroBlock: raw.allowIntroBlock ?? false,
      parentSanityId: insertEntry.resolved.parentSanityId,
      translationGroupId: insertEntry.resolved.translationGroupId,
      relatedLandingPageSlugs: linkEntry ? (raw.relatedLandingPages ?? []) : [],
    };
  });

  const secondPlan = planSinglepages(rows, { singlepages: existingAfterApply });
  for (const entry of secondPlan) assert.equal(entry.action, "skip", `expected "skip" for ${entry.kind}/${entry.key}, got "${entry.action}": ${entry.reason}`);
});

// ─── legal-check ────────────────────────────────────────────────────────────

test("planLegalCheck: clean registry.ts (no TODO(he)) skips", () => {
  const plan = planLegalCheck([{ source: "export const REGISTRY = { privacy: PRIVACY_HE, terms: TERMS_HE };" }]);
  assert.equal(plan[0].action, "skip");
});

test("planLegalCheck: a TODO(he) marker refuses", () => {
  const plan = planLegalCheck([{ source: "export const REGISTRY = { privacy: TODO(he) };" }]);
  assert.equal(plan[0].action, "refuse");
  assert.match(plan[0].reason, /TODO\(he\)/);
});

test("planLegalCheck: no rows (file missing) plans nothing", () => {
  assert.deepEqual(planLegalCheck([]), []);
});

// ─── planSeed dispatch ──────────────────────────────────────────────────────

test("planSeed: dispatches every Task 9 kind to its planner", () => {
  assert.equal(planSeed({ kind: "faq", rows: [{ key: "faqPage", data: { categories: [] } }] }, { siteDocuments: [] })[0].action, "insert");
  assert.equal(planSeed({ kind: "case-studies", rows: [caseStudyRow("s1")] }, { caseStudies: [], developments: [] }).find((p) => p.action === "insert").key, "s1");
  assert.equal(planSeed({ kind: "singlepages", rows: [singlepageRow("s1")] }, { singlepages: [] }).find((p) => p.action === "insert").key, "s1");
  assert.equal(planSeed({ kind: "legal-check", rows: [{ source: "clean" }] }, {})[0].action, "skip");
});

// ─── applyPlan: two-pass linking against fakes ─────────────────────────────

function fakePrisma() {
  const calls = { caseStudyUpsert: [], caseStudyProjectDeleteMany: [], caseStudyProjectCreateMany: [], projectFindMany: [], singlepageUpsert: [], singlepageUpdate: [] };
  return {
    calls,
    caseStudy: {
      upsert: async (args) => {
        calls.caseStudyUpsert.push(args);
        return { id: "cs-generated-id", ...args.create };
      },
      update: async () => ({}),
    },
    caseStudyProject: {
      deleteMany: async (args) => calls.caseStudyProjectDeleteMany.push(args),
      createMany: async (args) => calls.caseStudyProjectCreateMany.push(args),
    },
    project: {
      findMany: async (args) => {
        calls.projectFindMany.push(args);
        return [{ id: "proj-1", supersededByDevelopmentId: "dev-1" }];
      },
    },
    singlepage: {
      upsert: async (args) => {
        calls.singlepageUpsert.push(args);
        return { id: "sp-generated-id", ...args.create };
      },
      update: async (args) => calls.singlepageUpdate.push(args),
    },
  };
}

test("applyPlan: case-studies — inserts the row THEN links related projects (two-pass), using the id from the insert", async () => {
  const plan = planCaseStudies([caseStudyRow("story-1", { relatedProjects: ["limassol-marina"] })], {
    caseStudies: [],
    developments: [{ id: "dev-1", slug: "limassol-marina" }],
  });
  const prisma = fakePrisma();
  await applyPlan(plan, prisma);

  assert.equal(prisma.calls.caseStudyUpsert.length, 1);
  assert.equal(prisma.calls.projectFindMany.length, 1);
  assert.deepEqual(prisma.calls.projectFindMany[0].where.supersededByDevelopmentId.in, ["dev-1"]);
  assert.equal(prisma.calls.caseStudyProjectDeleteMany.length, 1);
  assert.equal(prisma.calls.caseStudyProjectDeleteMany[0].where.caseStudyId, "cs-generated-id");
  assert.deepEqual(prisma.calls.caseStudyProjectCreateMany[0].data, [{ caseStudyId: "cs-generated-id", projectId: "proj-1" }]);
});

test("applyPlan: singlepages — inserts the row THEN links relatedLandingPages (two-pass)", async () => {
  const rows = [singlepageRow("limassol", { relatedLandingPages: ["paphos"] }), singlepageRow("paphos")];
  const plan = planSinglepages(rows, { singlepages: [] });
  const prisma = fakePrisma();
  await applyPlan(plan, prisma);

  assert.equal(prisma.calls.singlepageUpsert.length, 2);
  assert.equal(prisma.calls.singlepageUpdate.length, 1);
  assert.deepEqual(prisma.calls.singlepageUpdate[0].data.relatedLandingPages, [{ _ref: "he-paphos" }]);
  assert.deepEqual(prisma.calls.singlepageUpdate[0].where, { language_slug: { language: "he", slug: "limassol" } });
});

test("applyPlan: refuses (throws) rather than writing anything when the plan contains a refuse entry", async () => {
  const plan = planSinglepages([singlepageRow("paphos/villas", { parentSlug: "paphos" })], { singlepages: [] });
  const prisma = fakePrisma();
  await assert.rejects(() => applyPlan(plan, prisma), /refusing to apply/);
  assert.equal(prisma.calls.singlepageUpsert.length, 0);
});

// ─── pack loaders (recursive, filename ⇄ "slug" consistency) ───────────────
//
// The only tests here that touch the filesystem: a throwaway fixture tree
// under the OS temp dir (never the repo, never the DB).

function withPackDir(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "he-seed-pack-"));
  try {
    for (const [rel, json] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, JSON.stringify(json, null, 2));
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("loadSinglepagesPack: recurses into subdirectories — a nested file's path IS its pack slug", () => {
  const rows = withPackDir(
    {
      "limassol.he.json": { slug: "limassol", title: "כותרת" },
      "limassol/new-projects.he.json": { slug: "limassol/new-projects", parentSlug: "limassol", title: "כותרת" },
      "notes.txt": "ignored",
    },
    (dir) => loadSinglepagesPack(dir),
  );
  assert.deepEqual(
    rows.map((r) => r.slug),
    ["limassol", "limassol/new-projects"],
  );
  assert.equal(rows[1].file, "limassol/new-projects.he.json");
  assert.equal(rows[1].raw.parentSlug, "limassol");
});

test('loadSinglepagesPack: a file whose "slug" field disagrees with its path is a hard error naming both', () => {
  assert.throws(
    () => withPackDir({ "limassol/new-projects.he.json": { slug: "new-projects", title: "כותרת" } }, (dir) => loadSinglepagesPack(dir)),
    /file "limassol\/new-projects\.he\.json" declares "slug": "new-projects", but its path \(without \.he\.json\) is "limassol\/new-projects"/,
  );
});

test('loadSinglepagesPack: a file without a "slug" field is accepted (the path is the slug); a missing directory loads nothing', () => {
  const rows = withPackDir({ "paphos.he.json": { title: "כותרת" } }, (dir) => loadSinglepagesPack(dir));
  assert.deepEqual(
    rows.map((r) => r.slug),
    ["paphos"],
  );
  assert.deepEqual(loadSinglepagesPack(path.join(os.tmpdir(), "he-seed-does-not-exist")), []);
});

test("loadCaseStudiesPack: same recursive loader, same filename ⇄ slug check", () => {
  const rows = withPackDir({ "story-1.he.json": { slug: "story-1", title: "כותרת" } }, (dir) => loadCaseStudiesPack(dir));
  assert.deepEqual(
    rows.map((r) => r.slug),
    ["story-1"],
  );
  assert.throws(
    () => withPackDir({ "story-1.he.json": { slug: "story-2" } }, (dir) => loadCaseStudiesPack(dir)),
    /case-studies — file "story-1\.he\.json" declares "slug": "story-2"/,
  );
});
