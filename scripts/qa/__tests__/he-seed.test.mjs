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
import { test } from "node:test";
import assert from "node:assert/strict";

import { planSeed, planFaq, rebuildFaqHe, planCaseStudies, planSinglepages, planLegalCheck, applyPlan } from "../../he-content/seed.mjs";

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

test("planCaseStudies: refuses when an existing row with the same slug is a different language", () => {
  const plan = planCaseStudies([caseStudyRow("story-1")], {
    caseStudies: [{ id: "x", sanityId: "story-1-en", slug: "story-1", language: "en", title: "Title" }],
    developments: [],
  });
  const refusal = plan.find((p) => p.action === "refuse");
  assert.ok(refusal);
  assert.match(refusal.reason, /language "en"/);
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

test("planSinglepages: refuses when an existing row with the same slug is a different language", () => {
  const plan = planSinglepages([singlepageRow("limassol")], {
    singlepages: [{ id: "x", sanityId: "limassol-de", slug: "limassol", language: "de", title: "Startseite" }],
  });
  const refusal = plan.find((p) => p.action === "refuse");
  assert.ok(refusal);
  assert.match(refusal.reason, /language "de"/);
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
  const plan = planSinglepages([singlepageRow("limassol", { parentSlug: "missing-hub" })], { singlepages: [] });
  const prisma = fakePrisma();
  await assert.rejects(() => applyPlan(plan, prisma), /refusing to apply/);
  assert.equal(prisma.calls.singlepageUpsert.length, 0);
});
